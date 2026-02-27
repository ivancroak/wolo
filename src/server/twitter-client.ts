import "server-only";

const API_BASE = "https://api.twitterapi.io/twitter";
const API_KEY = process.env.TWITTER_API_KEY ?? "";

async function twitterFetch(path: string, params?: Record<string, string>): Promise<any> {
  const url = new URL(`${API_BASE}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString(), {
    headers: { "X-API-Key": API_KEY },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Twitter API ${res.status}: ${text}`);
  }
  return res.json();
}

export async function getRetweeters(tweetId: string, maxPages = 10): Promise<string[]> {
  const handles: string[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const params: Record<string, string> = { tweetId };
    if (cursor) params.cursor = cursor;

    const raw = await twitterFetch("/tweet/retweeters", params);
    const data = raw?.data ?? raw;
    const users: any[] = data?.retweeters ?? data?.users ?? [];
    for (const u of users) {
      const handle = u.userName ?? u.screen_name ?? u.username;
      if (handle) handles.push(handle.toLowerCase());
    }

    const nextCursor = data?.next_cursor ?? data?.cursor;
    if (!nextCursor || users.length === 0) break;
    cursor = nextCursor;
  }

  return handles;
}

export async function checkFollowRelationship(
  sourceHandle: string,
  targetHandle: string,
): Promise<{ following: boolean; followedBy: boolean }> {
  const raw = await twitterFetch("/user/check_follow_relationship", {
    source_screen_name: sourceHandle,
    target_screen_name: targetHandle,
  });
  const data = raw?.data ?? raw;
  return {
    following: !!data?.following,
    followedBy: !!data?.followed_by,
  };
}

export async function getUserInfo(userName: string): Promise<any> {
  const res = await twitterFetch("/user/info", { userName });
  return res?.data ?? res;
}

export async function getUserTweets(userName: string): Promise<{ text: string; id: string; createdAt: string | null }[]> {
  const data = await twitterFetch("/user/last_tweets", { userName, limit: "40" });
  const tweets: any[] = data?.data?.tweets ?? data?.tweets ?? data?.data ?? [];
  return tweets.map((t: any) => ({
    text: t.text ?? t.full_text ?? "",
    id: t.id ?? t.id_str ?? "",
    createdAt: t.created_at ?? t.createdAt ?? null,
  }));
}
