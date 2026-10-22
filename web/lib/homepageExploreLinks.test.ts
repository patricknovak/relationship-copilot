import { describe, expect, it } from "vitest";
import { existsSync } from "fs";
import path from "path";
import { FOR_PAGES, forPageBySlug } from "./forPages";
import { homepageExploreLinks } from "./homepageExploreLinks";
import { QUESTION_PAGES, questionPageBySlug } from "./questionPages";

const WEB_ROOT = path.join(__dirname, "..");

describe("homepageExploreLinks", () => {
  it("covers every defined /questions and /for page exactly once", () => {
    const links = homepageExploreLinks();
    const questions = links.filter((l) => l.kind === "questions");
    const fors = links.filter((l) => l.kind === "for");

    expect(questions.map((l) => l.href)).toEqual(
      QUESTION_PAGES.map((p) => `/questions/${p.slug}`),
    );
    expect(fors.map((l) => l.href)).toEqual(
      FOR_PAGES.map((p) => `/for/${p.slug}`),
    );
  });

  it("every homepage explore link target resolves to a defined page or route", () => {
    for (const link of homepageExploreLinks()) {
      expect(link.href.includes("?")).toBe(false);
      expect(link.href.includes("utm_")).toBe(false);

      if (link.kind === "questions") {
        const slug = link.href.replace(/^\/questions\//, "");
        const page = questionPageBySlug(slug);
        expect(page).not.toBeNull();
        expect(page!.title).toBe(link.label);
        expect(
          existsSync(path.join(WEB_ROOT, "app/questions/[slug]/page.tsx")),
        ).toBe(true);
      } else {
        const slug = link.href.replace(/^\/for\//, "");
        const page = forPageBySlug(slug);
        expect(page).not.toBeNull();
        expect(page!.label).toBe(link.label);
        expect(existsSync(path.join(WEB_ROOT, "app/for/[slug]/page.tsx"))).toBe(
          true,
        );
      }
    }
  });
});
