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
          <svg width="72" height="43" viewBox="0 0 40 24" fill="none">
            <circle cx="14" cy="12" r="10" stroke="#74386f" strokeWidth="2.4" />
            <circle cx="26" cy="12" r="10" stroke="#f0a060" strokeWidth="2.4" />
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
