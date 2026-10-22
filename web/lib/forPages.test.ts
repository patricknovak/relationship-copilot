import { describe, expect, it } from "vitest";
import { FOR_PAGES, forPageBySlug, forPageFaqs } from "./forPages";
import { questionPageBySlug } from "./questionPages";
import { CONNECTION_TYPES } from "./relationships";

describe("for pages", () => {
  it("covers every relationship type exactly once with unique slugs", () => {
    const types = FOR_PAGES.map((p) => p.type).sort();
    expect(types).toEqual(CONNECTION_TYPES.map((t) => t.value).sort());
    expect(new Set(FOR_PAGES.map((p) => p.slug)).size).toBe(FOR_PAGES.length);
  });

  it("has enough substance per page for a real landing page", () => {
    for (const p of FOR_PAGES) {
      expect(p.samples.length).toBeGreaterThanOrEqual(5);
      expect(p.description.length).toBeLessThanOrEqual(160);
      expect(p.title.length).toBeLessThanOrEqual(60);
      expect(forPageFaqs(p).length).toBeGreaterThanOrEqual(4);
      expect(/^[a-z0-9-]+$/.test(p.slug)).toBe(true);
    }
  });

  it("looks up by slug", () => {
    expect(forPageBySlug("siblings")?.type).toBe("sibling");
    expect(forPageBySlug("nope")).toBeNull();
  });

  it("links every /for page to its /questions page when questionPageBySlug returns a page", () => {
    // Mirrors web/app/for/[slug]/page.tsx: render “See the questions for …”
    // only when the matching /questions page exists (guard kept).
    const linked: string[] = [];
    for (const p of FOR_PAGES) {
      const questionsPage = questionPageBySlug(p.slug);
      expect(questionsPage).not.toBeNull();
      expect(questionsPage!.slug).toBe(p.slug);
      expect(`See the questions for ${questionsPage!.forLabel}`).toMatch(
        /^See the questions for .+/,
      );
      linked.push(p.slug);
    }
    expect(linked).toEqual([
      "partners",
      "friends",
      "siblings",
      "family",
      "parents-and-teens",
      "coworkers",
      "mentors",
    ]);
    expect(questionPageBySlug("nope")).toBeNull();
  });
});
