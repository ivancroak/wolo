/**
 * @module score
 *
 * Off-chain reputation analytics for the Wolo social marketplace.
 *
 * All functions are pure and deterministic — no I/O, no randomness.
 * Designed to run server-side or in a worker; the results feed the
 * on-chain reputation badge PDA once finalized.
 *
 * Rating values (`Rating.value`) must be normalised to [0, 1]:
 *   - A "1–5 star" system maps as (stars - 1) / 4  →  [0, 0.25, 0.5, 0.75, 1]
 *   - A binary thumbs-up/down maps as 0 or 1
 * The helper `normalizeStarRating` is exported for convenience.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A single rating event in the Wolo reputation system.
 */
export type Rating = {
  /** Normalised rating value in [0, 1]. Use `normalizeStarRating` for 1–5 stars. */
  value: number;
  /** Wallet address (or user ID) of the rater. */
  raterId: string;
  /** Wallet address (or user ID) of the person being rated. */
  subjectId: string;
  /** How many days ago this rating was submitted (0 = today, must be ≥ 0). */
  ageDays: number;
};

/**
 * An anomaly or manipulation finding returned by `detectRatingAnomalies`.
 */
export type AnomalyFinding = {
  /** Short machine-readable kind: "reciprocal_ring" | "rater_dominance" | "value_burst". */
  kind: string;
  /** Subject wallet (if applicable). */
  subjectId?: string;
  /** Rater wallet (if applicable). */
  raterId?: string;
  /** Human-readable description of the finding. */
  detail: string;
  /** Severity classification. */
  severity: "low" | "medium" | "high";
};

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/**
 * Converts a 1–5 star rating to a normalised [0, 1] value.
 *
 * @param stars  Integer in [1, 5].
 * @returns      Normalised value: 1→0, 2→0.25, 3→0.5, 4→0.75, 5→1.
 */
export function normalizeStarRating(stars: number): number {
  return (stars - 1) / 4;
}

// ---------------------------------------------------------------------------
// Statistical estimators
// ---------------------------------------------------------------------------

/**
 * Wilson score lower bound for a Bernoulli proportion.
 *
 * Provides a conservative (lower-confidence-interval) estimate of the true
 * positive rate, which penalises small sample sizes naturally — a single
 * 5-star review does not equal a 1,000-review 5-star average.
 *
 * Reference: Wilson, E.B. (1927). "Probable Inference, the Law of Succession,
 * and Statistical Inference." JASA 22(158): 209–212.
 *
 * @param positive  Number of positive (success) events (≥ 0).
 * @param total     Total number of events (≥ 0). Must be ≥ positive.
 * @param z         Z-score for desired confidence level (default 1.96 = 95%).
 * @returns         Wilson lower bound in [0, 1], or 0 when total === 0.
 *
 * @example
 * ```ts
 * wilsonLowerBound(90, 100)  // ≈ 0.833 — much lower than raw 0.90
 * wilsonLowerBound(1, 1)     // ≈ 0.206 — penalises tiny samples
 * wilsonLowerBound(0, 0)     // 0
 * ```
 */
export function wilsonLowerBound(
  positive: number,
  total: number,
  z = 1.96
): number {
  if (total === 0) return 0;
  const phat = positive / total;
  const z2 = z * z;
  const n = total;
  const numerator =
    phat + z2 / (2 * n) - z * Math.sqrt((phat * (1 - phat) + z2 / (4 * n)) / n);
  const denominator = 1 + z2 / n;
  return Math.max(0, numerator / denominator);
}

