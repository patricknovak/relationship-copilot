import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";

export default function EmptyState({
  icon = "rings",
  title,
  body,
  children,
}: {
  icon?: IconName;
  title: string;
  body?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="card-dashed">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-surface text-brand-700 shadow-soft dark:text-brand-200">
        <Icon name={icon} className="h-7 w-7" />
      </span>
      <p className="mt-4 font-display text-xl text-ink">{title}</p>
      {body && <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">{body}</p>}
      {children && <div className="mt-5 flex flex-wrap items-center justify-center gap-3">{children}</div>}
    </div>
  );
}
