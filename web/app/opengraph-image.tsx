import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt =
  "Relationship Copilot — Closer, on purpose.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Social share card. Pure code (no binary assets); served at /opengraph-image
// and wired into og:image automatically by the App Router.
export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#fbf8f4",
          backgroundImage:
            "radial-gradient(900px 500px at 50% -10%, #d4add1 0%, #fbf8f4 55%)",
          color: "#221a22",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <svg width="120" height="86" viewBox="0 0 28 20" fill="none">
            <circle cx="10" cy="10" r="7.5" stroke="#74386f" strokeWidth="2" />
            <circle cx="18" cy="10" r="7.5" stroke="#bb7fb6" strokeWidth="2" />
          </svg>
        </div>
        <div
          style={{
            marginTop: 28,
            fontSize: 96,
            letterSpacing: "-0.03em",
            display: "flex",
          }}
        >
          Closer, on purpose.
        </div>
        <div
          style={{
            marginTop: 26,
            fontSize: 34,
            color: "#4a3f49",
            fontFamily: "system-ui, sans-serif",
            display: "flex",
          }}
        >
          Answer together · Reveal together · Grow together
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 44,
            fontSize: 28,
            color: "#74386f",
            fontFamily: "system-ui, sans-serif",
            display: "flex",
          }}
        >
          relationshipcopilot.com
        </div>
      </div>
    ),
    size,
  );
}
