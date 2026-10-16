"use client";

import Link from "next/link";
import { AuthSwitch } from "@/components/AuthHint";
import { pushQuestionsCtaClick } from "@/lib/analytics";
import {
  QUESTIONS_CTA_HREF,
  QUESTIONS_CTA_LABEL,
  QUESTIONS_SIGNED_IN_HREF,
} from "@/lib/questionPages";

/** Primary CTA for /questions pages — fires questions_cta_click when allowed. */
export default function QuestionsCta({
  page,
  className = "btn-primary !px-7 !py-3",
}: {
  /** Stable page id for the GA4 `page` param (e.g. "partners", "hub"). */
  page: string;
  className?: string;
}) {
  function onClick() {
    pushQuestionsCtaClick(page);
  }

  return (
    <AuthSwitch
      signedIn={
        <Link
          href={QUESTIONS_SIGNED_IN_HREF}
          className={className}
          onClick={onClick}
        >
          {QUESTIONS_CTA_LABEL}
        </Link>
      }
      signedOut={
        <Link href={QUESTIONS_CTA_HREF} className={className} onClick={onClick}>
          {QUESTIONS_CTA_LABEL}
        </Link>
      }
    />
  );
}
