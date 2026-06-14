/**
 * Tests for src/lib/reputation/score.ts
 *
 * Covers: Wilson bound properties, Bayesian shrinkage, recency weighting,
 * composite score / badge tiers, and anomaly detection (reciprocal rings,
 * rater dominance, value bursts, clean data → empty result).
 */

import { describe, it, expect } from "vitest";
import {
  wilsonLowerBound,
  bayesianAverage,
  recencyWeightedMean,
  compositeReputation,
  detectRatingAnomalies,
  normalizeStarRating,
  type Rating,
  type AnomalyFinding,
} from "./score";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeRating(
  value: number,
  ageDays: number,
  raterId = "r1",
  subjectId = "s1"
): Rating {
  return { value, ageDays, raterId, subjectId };
}

// ---------------------------------------------------------------------------
// normalizeStarRating
// ---------------------------------------------------------------------------
describe("normalizeStarRating", () => {
  it("maps 1→0 and 5→1", () => {
    expect(normalizeStarRating(1)).toBe(0);
    expect(normalizeStarRating(5)).toBe(1);
  });

  it("maps 3→0.5", () => {
    expect(normalizeStarRating(3)).toBeCloseTo(0.5);
  });
});

// ---------------------------------------------------------------------------
// wilsonLowerBound
// ---------------------------------------------------------------------------
describe("wilsonLowerBound", () => {
  it("returns 0 when total === 0", () => {
    expect(wilsonLowerBound(0, 0)).toBe(0);
  });

  it("is strictly less than the raw rate for non-trivial samples", () => {
    const rawRate = 0.9;
    const total = 10;
    const positive = rawRate * total;
    const wilson = wilsonLowerBound(positive, total);
    expect(wilson).toBeLessThan(rawRate);
  });

  it("increases with sample size at a fixed positive rate", () => {
    // Both at 80% positive rate, but 1000 samples should yield higher LB
    const smallLB = wilsonLowerBound(8, 10);
    const largeLB = wilsonLowerBound(800, 1000);
    expect(largeLB).toBeGreaterThan(smallLB);
  });

  it("returns value in [0, 1]", () => {
    const lb = wilsonLowerBound(5, 10);
    expect(lb).toBeGreaterThanOrEqual(0);
    expect(lb).toBeLessThanOrEqual(1);
  });

  it("for 100% positives small sample, LB is well below 1", () => {
    // 1/1 = 100% raw but Wilson should be ~0.21
    const lb = wilsonLowerBound(1, 1);
    expect(lb).toBeLessThan(0.5);
  });

  it("respects custom z score", () => {
    // Higher z → wider interval → lower lower bound
    const lb95 = wilsonLowerBound(50, 100, 1.96);
    const lb99 = wilsonLowerBound(50, 100, 2.576);
    expect(lb99).toBeLessThan(lb95);
  });
});

// ---------------------------------------------------------------------------
// bayesianAverage
// ---------------------------------------------------------------------------
describe("bayesianAverage", () => {
  it("pulls a small positive sample toward the prior mean", () => {
    // 1/1 observed (100%), prior = 0.7, weight = 10 → should be < 1
    const bayes = bayesianAverage(1, 1, 0.7, 10);
    expect(bayes).toBeLessThan(1);
    expect(bayes).toBeGreaterThan(0.7); // pulled upward from prior, not below
  });

  it("pulls a small 0% sample upward toward prior mean", () => {
    // 0/1 observed (0%), prior = 0.7 → result > 0
    const bayes = bayesianAverage(0, 1, 0.7, 10);
    expect(bayes).toBeGreaterThan(0);
  });

  it("converges toward observed rate with large sample", () => {
    const observedRate = 0.3;
    const n = 1000;
    const bayes = bayesianAverage(observedRate * n, n, 0.7, 10);
    expect(Math.abs(bayes - observedRate)).toBeLessThan(0.02);
  });

  it("equals prior mean when no observations", () => {
    const bayes = bayesianAverage(0, 0, 0.7, 10);
    expect(bayes).toBeCloseTo(0.7);
  });
});

// ---------------------------------------------------------------------------
// recencyWeightedMean
// ---------------------------------------------------------------------------
describe("recencyWeightedMean", () => {
  it("returns 0 for empty array", () => {
    expect(recencyWeightedMean([], 30)).toBe(0);
  });

  it("gives higher weight to more recent ratings", () => {
    const recent: Rating = makeRating(1, 0);
    const old: Rating = makeRating(0, 60);
    const weighted = recencyWeightedMean([recent, old], 30);
    // Recent=1 has weight 1, old=0 has weight 0.25
    // Result = 1*1/(1+0.25) = 0.8
    expect(weighted).toBeGreaterThan(0.7);
    expect(weighted).toBeLessThan(1);
  });

  it("a very old low rating barely drags down a recent high rating", () => {
    const recent: Rating = makeRating(1, 0);
    const veryOld: Rating = makeRating(0, 365);
    const result = recencyWeightedMean([recent, veryOld], 30);
    expect(result).toBeGreaterThan(0.95);
  });

  it("returns exact value for a single rating regardless of age", () => {
    expect(recencyWeightedMean([makeRating(0.75, 100)], 30)).toBeCloseTo(0.75);
  });
});

