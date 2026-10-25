import { ImageResponse } from "next/og";

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
          alignItems: "flex-start",
          justifyContent: "space-between",
          padding: "64px 72px",
          backgroundColor: "#fbf8f4",
          backgroundImage:
            "radial-gradient(700px 420px at 15% 0%, rgba(187,127,182,0.55) 0%, rgba(251,248,244,0) 60%), radial-gradient(640px 400px at 90% 100%, rgba(253,186,116,0.45) 0%, rgba(251,248,244,0) 60%)",
          color: "#221a22",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg width="84" height="50" viewBox="0 0 40 24" fill="none">
            <circle cx="14" cy="12" r="10" stroke="#74386f" strokeWidth="2.4" />
            <circle cx="26" cy="12" r="10" stroke="#f0a060" strokeWidth="2.4" />
          </svg>
          <div
            style={{
              fontSize: 30,
              color: "#74386f",
              fontFamily: "system-ui, sans-serif",
              fontWeight: 600,
              letterSpacing: "-0.01em",
              display: "flex",
            }}
          >
            Relationship Copilot
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 104,
              lineHeight: 1.02,
              letterSpacing: "-0.035em",
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
            Answer in private · Reveal together · Grow together
          </div>
        </div>
        <div style={{ display: "flex", gap: 14, fontFamily: "system-ui, sans-serif" }}>
          {["Partners", "Friends", "Family", "Coworkers", "Mentors"].map((t) => (
            <div
              key={t}
              style={{
                display: "flex",
                padding: "10px 20px",
                borderRadius: 999,
                border: "2px solid rgba(116,56,111,0.35)",
                color: "#74386f",
                fontSize: 24,
                fontWeight: 600,
              }}
            >
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