/**
 * Bayesian average (additive smoothing / shrinkage estimator).
 *
 * Shrinks the observed positive rate toward a prior mean using pseudo-counts.
 * Equivalent to starting with `priorWeight` imaginary observations that have
 * exactly `priorMean` positive rate.
 *
 * This prevents items with very few real ratings from appearing at the top (or
 * bottom) of leaderboards by pulling their score toward the population average.
 *
 * @param positive     Observed positive events.
 * @param total        Observed total events.
 * @param priorMean    Prior belief about the positive rate (e.g. 0.7 = population avg).
 * @param priorWeight  Strength of the prior in pseudo-counts (e.g. 10 = equivalent to
 *                     10 observed ratings at `priorMean`).
 * @returns            Shrinkage estimate of positive rate in [0, 1].
 *
 * @example
 * ```ts
 * bayesianAverage(1, 1, 0.7, 10)  // ≈ 0.636 — pulled toward 0.7
 * bayesianAverage(9, 10, 0.7, 10) // ≈ 0.65  — moderate sample, still shrunk
 * ```
 */
export function bayesianAverage(
  positive: number,
  total: number,
  priorMean: number,
  priorWeight: number
): number {
  const pseudoPositive = priorMean * priorWeight;
  return (pseudoPositive + positive) / (priorWeight + total);
}

// ---------------------------------------------------------------------------
// Recency-weighted mean
// ---------------------------------------------------------------------------

/**
 * Computes a recency-weighted mean of rating values using exponential decay.
 *
 * Each rating's contribution is multiplied by `0.5 ^ (ageDays / halfLifeDays)`,
 * so a rating that is `halfLifeDays` old contributes half as much as a fresh one.
 *
 * @param ratings       Array of `Rating` objects.
 * @param halfLifeDays  Half-life in days (e.g. 30 = ratings halve in weight every month).
 * @returns             Weighted mean in [0, 1], or 0 for an empty array.
 *
 * @example
 * ```ts
 * recencyWeightedMean([
 *   { value: 1, ageDays: 0,  raterId: 'a', subjectId: 'x' },
 *   { value: 0, ageDays: 30, raterId: 'b', subjectId: 'x' },
 * ], 30)
 * // weight(new)=1, weight(old)=0.5 → (1*1 + 0*0.5)/(1+0.5) ≈ 0.667
 * ```
 */
export function recencyWeightedMean(
  ratings: Rating[],
  halfLifeDays: number
): number {
  if (ratings.length === 0) return 0;
  let weightedSum = 0;
  let totalWeight = 0;
  for (const r of ratings) {
    const weight = Math.pow(0.5, r.ageDays / halfLifeDays);
    weightedSum += r.value * weight;
    totalWeight += weight;
  }
  return totalWeight === 0 ? 0 : weightedSum / totalWeight;
}

// ---------------------------------------------------------------------------
// Composite reputation score & badge
// ---------------------------------------------------------------------------

/** Options for `compositeReputation`. */
export type CompositeReputationOpts = {
  /**
   * Half-life in days for recency weighting (default: 60).
   * Shorter = recent ratings matter much more.
   */
  halfLifeDays?: number;
  /**
   * Prior mean for Bayesian shrinkage (default: 0.65 — platform average).
   */
  priorMean?: number;
  /**
   * Pseudo-count weight for Bayesian shrinkage (default: 10).
   */
  priorWeight?: number;
  /**
   * Z-score for Wilson lower bound (default: 1.96 → 95% CI).
   */
  wilsonZ?: number;
};

/**
 * Badge tier thresholds (inclusive lower bound → badge name):
 *
 * | Score (0–100) | Badge  |
 * |---------------|--------|
 * | 0–19          | New    |
 * | 20–39         | Bronze |
 * | 40–59         | Silver |
 * | 60–79         | Gold   |
 * | 80–100        | Elite  |
 */
const BADGE_TIERS: Array<[number, string]> = [
  [80, "Elite"],
  [60, "Gold"],
  [40, "Silver"],
  [20, "Bronze"],
  [0, "New"],
];

function assignBadge(score: number): string {
  for (const [threshold, badge] of BADGE_TIERS) {
    if (score >= threshold) return badge;
  }
  return "New";
}

