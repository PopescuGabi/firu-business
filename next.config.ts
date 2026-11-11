import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Strict CSP: only this site, Google APIs (direct Drive uploads) and Google images.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.googleusercontent.com https://drive.google.com https://*.cdninstagram.com https://*.fbcdn.net",
  "font-src 'self' data:",
  // blob: lets the AI video maker read picked clips; remotion.pro receives the free-licence render count (no content).
  "connect-src 'self' blob: data: https://www.googleapis.com https://www.remotion.pro",
  "media-src 'self' blob: data:", // AI video maker: preview clips, music beds and exported MP4s
  "worker-src 'self' blob:", // Remotion's in-browser renderer keeps a small blob worker alive
  "frame-src https://drive.google.com https://gabi-popescu.vercel.app", // Drive's video/PDF player; the live portfolio site preview (Portfolio tab)
  "frame-ancestors 'none'",
  "form-action 'self' https://accounts.google.com",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite"],
  // Migrations run on first request, so ship them with every server function.
  outputFileTracingIncludes: { "/**": ["./drizzle/**/*"] },
  poweredByHeader: false,
  // Prompt files are uploaded through server actions.
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
