import type { MetadataRoute } from "next";
import { canonicalUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

// Public marketing pages plus published free library articles. Auth-only
// surfaces (connections, account) stay out. Premium articles are excluded even
// when a signed-in Premium session would otherwise see them via RLS.
const STATIC: MetadataRoute.Sitemap = [
  { url: canonicalUrl("/"), changeFrequency: "weekly", priority: 1 },
  { url: canonicalUrl("/about"), changeFrequency: "monthly", priority: 0.7 },
  { url: canonicalUrl("/pricing"), changeFrequency: "monthly", priority: 0.8 },
  { url: canonicalUrl("/safety"), changeFrequency: "monthly", priority: 0.8 },
  { url: canonicalUrl("/library"), changeFrequency: "weekly", priority: 0.7 },
  { url: canonicalUrl("/login"), changeFrequency: "yearly", priority: 0.5 },
  { url: canonicalUrl("/privacy"), changeFrequency: "yearly", priority: 0.3 },
  { url: canonicalUrl("/terms"), changeFrequency: "yearly", priority: 0.3 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticEntries = STATIC.map((entry) => ({
    ...entry,
    lastModified: now,
  }));

  try {
    const supabase = await createClient();
    const { data: articles, error } = await supabase
      .from("education_articles")
      .select("slug, created_at")
      .eq("published", true)
      .eq("is_premium", false)
      .order("slug", { ascending: true });

    if (error || !articles) {
      return staticEntries;
    }

    const articleEntries: MetadataRoute.Sitemap = articles.map((a) => ({
      url: canonicalUrl(`/library/${a.slug}`),
      lastModified: a.created_at ? new Date(a.created_at) : now,
      changeFrequency: "monthly",
      priority: 0.6,
    }));

    return [...staticEntries, ...articleEntries];
  } catch {
    // Sitemap must never crash the route — fall back to marketing URLs only.
    return staticEntries;
  }
}
