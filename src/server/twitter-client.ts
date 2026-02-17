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

    const data = await twitterFetch("/tweet/retweeters", params);
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
  const data = await twitterFetch("/user/check_follow_relationship", {
    source_screen_name: sourceHandle,
    target_screen_name: targetHandle,
  });
  return {
    following: !!data?.following,
    followedBy: !!data?.followed_by,
  };
}

export async function getUserInfo(userName: string): Promise<any> {
  return twitterFetch("/user/info", { userName });
}
