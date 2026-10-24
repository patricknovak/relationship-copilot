// CTA / start-path helpers for public /questions pages.
// Carries the chosen list into /connections/new (and invite copy) via
// same-origin `next` + `list` — no product claims beyond existing titles.

import { forPageBySlug } from "@/lib/forPages";
import { questionPageBySlug } from "@/lib/questionPages";

/** App path that starts a connection for a questions page (hub = no list). */
export function questionsStartPath(listSlug?: string | null): string {
  if (!listSlug) return "/connections/new";
  const page = questionPageBySlug(listSlug);
  const forPage = page ? forPageBySlug(page.forSlug) : null;
  if (!page || !forPage) return "/connections/new";
  const params = new URLSearchParams({
    type: forPage.type,
    list: page.slug,
  });
  return `/connections/new?${params.toString()}`;
}

/** Signed-out CTA: login with a safe relative `next` to the start path. */
export function questionsCtaLoginHref(listSlug?: string | null): string {
  const next = questionsStartPath(listSlug);
  return `/login?next=${encodeURIComponent(next)}`;
}

/** Signed-in vs signed-out hrefs for QuestionsCta. */
export function questionsCtaHrefs(listSlug?: string | null): {
  signedIn: string;
  signedOut: string;
} {
  return {
    signedIn: questionsStartPath(listSlug),
    signedOut: questionsCtaLoginHref(listSlug),
  };
}

/** Accept only known question-list slugs (from `?list=`). */
export function parseQuestionsListParam(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const page = questionPageBySlug(raw);
  return page ? page.slug : null;
}

/**
 * Invite-step copy when the user arrived from a public question list.
 * Factual: uses existing forLabel + page title only.
 */
export function questionsInviteCopy(listSlug: string | null | undefined): string | null {
  const slug = parseQuestionsListParam(listSlug);
  if (!slug) return null;
  const page = questionPageBySlug(slug);
  if (!page) return null;
  return `Invite ${page.forLabel} to answer "${page.title}" together`;
}
