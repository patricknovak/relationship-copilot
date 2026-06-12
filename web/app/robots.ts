import type { MetadataRoute } from "next";

const SITE =
  process.env.NEXT_PUBLIC_SITE_URL || "https://relationshipcopilot.com";

// Index the public marketing surface; keep private app routes out.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/auth/",
        "/connections",
        "/account",
        "/onboarding",
        "/invite/",
      ],
    },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
