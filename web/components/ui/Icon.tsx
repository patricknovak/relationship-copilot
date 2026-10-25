import type { ConnectionType } from "@/lib/database.types";

// One consistent stroke icon set — no dependency, same 24px grid everywhere.
// Add names here rather than inlining SVG in pages so weight and corners match.
export type IconName =
  | "heart"
  | "users"
  | "home"
  | "briefcase"
  | "sprout"
  | "rings"
  | "compass"
  | "sparkles"
  | "lock"
  | "book"
  | "flame"
  | "chat"
  | "share"
  | "copy"
  | "check"
  | "chevron-right"
  | "chevron-left"
  | "arrow-right"
  | "arrow-left"
  | "plus"
  | "calendar"
  | "bell"
  | "user"
  | "shield"
  | "mail"
  | "message"
  | "phone"
  | "send"
  | "star"
  | "eye-off"
  | "clock"
  | "lifebuoy"
  | "x"
  | "menu"
  | "grid"
  | "history"
  | "download"
  | "external"
  | "sun"
  | "moon"
  | "layers"
  | "wand";

const PATHS: Record<IconName, React.ReactNode> = {
  heart: <path d="M12 20.5s-7-4.4-9-8.6C1.5 8.6 3.2 5.5 6.3 5.1c2-.3 3.8.8 4.7 2.3.2.4.4.8.5 1.2.4-1.8 2-3.3 4-3.5 3-.3 4.9 2.6 4.3 5.3-1 4.3-7.8 10.1-7.8 10.1Z" />,
  users: (
    <>
      <circle cx="9" cy="8.5" r="3.5" />
      <path d="M2.5 19.5c.6-3.3 3.3-5 6.5-5s5.9 1.7 6.5 5" />
      <circle cx="17" cy="9.5" r="2.5" />
      <path d="M17.5 14.5c2.3.2 3.7 1.6 4 4" />
    </>
  ),
  home: (
    <>
      <path d="M3.5 11 12 4l8.5 7" />
      <path d="M6 9.8V20h12V9.8" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7.5" width="18" height="12" rx="2.5" />
      <path d="M9 7.5V5.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5.5v2M3 12.5h18" />
    </>
  ),
  sprout: (
    <>
      <path d="M12 21v-8" />
      <path d="M12 13c0-3.5 2.5-6 6.5-6 0 3.8-2.6 6-6.5 6Z" />
      <path d="M12 16c0-2.8-2-4.8-5.5-4.8 0 3 2.2 4.8 5.5 4.8Z" />
    </>
  ),
  rings: (
    <>
      <circle cx="9.5" cy="12" r="6" />
      <circle cx="14.5" cy="12" r="6" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18.5l-1.8-5.9L4.5 10.8 10.2 9z" />
      <path d="M19 16.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7zM5 2.5l.6 1.6 1.6.6-1.6.6L5 7l-.6-1.7-1.6-.6 1.6-.6z" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  book: <path d="M12 6.5C10.5 5 8.4 4.5 4 4.5v13c4.4 0 6.5.5 8 2 1.5-1.5 3.6-2 8-2v-13c-4.4 0-6.5.5-8 2ZM12 6.5v13" />,
  flame: <path d="M12 21c3.9 0 6.5-2.5 6.5-6 0-4-3.5-6.5-4.5-9.5-2 1.5-2.6 3.6-2.5 5.5-1-.6-2-1.8-2.3-3C7.6 9.6 5.5 11.6 5.5 15c0 3.5 2.6 6 6.5 6Z" />,
  chat: <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5z" />,
  share: (
    <>
      <path d="M12 15V3.5" />
      <path d="m8 7.5 4-4 4 4" />
      <path d="M5 12v6.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V12" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2.5" />
      <path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  "chevron-right": <path d="m9 6 6 6-6 6" />,
  "chevron-left": <path d="m15 6-6 6 6 6" />,
  "arrow-right": (
    <>
      <path d="M4 12h16" />
      <path d="m13 5 7 7-7 7" />
    </>
  ),
  "arrow-left": (
    <>
      <path d="M20 12H4" />
      <path d="m11 5-7 7 7 7" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="4" />
      <path d="M4.5 20c.7-3.8 3.8-6 7.5-6s6.8 2.2 7.5 6" />
    </>
  ),
  shield: <path d="M12 3.5 5 6.2v5.3c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6.2z" />,
  mail: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
      <path d="m4 7.5 8 5.5 8-5.5" />
    </>
  ),
  message: <path d="M4 7A2.5 2.5 0 0 1 6.5 4.5h11A2.5 2.5 0 0 1 20 7v6a2.5 2.5 0 0 1-2.5 2.5H9.5L5 19.5v-4A2.5 2.5 0 0 1 4 13z" />,
  phone: <path d="M6.5 3.5h3l1.5 4-2 1.5a11 11 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2 2C10.4 19.5 4.5 13.6 4.5 5.5a2 2 0 0 1 2-2Z" />,
  send: (
    <>
      <path d="M20.5 3.5 3.5 10l7.5 2.5 2.5 7.5z" />
      <path d="M11 12.5 20.5 3.5" />
    </>
  ),
  star: <path d="m12 3.5 2.6 5.4 6 .8-4.4 4.2 1.1 5.9L12 17l-5.3 2.8 1.1-5.9-4.4-4.2 6-.8z" />,
  "eye-off": (
    <>
      <path d="M3 3l18 18" />
      <path d="M10.6 5.3A10.3 10.3 0 0 1 12 5.2c5 0 8.5 4.3 9.5 6.8-.4.9-1.1 2.1-2.2 3.2M6.6 6.7C4.3 8.2 2.9 10.5 2.5 12c1 2.5 4.5 6.8 9.5 6.8 1.6 0 3-.4 4.3-1.1" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  lifebuoy: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="m6 6 3.5 3.5M18 6l-3.5 3.5M18 18l-3.5-3.5M6 18l3.5-3.5" />
    </>
  ),
  x: <path d="M6 6l12 12M18 6 6 18" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  grid: (
    <>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
    </>
  ),
  history: (
    <>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6" />
      <path d="M3.5 4.5V9H8M12 8v4.5l3 1.5" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v11" />
      <path d="m8 11 4 4 4-4" />
      <path d="M5 19.5h14" />
    </>
  ),
  external: (
    <>
      <path d="M14 4.5h5.5V10" />
      <path d="M19.5 4.5 11 13" />
      <path d="M17 13.5v5a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 4 18.5v-10A1.5 1.5 0 0 1 5.5 7h5" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />,
  layers: (
    <>
      <path d="m12 4 8.5 4.5L12 13 3.5 8.5z" />
      <path d="m3.5 12.5 8.5 4.5 8.5-4.5M3.5 16.5 12 21l8.5-4.5" />
    </>
  ),
  wand: (
    <>
      <path d="m4 20 11-11" />
      <path d="M15 4v2M19 8h2M17.5 5.5l1.4-1.4M12.5 5.5l-1.4-1.4M19.5 10.5l1.4 1.4" />
    </>
  ),
};

export function Icon({
  name,
  className = "h-5 w-5",
  strokeWidth = 1.8,
}: {
  name: IconName;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  );
}

// One icon per relationship type, used wherever a connection is listed.
export const TYPE_ICON: Record<ConnectionType, IconName> = {
  romantic: "heart",
  friend: "users",
  family: "home",
  coworker: "briefcase",
  parent_child: "sprout",
  sibling: "rings",
  mentor: "compass",
};

// A soft tint per type so a list of connections reads at a glance.
export const TYPE_TINT: Record<ConnectionType, string> = {
  romantic: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200",
  friend: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200",
  family: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  coworker: "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-200",
  parent_child: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  sibling: "bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200",
  mentor: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200",
};