/**
 * Combines Wilson lower bound, Bayesian shrinkage, and recency weighting into
 * a single 0–100 reputation score with a badge tier label.
 *
 * Formula (equal weights, each component in [0, 1]):
 *   compositeRaw = (wilsonLB + bayesianAvg + recencyMean) / 3
 *   score        = compositeRaw × 100
 *
 * This is intentionally simple and auditable. More elaborate ML models can
 * replace or extend this function later without changing the API.
 *
 * @param ratings  All ratings for a single subject (from any raters).
 * @param opts     Tuning options (all optional).
 * @returns        `{ score, badge, sampleSize }`.
 *
 * @example
 * ```ts
 * const result = compositeReputation(subjectRatings);
 * console.log(`${result.score.toFixed(1)} — ${result.badge}`);
 * ```
 */
export function compositeReputation(
  ratings: Rating[],
  opts: CompositeReputationOpts = {}
): { score: number; badge: string; sampleSize: number } {
  const {
    halfLifeDays = 60,
    priorMean = 0.65,
    priorWeight = 10,
    wilsonZ = 1.96,
  } = opts;

  const n = ratings.length;
  if (n === 0) {
    return { score: 0, badge: "New", sampleSize: 0 };
  }

  // Treat value >= 0.5 as "positive" for Wilson / Bayesian components
  const positive = ratings.filter((r) => r.value >= 0.5).length;

  const wilson = wilsonLowerBound(positive, n, wilsonZ);
  const bayes = bayesianAverage(positive, n, priorMean, priorWeight);
  const recency = recencyWeightedMean(ratings, halfLifeDays);

  const compositeRaw = (wilson + bayes + recency) / 3;
  const score = Math.min(100, Math.max(0, compositeRaw * 100));

  return { score, badge: assignBadge(score), sampleSize: n };
}

// ---------------------------------------------------------------------------
// Anomaly / manipulation detection
// ---------------------------------------------------------------------------

/**
 * Detects plausible rating manipulation in a set of ratings.
 *
 * Three detection strategies:
 *
 * 1. **Reciprocal rating rings** — A rates B high AND B rates A high (≥ 0.75)
 *    repeatedly. Flagged when both parties have ≥ 2 mutual high ratings.
 *
 * 2. **Single-rater dominance** — One rater accounts for > 40% of a subject's
 *    positive ratings (value ≥ 0.5) AND there are at least 5 positive ratings
 *    total. Suggests sybil boosting.
 *
 * 3. **Value burst** — ≥ 5 ratings with identical values arrive with ageDays
 *    in a 3-day window for the same subject, suggesting coordinated review
 *    brigading.
 *
 * @param ratings  All ratings to analyse (may span multiple subjects/raters).
 * @returns        Array of `AnomalyFinding`; empty for clean data.
 */
