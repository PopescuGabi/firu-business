import "server-only";
import { env } from "../env";
import { BASIC_METRICS, dayRange, kindOf, metricsFor, tokenFrom, type InsightItem, type IgKind } from "./parse";

// Instagram API with Instagram Login (Business and Creator accounts, no Facebook Page needed).
const GRAPH = "https://graph.instagram.com";
export const IG_SCOPES = ["instagram_business_basic", "instagram_business_manage_insights"];

export class IgError extends Error {
  constructor(message: string, public code?: number, public status = 502) {
    super(message);
  }
}

export const instagramConfigured = () => Boolean(process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_SECRET);
const appId = () => process.env.INSTAGRAM_APP_ID ?? "";
const appSecret = () => process.env.INSTAGRAM_APP_SECRET ?? "";
export const redirectUri = () => `${env.appUrl()}/api/instagram/callback`;

export function authorizeUrl(state: string) {
  const q = new URLSearchParams({ client_id: appId(), redirect_uri: redirectUri(), response_type: "code", scope: IG_SCOPES.join(","), state });
  return `https://www.instagram.com/oauth/authorize?${q}`;
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(20_000) });
  const body = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: number; type?: string } };
  if (!res.ok || body.error) {
    const e = body.error;
    // 190 = token expired or revoked; 10 / 100 = metric not available for this item; 4, 17, 32, 613, 80002 = rate limits.
    throw new IgError(e?.message ?? `Instagram request failed (${res.status})`, e?.code, e?.code === 190 ? 401 : res.status === 400 ? 400 : 502);
  }
  return body as T;
}

/** Code → short-lived token → long-lived token (60 days). Runs on the server only (uses the app secret). */
export async function exchangeCode(code: string) {
  const form = new URLSearchParams({ client_id: appId(), client_secret: appSecret(), grant_type: "authorization_code", redirect_uri: redirectUri(), code });
  const short = tokenFrom(await call("https://api.instagram.com/oauth/access_token", { method: "POST", body: form }));
  if (!short) throw new IgError("Instagram didn't return a token");
  const long = await call<{ access_token: string; expires_in: number }>(
    `${GRAPH}/access_token?${new URLSearchParams({ grant_type: "ig_exchange_token", client_secret: appSecret(), access_token: short.accessToken })}`,
  );
  return { token: long.access_token, expiresAt: new Date(Date.now() + (long.expires_in ?? 5_184_000) * 1000) };
}

/** A fresh 60-day token (the current one must be at least a day old and not expired). */
export async function refreshToken(token: string) {
  const r = await call<{ access_token: string; expires_in: number }>(`${GRAPH}/refresh_access_token?${new URLSearchParams({ grant_type: "ig_refresh_token", access_token: token })}`);
  return { token: r.access_token, expiresAt: new Date(Date.now() + (r.expires_in ?? 5_184_000) * 1000) };
}

export type IgProfile = { id?: string; user_id: string; username: string; name?: string; profile_picture_url?: string; followers_count?: number; media_count?: number; account_type?: string };
export const getProfile = (token: string) =>
  call<IgProfile>(`${GRAPH}/me?${new URLSearchParams({ fields: "id,user_id,username,name,profile_picture_url,followers_count,media_count,account_type", access_token: token })}`);

export type IgMediaItem = {
  id: string;
  caption?: string;
  media_type?: string;
  media_product_type?: string;
  timestamp: string;
  permalink?: string;
  thumbnail_url?: string;
  media_url?: string;
  like_count?: number;
  comments_count?: number;
};

/** The most recent posts (not stories), newest first, up to `max`. */
export async function listMedia(token: string, max = 300) {
  const out: IgMediaItem[] = [];
  let url: string | null = `${GRAPH}/me/media?${new URLSearchParams({
    fields: "id,caption,media_type,media_product_type,timestamp,permalink,thumbnail_url,media_url,like_count,comments_count",
    limit: "50",
    access_token: token,
  })}`;
  while (url && out.length < max) {
    const page: { data?: IgMediaItem[]; paging?: { next?: string } } = await call(url);
    out.push(...(page.data ?? []));
    url = page.paging?.next ?? null;
  }
  return out.slice(0, max).filter((m) => kindOf(m));
}

/** A post's insights; if Instagram refuses a metric for this post, retries with the basic set. */
export async function mediaInsights(token: string, mediaId: string, kind: IgKind): Promise<InsightItem[]> {
  const get = (metrics: string[]) =>
    call<{ data?: InsightItem[] }>(`${GRAPH}/${encodeURIComponent(mediaId)}/insights?${new URLSearchParams({ metric: metrics.join(","), access_token: token })}`).then((r) => r.data ?? []);
  try {
    return await get(metricsFor(kind));
  } catch (err) {
    if (err instanceof IgError && err.code === 190) throw err;
    try {
      return await get(BASIC_METRICS);
    } catch (e) {
      if (e instanceof IgError && e.code === 190) throw e;
      return [];
    }
  }
}

/** Account totals for one UTC day; follows/unfollows are a separate call that only works with 100+ followers. */
export async function accountDay(token: string, igUserId: string, date: string) {
  const { since, until } = dayRange(date);
  const q = (extra: Record<string, string>) =>
    new URLSearchParams({ period: "day", metric_type: "total_value", since: String(since), until: String(until), access_token: token, ...extra });
  const main = await call<{ data?: InsightItem[] }>(
    `${GRAPH}/${encodeURIComponent(igUserId)}/insights?${q({ metric: "reach,views,total_interactions,likes,comments,shares,saves,profile_links_taps" })}`,
  ).then((r) => r.data ?? []);
  const follows = await call<{ data?: InsightItem[] }>(`${GRAPH}/${encodeURIComponent(igUserId)}/insights?${q({ metric: "follows_and_unfollows", breakdown: "follow_type" })}`)
    .then((r) => r.data ?? [])
    .catch(() => undefined);
  return { main, follows };
}
