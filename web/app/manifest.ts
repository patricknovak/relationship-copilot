import type { MetadataRoute } from "next";

// Installable web-app manifest — "Add to Home Screen" gets the brand mark
// and theme instead of browser defaults.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Relationship Copilot",
    short_name: "Rel Copilot",
    description:
      "Answer thoughtful questions together — and see each other's answers only when you've both shared.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbf8f4",
    theme_color: "#74386f",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
