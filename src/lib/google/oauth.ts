import "server-only";
import { createHash, randomBytes } from "node:crypto";
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

export const redirectUri = () => `${env.appUrl()}/api/auth/callback`;

export function createAuthRequest() {
  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: env.googleClientId(),
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    login_hint: env.allowedEmail(),
  }).toString();
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

export async function saveGoogleAccount(
  tokens: TokenResponse,
  profile: { email: string; name?: string; picture?: string },
) {
  const db = await getDb();
  const values = {
    email: profile.email.toLowerCase(),
    name: profile.name ?? null,
    picture: profile.picture ?? null,
    accessToken: encrypt(tokens.access_token),
    expiresAt: new Date(Date.now() + (tokens.expires_in - 60) * 1000),
    scope: tokens.scope,
    updatedAt: new Date(),
    ...(tokens.refresh_token ? { refreshToken: encrypt(tokens.refresh_token) } : {}),
  };
  await db
    .insert(schema.googleAccount)
    .values({ id: 1, ...values })
    .onConflictDoUpdate({ target: schema.googleAccount.id, set: values });
}

export async function getGoogleAccount() {
  const db = await getDb();
  const [row] = await db.select().from(schema.googleAccount).where(eq(schema.googleAccount.id, 1));
  return row ?? null;
}

export class GoogleNotConnectedError extends Error {
  constructor() {
    super("Google is not connected. Sign in with Google from Settings.");
  }
}

/** A valid access token, refreshed when it has expired. */
export async function getAccessToken(): Promise<string> {
  const acc = await getGoogleAccount();
  if (!acc?.accessToken) throw new GoogleNotConnectedError();
  if (acc.expiresAt && acc.expiresAt.getTime() > Date.now()) return decrypt(acc.accessToken);
  if (!acc.refreshToken) throw new GoogleNotConnectedError();
  const tokens = await tokenRequest({
    grant_type: "refresh_token",
    refresh_token: decrypt(acc.refreshToken),
  });
  await saveGoogleAccount(tokens, { email: acc.email, name: acc.name ?? undefined, picture: acc.picture ?? undefined });
  return tokens.access_token;
}

export async function googleFetch(url: string, init: RequestInit = {}) {
  const token = await getAccessToken();
  const res = await fetch(url, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google API ${res.status}: ${text.slice(0, 300)}`);
  }
  return res;
}
