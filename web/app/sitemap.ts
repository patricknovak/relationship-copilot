import type { MetadataRoute } from "next";
import { canonicalUrl } from "@/lib/site";

// Public marketing pages only — everything behind auth (library articles,
// connections) is deliberately not listed. URLs match rel=canonical.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: canonicalUrl("/"), lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: canonicalUrl("/about"), lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: canonicalUrl("/pricing"), lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: canonicalUrl("/safety"), lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: canonicalUrl("/library"), lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: canonicalUrl("/login"), lastModified: now, changeFrequency: "yearly", priority: 0.5 },
    { url: canonicalUrl("/privacy"), lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: canonicalUrl("/terms"), lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
