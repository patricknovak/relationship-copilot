import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

// Consistent top-of-page block: optional back link, eyebrow, title, lede,
// and an actions slot that sits beside the title on wide screens.
export default function PageHeader({
  back,
  eyebrow,
  title,
  lede,
  actions,
  align = "left",
}: {
  back?: { href: string; label: string };
  eyebrow?: string;
  title: ReactNode;
  lede?: ReactNode;
  actions?: ReactNode;
  align?: "left" | "center";
}) {
  const center = align === "center";
  return (
    <header className={center ? "text-center" : ""}>
      {back && (
        <Link href={back.href} className="back-link mb-3">
          <Icon name="arrow-left" className="h-4 w-4" />
          {back.label}
        </Link>
      )}
      <div className={`flex flex-wrap gap-4 ${center ? "justify-center" : "items-end justify-between"}`}>
        <div className="min-w-0">
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1 className={`${eyebrow ? "mt-2" : ""} text-display-md`}>{title}</h1>
          {lede && <p className={`mt-3 max-w-prose text-base text-ink-soft ${center ? "mx-auto" : ""}`}>{lede}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