export function detectRatingAnomalies(ratings: Rating[]): AnomalyFinding[] {
  const findings: AnomalyFinding[] = [];

  // ------------------------------------------------------------------
  // 1. Reciprocal ring detection
  // ------------------------------------------------------------------
  // Build a map: "A->B" => count of high (≥ 0.75) ratings A gave to B
  const highRatingCount = new Map<string, number>();
  for (const r of ratings) {
    if (r.value >= 0.75) {
      const key = `${r.raterId}→${r.subjectId}`;
      highRatingCount.set(key, (highRatingCount.get(key) ?? 0) + 1);
    }
  }

  // Collect unique ordered pairs (A, B) where A < B lexicographically to
  // avoid double-reporting.
  const checkedPairs = new Set<string>();
  for (const r of ratings) {
    if (r.value < 0.75) continue;
    const a = r.raterId;
    const b = r.subjectId;
    const pairKey = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (checkedPairs.has(pairKey)) continue;
    checkedPairs.add(pairKey);

    const aRatesB = highRatingCount.get(`${a}→${b}`) ?? 0;
    const bRatesA = highRatingCount.get(`${b}→${a}`) ?? 0;
    if (aRatesB >= 2 && bRatesA >= 2) {
      findings.push({
        kind: "reciprocal_ring",
        raterId: a,
        subjectId: b,
        detail:
          `Mutual high-rating ring: ${a} rated ${b} high ${aRatesB}x and ` +
          `${b} rated ${a} high ${bRatesA}x.`,
        severity: "high",
      });
    }
  }

  // ------------------------------------------------------------------
  // 2. Single-rater dominance
  // ------------------------------------------------------------------
  // For each subject, count total positives and per-rater positives.
  const subjectPositiveTotal = new Map<string, number>();
  const subjectRaterPositives = new Map<string, Map<string, number>>();

  for (const r of ratings) {
    if (r.value >= 0.5) {
      subjectPositiveTotal.set(
        r.subjectId,
        (subjectPositiveTotal.get(r.subjectId) ?? 0) + 1
      );
      if (!subjectRaterPositives.has(r.subjectId)) {
        subjectRaterPositives.set(r.subjectId, new Map());
      }
      const raterMap = subjectRaterPositives.get(r.subjectId)!;
      raterMap.set(r.raterId, (raterMap.get(r.raterId) ?? 0) + 1);
    }
  }

  const DOMINANCE_THRESHOLD = 0.4;
  const MIN_POSITIVES_FOR_DOMINANCE = 5;

  for (const [subjectId, total] of subjectPositiveTotal) {
    if (total < MIN_POSITIVES_FOR_DOMINANCE) continue;
    const raterMap = subjectRaterPositives.get(subjectId)!;
    for (const [raterId, raterCount] of raterMap) {
      const share = raterCount / total;
      if (share > DOMINANCE_THRESHOLD) {
        findings.push({
          kind: "rater_dominance",
          subjectId,
          raterId,
          detail:
            `${raterId} contributed ${(share * 100).toFixed(1)}% of ${subjectId}'s ` +
            `positive ratings (${raterCount}/${total}).`,
          severity: share > 0.6 ? "high" : "medium",
        });
      }
    }
  }

  // ------------------------------------------------------------------
  // 3. Value burst detection
  // ------------------------------------------------------------------
  // Group ratings by (subjectId, value). Within each group, sliding-window
  // check: if ≥ 5 ratings fall within a 3-day span, flag it.
  type GroupKey = string;
  const burstGroups = new Map<GroupKey, Rating[]>();

  for (const r of ratings) {
    // Round value to 2 dp to group near-identical values robustly.
    const valKey = r.value.toFixed(2);
    const key: GroupKey = `${r.subjectId}|${valKey}`;
    if (!burstGroups.has(key)) burstGroups.set(key, []);
    burstGroups.get(key)!.push(r);
  }

  const BURST_WINDOW_DAYS = 3;
  const BURST_MIN_COUNT = 5;
  const reportedBursts = new Set<string>();

  for (const [key, group] of burstGroups) {
    if (group.length < BURST_MIN_COUNT) continue;
    // Sort ascending by ageDays (smallest = most recent)
    const sorted = [...group].sort((a, b) => a.ageDays - b.ageDays);
    // Sliding window: oldest in window - newest in window <= BURST_WINDOW_DAYS
    for (let i = 0; i <= sorted.length - BURST_MIN_COUNT; i++) {
      const windowEnd = sorted[i + BURST_MIN_COUNT - 1];
      const windowStart = sorted[i];
      if (windowEnd.ageDays - windowStart.ageDays <= BURST_WINDOW_DAYS) {
        if (!reportedBursts.has(key)) {
          reportedBursts.add(key);
          const [subjectId, valStr] = key.split("|");
          findings.push({
            kind: "value_burst",
            subjectId,
            detail:
              `${BURST_MIN_COUNT}+ ratings with value ≈${valStr} on "${subjectId}" ` +
              `within a ${BURST_WINDOW_DAYS}-day window (${group.length} total in group).`,
            severity: "medium",
          });
        }
        break;
      }
    }
  }

  return findings;
}
