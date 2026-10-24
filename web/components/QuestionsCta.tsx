"use client";

import Link from "next/link";
import { AuthSwitch } from "@/components/AuthHint";
import { pushQuestionsCtaClick } from "@/lib/analytics";
import { QUESTIONS_CTA_LABEL } from "@/lib/questionPages";
import { questionsCtaHrefs } from "@/lib/questionsCta";

/** Primary CTA for /questions pages — fires questions_cta_click when allowed. */
export default function QuestionsCta({
  page,
  listSlug,
  className = "btn-primary !px-7 !py-3",
}: {
  /** Stable page id for the GA4 `page` param (e.g. "partners", "hub"). */
  page: string;
  /** When set, CTA deep-links into starting that question list with a partner. */
  listSlug?: string;
  className?: string;
}) {
  function onClick() {
    pushQuestionsCtaClick(page);
  }

  const { signedIn, signedOut } = questionsCtaHrefs(listSlug);

  return (
    <AuthSwitch
      signedIn={
        <Link href={signedIn} className={className} onClick={onClick}>
          {QUESTIONS_CTA_LABEL}
        </Link>
      }
      signedOut={
        <Link href={signedOut} className={className} onClick={onClick}>
          {QUESTIONS_CTA_LABEL}
        </Link>
      }
    />
  );
}
