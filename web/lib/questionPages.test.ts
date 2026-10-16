import { describe, expect, it } from "vitest";
import {
  QUESTION_PAGES,
  QUESTIONS_BLOCK_COPY,
  QUESTIONS_CTA_HREF,
  QUESTIONS_CTA_LABEL,
  QUESTIONS_SHARED_FAQS,
  QUESTIONS_SIGN_IN_HINT,
  questionPageBySlug,
} from "./questionPages";

describe("questionPages", () => {
  it("exposes partners, friends, and family with 12–15 verbatim questions each", () => {
    expect(QUESTION_PAGES.map((p) => p.slug)).toEqual([
      "partners",
      "friends",
      "family",
    ]);
    for (const page of QUESTION_PAGES) {
      expect(page.questions.length).toBeGreaterThanOrEqual(12);
      expect(page.questions.length).toBeLessThanOrEqual(15);
      for (const q of page.questions) {
        expect(q.text.length).toBeGreaterThan(8);
        expect(q.source.file).toMatch(/supabase\/migrations\//);
      }
    }
  });

  it("uses the required titles and CTA copy", () => {
    expect(questionPageBySlug("partners")?.title).toBe(
      "Questions to ask your partner",
    );
    expect(questionPageBySlug("friends")?.title).toBe(
      "Questions to ask a friend",
    );
    expect(questionPageBySlug("family")?.title).toBe(
      "Questions to ask family",
    );
    expect(QUESTIONS_CTA_LABEL).toBe("Start a connection");
    expect(QUESTIONS_CTA_HREF).toBe("/login?next=/connections/new");
    expect(QUESTIONS_BLOCK_COPY).toContain("honest way");
    expect(QUESTIONS_SIGN_IN_HINT.toLowerCase()).toContain("google");
  });

  it("keeps FAQ answers factual (privacy gate, free safety, $18/mo)", () => {
    expect(QUESTIONS_SHARED_FAQS).toHaveLength(3);
    const blob = QUESTIONS_SHARED_FAQS.map((f) => `${f.q} ${f.a}`).join(" ");
    expect(blob.toLowerCase()).toContain("database");
    expect(blob.toLowerCase()).toMatch(/never paywall|safety.*free|free/);
    expect(blob).toContain("$18/mo");
    expect(blob.toLowerCase()).not.toContain("20 questions");
    expect(blob.toLowerCase()).not.toMatch(/train(ing)? (ai|models)/);
  });

  it("never invents '20 questions' marketing on these pages", () => {
    for (const page of QUESTION_PAGES) {
      const blob = [
        page.title,
        page.metaTitle,
        page.metaDescription,
        page.intro,
        ...page.questions.map((q) => q.text),
      ]
        .join(" ")
        .toLowerCase();
      expect(blob).not.toContain("20 questions");
    }
  });
});
