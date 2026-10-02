import { ImageResponse } from "next/og";

export const runtime = "edge";
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
            "radial-gradient(900px 500px at 50% -10%, #d4add1 0%, #fbf8f4 55%)",
          color: "#221a22",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <svg width="100" height="72" viewBox="0 0 28 20" fill="none">
            <circle cx="10" cy="10" r="7.5" stroke="#74386f" strokeWidth="2" />
            <circle cx="18" cy="10" r="7.5" stroke="#bb7fb6" strokeWidth="2" />
          </svg>
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 88,
            letterSpacing: "-0.03em",
            display: "flex",
          }}
        >
          You're invited.
        </div>
        <div
          style={{
            marginTop: 22,
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
            marginTop: 36,
            fontSize: 28,
            color: "#74386f",
            fontFamily: "system-ui, sans-serif",
            display: "flex",
          }}
        >
          Closer, on purpose.
        </div>
      </div>
    ),
    size,
  );
}
