// Initial-based avatars. Deterministic gradient per name so the same person
// always gets the same colour across the app, without storing anything.

const GRADIENTS = [
  "from-brand-500 to-brand-700",
  "from-accent-400 to-rose-500",
  "from-sky-400 to-indigo-500",
  "from-emerald-400 to-teal-600",
  "from-amber-400 to-orange-500",
  "from-fuchsia-400 to-brand-600",
  "from-rose-400 to-brand-500",
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function initialOf(name: string | null | undefined, fallback = "?"): string {
  const n = name?.trim();
  if (!n) return fallback;
  const first = Array.from(n)[0] ?? fallback;
  return first.toUpperCase();
}

export function gradientFor(name: string | null | undefined, variant: "you" | "them" | "auto" = "auto"): string {
  if (variant === "you") return GRADIENTS[0];
  if (variant === "them") return GRADIENTS[1];
  const n = name?.trim() || "someone";
  return GRADIENTS[hash(n) % GRADIENTS.length];
}

const SIZES = {
  xs: "h-6 w-6 text-[11px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
  xl: "h-20 w-20 text-2xl",
} as const;

export function Avatar({
  name,
  size = "md",
  variant = "auto",
  className = "",
  ring = true,
}: {
  name: string | null | undefined;
  size?: keyof typeof SIZES;
  variant?: "you" | "them" | "auto";
  className?: string;
  ring?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full bg-gradient-to-br font-display font-semibold text-white ${
        ring ? "ring-2 ring-surface" : ""
      } ${SIZES[size]} ${gradientFor(name, variant)} ${className}`}
    >
      {initialOf(name)}
    </span>
  );
}

// Two overlapping avatars — the brand mark made of real people.
export function DuoAvatars({
  you,
  them,
  size = "lg",
  className = "",
}: {
  you: string | null | undefined;
  them: string | null | undefined;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center ${className}`}>
      <Avatar name={you} size={size} variant="you" />
      <Avatar name={them} size={size} variant="them" className="-ml-3" />
    </span>
  );
}
