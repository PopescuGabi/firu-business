import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { getDb, schema } from "../db";
import { decrypt, encrypt } from "../crypto";
import { env } from "../env";

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/drive.file",
];
// Asked for separately (Settings → Connect Gmail), so signing in never needs Gmail access.
export const GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/gmail.send"];

export const redirectUri = () => `${env.appUrl()}/api/auth/callback`;

/** Google's sign-in address. `extra` adds scopes on top of what was granted before (incremental consent). */
export function createAuthRequest(opts: { extra?: string[]; loginHint?: string } = {}) {
  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  const params: Record<string, string> = {
    client_id: env.googleClientId(),
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: [...GOOGLE_SCOPES, ...(opts.extra ?? [])].join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  };
  if (opts.loginHint) params.login_hint = opts.loginHint;
  url.search = new URLSearchParams(params).toString();
  return { url: url.toString(), state, verifier };
}

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  id_token?: string;
};

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.googleClientId(),
      client_secret: env.googleClientSecret(),
      ...body,
    }),
  });
  if (!res.ok) throw new Error(`Google token request failed (${res.status})`);
  return res.json();
}

export async function exchangeCode(code: string, verifier: string) {
  const tokens = await tokenRequest({
    code,
    code_verifier: verifier,
    grant_type: "authorization_code",
    redirect_uri: redirectUri(),
  });
  const me = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!me.ok) throw new Error("Could not read Google profile");
  const profile = (await me.json()) as {
    email: string;
    email_verified: boolean;
    name?: string;
    picture?: string;
  };
  return { tokens, profile };
}

// Kept in memory between requests on the same server, per person, so Google calls don't each read the database first.
const memo = globalThis as unknown as {
  __hubTokens?: Map<number, { value: string; expiresAt: number }>;
  __hubTokenRefresh?: Map<number, Promise<string>>;
  __hubCalendars?: Map<number, unknown>; // calendar lists (google/calendar.ts)
};
const tokens = (memo.__hubTokens ??= new Map());
const refreshing = (memo.__hubTokenRefresh ??= new Map());
export const calendarMemo = (memo.__hubCalendars ??= new Map());

export async function saveGoogleAccount(uid: number, tok: TokenResponse, profile: { email: string; name?: string; picture?: string }) {
  const db = await getDb();
  const values = {
    email: profile.email.toLowerCase(),
    name: profile.name ?? null,
    picture: profile.picture ?? null,
    accessToken: encrypt(tok.access_token),
    expiresAt: new Date(Date.now() + (tok.expires_in - 60) * 1000),
    scope: tok.scope,
    updatedAt: new Date(),
    ...(tok.refresh_token ? { refreshToken: encrypt(tok.refresh_token) } : {}),
  };
  await db
    .insert(schema.googleAccount)
    .values({ id: uid, ...values })
    .onConflictDoUpdate({ target: schema.googleAccount.id, set: values });
  tokens.set(uid, { value: tok.access_token, expiresAt: values.expiresAt.getTime() });
  calendarMemo.delete(uid); // maybe new permissions: fetch the calendar list again
}

/** This person's Google connection (once per request). */
export const getGoogleAccount = cache(async (uid: number) => {
  const db = await getDb();
  const [row] = await db.select().from(schema.googleAccount).where(eq(schema.googleAccount.id, uid));
  return row ?? null;
});

export const hasScope = (account: { scope: string | null } | null, scope: string) => Boolean(account?.scope?.split(" ").includes(scope));

export class GoogleNotConnectedError extends Error {
  constructor() {
    super("Google is not connected. Sign in with Google from Settings.");
  }
}

/** A valid access token, refreshed when it has expired (or, with `force`, when Google rejected it early). */
export async function getAccessToken(uid: number, force = false): Promise<string> {
  const hit = tokens.get(uid);
  if (!force && hit && hit.expiresAt > Date.now()) return hit.value;
  const db = await getDb();
  const [acc] = await db.select().from(schema.googleAccount).where(eq(schema.googleAccount.id, uid));
  if (!acc?.accessToken) throw new GoogleNotConnectedError();
  if (!force && acc.expiresAt && acc.expiresAt.getTime() > Date.now()) {
    const value = decrypt(acc.accessToken);
    tokens.set(uid, { value, expiresAt: acc.expiresAt.getTime() });
    return value;
  }
  if (!acc.refreshToken) throw new GoogleNotConnectedError();
  // Several Google calls at once share one refresh.
  let p = refreshing.get(uid);
  if (!p) {
    p = tokenRequest({ grant_type: "refresh_token", refresh_token: decrypt(acc.refreshToken) })
      .then(async (tok) => {
        await saveGoogleAccount(uid, { ...tok, scope: tok.scope ?? acc.scope ?? "" }, { email: acc.email, name: acc.name ?? undefined, picture: acc.picture ?? undefined });
        return tok.access_token;
      })
      .finally(() => refreshing.delete(uid));
    refreshing.set(uid, p);
  }
  return p;
}

export async function googleFetch(uid: number, url: string, init: RequestInit = {}) {
  const send = (token: string) => fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } });
  let res = await send(await getAccessToken(uid));
  // Google can cancel an access token before it expires: get a fresh one and try once more.
  if (res.status === 401) {
    tokens.delete(uid);
    res = await send(await getAccessToken(uid, true));
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google API ${res.status}: ${text.slice(0, 300)}`);
  }
  return res;
}

/** Signs this person's account out of Google for the app (used when deleting an account). */
export async function revokeGoogle(uid: number) {
  const db = await getDb();
  const [acc] = await db.select().from(schema.googleAccount).where(eq(schema.googleAccount.id, uid));
  const token = acc?.refreshToken ? decrypt(acc.refreshToken) : acc?.accessToken ? decrypt(acc.accessToken) : null;
  if (token) await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: "POST" }).catch(() => {});
  tokens.delete(uid);
  calendarMemo.delete(uid);
}
