// Server-rendered homepage SEO links into public /questions and /for pages.
// Built only from shipped page registries so hrefs never invent missing routes.
import { FOR_PAGES } from "@/lib/forPages";
import { QUESTION_PAGES } from "@/lib/questionPages";

export type HomepageExploreLink = {
  href: string;
  label: string;
  kind: "questions" | "for";
};

/** Compact Explore list: one entry per defined /questions/<slug> and /for/<slug>. */
export function homepageExploreLinks(): HomepageExploreLink[] {
  const questionLinks: HomepageExploreLink[] = QUESTION_PAGES.map((p) => ({
    href: `/questions/${p.slug}`,
    label: p.title,
    kind: "questions",
  }));
  const forLinks: HomepageExploreLink[] = FOR_PAGES.map((p) => ({
    href: `/for/${p.slug}`,
    label: p.label,
    kind: "for",
  }));
  return [...questionLinks, ...forLinks];
}
