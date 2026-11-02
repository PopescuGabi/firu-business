import "server-only";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

// Keys you can paste on the Settings page while the site runs on your Mac.
// In production (Vercel) keys are set in the hosting dashboard instead.
export const LOCAL_KEYS = {
  GOOGLE_CLIENT_SECRET: { label: "Google client secret", prefix: "GOCSPX-" },
  ANTHROPIC_API_KEY: { label: "Anthropic API key", prefix: "sk-ant-" },
  // Only used to copy your data online and to build the Vercel settings file; this Mac keeps its local database.
  SUPABASE_DATABASE_URL: { label: "Supabase connection string", prefix: "postgresql://" },
} as const;
export type LocalKey = keyof typeof LOCAL_KEYS;

export const canEditLocalEnv = () => process.env.NODE_ENV !== "production";

export function writeLocalEnv(key: LocalKey, value: string) {
  const file = path.join(process.cwd(), ".env.local");
  const text = readFileSync(file, "utf8");
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, "m");
  writeFileSync(file, re.test(text) ? text.replace(re, () => line) : `${text.trimEnd()}\n${line}\n`, { mode: 0o600 });
  // Takes effect right away, without restarting the site.
  process.env[key] = value;
}

const read = (key: string) => process.env[key] ?? "";

/**
 * Writes .env.vercel (never committed: it matches .env*) with everything Vercel needs,
 * then opens it in TextEdit so it can be copied into Vercel → Settings → Environment Variables.
 */
export async function writeVercelEnvFile(appUrl: string) {
  const { randomBytes } = await import("node:crypto");
  const { execFile } = await import("node:child_process");
  const lines = [
    `APP_URL=${appUrl}`,
    `ALLOWED_EMAIL=${read("ALLOWED_EMAIL")}`,
    `SESSION_SECRET=${randomBytes(36).toString("base64")}`,
    `GOOGLE_CLIENT_ID=${read("GOOGLE_CLIENT_ID")}`,
    `GOOGLE_CLIENT_SECRET=${read("GOOGLE_CLIENT_SECRET")}`,
    `DATABASE_URL=${read("SUPABASE_DATABASE_URL")}`,
    `AI_MAX_REQUESTS_PER_HOUR=${read("AI_MAX_REQUESTS_PER_HOUR") || "60"}`,
    ...(read("ANTHROPIC_API_KEY") ? [`ANTHROPIC_API_KEY=${read("ANTHROPIC_API_KEY")}`] : []),
  ];
  const file = path.join(process.cwd(), ".env.vercel");
  writeFileSync(file, `${lines.join("\n")}\n`, { mode: 0o600 });
  execFile("open", ["-e", file]);
  const missing = ["ALLOWED_EMAIL", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "SUPABASE_DATABASE_URL"].filter((k) => !read(k));
  return missing;
}
