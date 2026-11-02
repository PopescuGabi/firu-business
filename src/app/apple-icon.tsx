import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Same artwork as icon.svg.
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" stroke-linejoin="round" stroke-width="2.5"><polygon points="32,6 54.52,19 54.52,45 44.12,39 44.12,25 32,18" fill="#0A84FF" stroke="#0A84FF"/><polygon points="54.52,45 32,58 9.48,45 19.88,39 32,46 44.12,39" fill="#FF9F0A" stroke="#FF9F0A"/><polygon points="9.48,45 9.48,19 32,6 32,18 19.88,25 19.88,39" fill="#30D158" stroke="#30D158"/><polygon points="32,6 36.5,8.6 34.42,19.4 32,18" fill="#000" fill-opacity="0.2"/><polygon points="54.52,45 50.02,47.6 41.7,40.4 44.12,39" fill="#000" fill-opacity="0.2"/><polygon points="9.48,45 9.48,39.8 19.88,36.2 19.88,39" fill="#000" fill-opacity="0.2"/></svg>`;

// iOS home-screen icon: the logo on a white tile (iOS rounds the corners itself).
export default function AppleIcon() {
  const svg = Buffer.from(LOGO_SVG).toString("base64");
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#ffffff" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`data:image/svg+xml;base64,${svg}`} width={128} height={128} alt="" />
      </div>
    ),
    size,
  );
}
