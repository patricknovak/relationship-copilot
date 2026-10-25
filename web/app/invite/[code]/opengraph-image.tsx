import { ImageResponse } from "next/og";

export const alt = "You're invited to Relationship Copilot";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Invite-specific OG card. Intentionally static — no inviter name, relationship
// type, or invite code — because unfurl caches can persist previews.
export default function InviteOgImage() {
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
            "radial-gradient(700px 420px at 15% 0%, rgba(187,127,182,0.55) 0%, rgba(251,248,244,0) 60%), radial-gradient(640px 400px at 90% 100%, rgba(253,186,116,0.45) 0%, rgba(251,248,244,0) 60%)",
          color: "#221a22",
          fontFamily: "Georgia, serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "56px 80px",
            borderRadius: 48,
            background: "rgba(255,255,255,0.72)",
            border: "2px solid rgba(116,56,111,0.18)",
            boxShadow: "0 30px 80px rgba(116,56,111,0.18)",
          }}
        >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <svg width="76" height="76" viewBox="0 0 512 512">
            <defs>
              <linearGradient id="og-tile" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#6b3366" />
                <stop offset="0.55" stopColor="#4a2247" />
                <stop offset="1" stopColor="#2a1230" />
              </linearGradient>
              <linearGradient id="og-a" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#fbf1fa" />
                <stop offset="1" stopColor="#d9a9d5" />
              </linearGradient>
              <linearGradient id="og-b" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#ffd1a3" />
                <stop offset="1" stopColor="#f97316" />
              </linearGradient>
              <radialGradient id="og-lens" cx="0.5" cy="0.38" r="0.75">
                <stop offset="0" stopColor="#fff4e6" />
                <stop offset="0.55" stopColor="#fdba74" />
                <stop offset="1" stopColor="#f97316" />
              </radialGradient>
            </defs>
            <rect width="512" height="512" rx="116" fill="url(#og-tile)" />
            <path d="M256 154.4 A118 118 0 0 1 256 357.6 A118 118 0 0 1 256 154.4 Z" fill="url(#og-lens)" />
            <circle cx="196" cy="256" r="118" fill="none" stroke="url(#og-a)" strokeWidth="34" />
            <circle cx="316" cy="256" r="118" fill="none" stroke="url(#og-b)" strokeWidth="34" />
            <path d="M235.6 144.8 A118 118 0 0 1 274.3 167.8" fill="none" stroke="url(#og-a)" strokeWidth="34" />
            <circle cx="238" cy="206" r="13" fill="#ffffff" opacity="0.85" />
          </svg>
          <div
            style={{
              fontSize: 26,
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
          <div
            style={{
              marginTop: 36,
              fontSize: 96,
              letterSpacing: "-0.035em",
              lineHeight: 1,
              display: "flex",
            }}
          >
            {"You're invited."}
          </div>
          <div
            style={{
              marginTop: 26,
              fontSize: 32,
              color: "#4a3f49",
              fontFamily: "system-ui, sans-serif",
              display: "flex",
            }}
          >
            Answer in private. Reveal together.
          </div>
          <div
            style={{
              marginTop: 30,
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 22px",
              borderRadius: 999,
              background: "#74386f",
              color: "white",
              fontSize: 24,
              fontWeight: 600,
              fontFamily: "system-ui, sans-serif",
            }}
          >
            Open your invite →
          </div>
        </div>
      </div>
    ),
    size,
  );
}