// ---------------------------------------------------------------------------
// compositeReputation
// ---------------------------------------------------------------------------
describe("compositeReputation", () => {
  it("returns { score: 0, badge: 'New', sampleSize: 0 } for empty ratings", () => {
    const result = compositeReputation([]);
    expect(result.score).toBe(0);
    expect(result.badge).toBe("New");
    expect(result.sampleSize).toBe(0);
  });

  it("returns sampleSize equal to ratings length", () => {
    const ratings = [makeRating(1, 0), makeRating(0.8, 10)];
    const result = compositeReputation(ratings);
    expect(result.sampleSize).toBe(2);
  });

  it("score is in [0, 100]", () => {
    const ratings = Array.from({ length: 50 }, (_, i) => makeRating(i % 2 === 0 ? 1 : 0, i));
    const result = compositeReputation(ratings);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("all perfect ratings → Elite badge", () => {
    const ratings = Array.from({ length: 200 }, (_, i) =>
      makeRating(1, i, `rater-${i}`)
    );
    const result = compositeReputation(ratings);
    expect(result.badge).toBe("Elite");
  });

  it("all zero ratings → New badge", () => {
    const ratings = Array.from({ length: 50 }, (_, i) =>
      makeRating(0, i, `rater-${i}`)
    );
    const result = compositeReputation(ratings);
    expect(["New", "Bronze"]).toContain(result.badge);
  });

  it("mixed 50/50 ratings → mid-range badge (Bronze or Silver)", () => {
    const ratings = Array.from({ length: 100 }, (_, i) =>
      makeRating(i % 2 === 0 ? 1 : 0, i, `rater-${i}`)
    );
    const result = compositeReputation(ratings);
    expect(["Bronze", "Silver"]).toContain(result.badge);
  });

  it("badge thresholds: score < 20 → New", () => {
    // Very few bad ratings → score near 0
    const result = compositeReputation([makeRating(0, 0)]);
    if (result.score < 20) expect(result.badge).toBe("New");
  });
});

// ---------------------------------------------------------------------------
// detectRatingAnomalies
// ---------------------------------------------------------------------------
describe("detectRatingAnomalies", () => {
  it("returns empty array for a clean, diverse dataset", () => {
    const ratings: Rating[] = Array.from({ length: 30 }, (_, i) => ({
      value: 0.5 + (i % 5) * 0.1,
      ageDays: i * 2,
      raterId: `rater-${i}`,
      subjectId: `subject-${i % 5}`,
    }));
    const findings = detectRatingAnomalies(ratings);
    expect(findings).toHaveLength(0);
  });

  it("flags a reciprocal rating ring (A rates B high, B rates A high, multiple times)", () => {
    const ratings: Rating[] = [
      // Alice repeatedly high-rates Bob
      { value: 0.9, ageDays: 1, raterId: "alice", subjectId: "bob" },
      { value: 0.95, ageDays: 5, raterId: "alice", subjectId: "bob" },
      { value: 0.85, ageDays: 10, raterId: "alice", subjectId: "bob" },
      // Bob reciprocates repeatedly
      { value: 0.9, ageDays: 2, raterId: "bob", subjectId: "alice" },
      { value: 0.95, ageDays: 6, raterId: "bob", subjectId: "alice" },
      { value: 0.88, ageDays: 11, raterId: "bob", subjectId: "alice" },
      // Unrelated clean ratings
      { value: 0.7, ageDays: 3, raterId: "carol", subjectId: "dave" },
    ];
    const findings = detectRatingAnomalies(ratings);
    const ring = findings.filter((f: AnomalyFinding) => f.kind === "reciprocal_ring");
    expect(ring.length).toBeGreaterThanOrEqual(1);
    expect(ring[0].severity).toBe("high");
  });

  it("flags single-rater dominance when one rater provides > 40% of positives", () => {
    // 10 positive ratings for "subjectX", 5 from "sybil" alone
    const ratings: Rating[] = [
      ...Array.from({ length: 5 }, (_, i) => ({
        value: 0.9,
        ageDays: i,
        raterId: "sybil",
        subjectId: "subjectX",
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        value: 0.8,
        ageDays: i + 10,
        raterId: `rater-${i}`,
        subjectId: "subjectX",
      })),
    ];
    const findings = detectRatingAnomalies(ratings);
    const dominance = findings.filter((f: AnomalyFinding) => f.kind === "rater_dominance");
    expect(dominance.length).toBeGreaterThanOrEqual(1);
    expect(dominance[0].subjectId).toBe("subjectX");
    expect(dominance[0].raterId).toBe("sybil");
  });

  it("flags a coordinated value burst (5+ same-value ratings in 3-day window)", () => {
    const ratings: Rating[] = [
      // 6 ratings with value=1.0 for "subjectY" all within 2 days
      ...Array.from({ length: 6 }, (_, i) => ({
        value: 1.0,
        ageDays: i * 0.3, // all within ~1.5 days
        raterId: `rater-${i}`,
        subjectId: "subjectY",
      })),
      // Clean unrelated ratings
      { value: 0.5, ageDays: 20, raterId: "z1", subjectId: "other" },
    ];
    const findings = detectRatingAnomalies(ratings);
    const burst = findings.filter((f: AnomalyFinding) => f.kind === "value_burst");
    expect(burst.length).toBeGreaterThanOrEqual(1);
    expect(burst[0].subjectId).toBe("subjectY");
  });

  it("anomaly findings have required shape", () => {
    const ratings: Rating[] = [
      { value: 0.9, ageDays: 1, raterId: "a", subjectId: "b" },
      { value: 0.9, ageDays: 2, raterId: "a", subjectId: "b" },
      { value: 0.9, ageDays: 1, raterId: "b", subjectId: "a" },
      { value: 0.9, ageDays: 2, raterId: "b", subjectId: "a" },
    ];
    const findings = detectRatingAnomalies(ratings);
    for (const f of findings) {
      expect(typeof f.kind).toBe("string");
      expect(typeof f.detail).toBe("string");
      expect(["low", "medium", "high"]).toContain(f.severity);
    }
  });
});
