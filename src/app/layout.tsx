import type { Metadata, Viewport } from "next";
import "./globals.css";
import { APP_NAME } from "@/lib/brand";
import { Instrument_Serif } from "next/font/google";
import { THEME_SCRIPT } from "@/lib/theme";

// The display serif for page titles (the Silk look); body text stays the system font.
const display = Instrument_Serif({ weight: "400", subsets: ["latin", "latin-ext"], variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  robots: { index: false, follow: false },
  // Google Search Console ownership check (needed for Google's OAuth app verification).
  verification: process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : undefined,
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eceef2" },
    { media: "(prefers-color-scheme: dark)", color: "#05040a" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The theme script sets data-theme before React loads, hence suppressHydrationWarning.
    <html lang="en" suppressHydrationWarning className={display.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
