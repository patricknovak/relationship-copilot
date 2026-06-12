import type { MetadataRoute } from "next";

// Installable web-app manifest — "Add to Home Screen" gets the brand mark
// and theme instead of browser defaults.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Relationship Copilot",
    short_name: "Copilot",
    description:
      "Answer thoughtful questions together — and see each other's answers only when you've both shared.",
    start_url: "/connections",
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
    ],
  };
}
