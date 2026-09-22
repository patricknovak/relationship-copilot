import type { MetadataRoute } from "next";
import { CANONICAL_ORIGIN } from "@/lib/site";

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
    sitemap: `${CANONICAL_ORIGIN}/sitemap.xml`,
  };
}
