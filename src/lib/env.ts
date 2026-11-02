import "server-only";

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}. See .env.example`);
  return v;
}

export const env = {
  appUrl: () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  allowedEmail: () => req("ALLOWED_EMAIL").trim().toLowerCase(),
  sessionSecret: () => {
    const s = req("SESSION_SECRET");
    if (s.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
    return s;
  },
  googleConfigured: () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  googleClientId: () => req("GOOGLE_CLIENT_ID"),
  googleClientSecret: () => req("GOOGLE_CLIENT_SECRET"),
  claudeConfigured: () => Boolean(process.env.ANTHROPIC_API_KEY),
  aiMaxPerHour: () => Number(process.env.AI_MAX_REQUESTS_PER_HOUR ?? 60),
  // Dev login can never be enabled in production builds.
  devLoginEnabled: () => process.env.NODE_ENV !== "production" && process.env.DEV_LOGIN === "true",
};
