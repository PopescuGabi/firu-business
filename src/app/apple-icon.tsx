import { ImageResponse } from "next/og";
import { LOGO_SVG_FULL } from "@/components/logo";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS home-screen icon: the mark edge to edge (iOS rounds the corners itself).
export default function AppleIcon() {
  const svg = Buffer.from(LOGO_SVG_FULL).toString("base64");
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#6a3df5" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`data:image/svg+xml;base64,${svg}`} width={180} height={180} alt="" />
      </div>
    ),
    size,
  );
}
