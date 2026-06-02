import { sunSign, type SunSign } from "@/lib/zodiac";

// Zodiac "compatibility" — ENTERTAINMENT ONLY, by element. Never informs real
// guidance; always shown with the zodiac disclaimer.
type Level = "high" | "medium" | "low";

const BLURB: Record<Level, string> = {
  high: "a naturally easy, complementary vibe ✨",
  medium: "different energies that can balance each other",
  low: "opposites that keep things interesting",
};

function elementLevel(a: SunSign["element"], b: SunSign["element"]): Level {
  if (a === b) return "high";
  const pair = new Set([a, b]);
  const isPair = (x: string, y: string) => pair.has(x as never) && pair.has(y as never);
  if (isPair("Fire", "Air") || isPair("Earth", "Water")) return "high";
  if (isPair("Fire", "Water") || isPair("Earth", "Air")) return "low";
  return "medium";
}

export function zodiacCompatibility(
  birthday1: string | null | undefined,
  birthday2: string | null | undefined,
): { level: Level; blurb: string; signs: [string, string] } | null {
  const s1 = sunSign(birthday1);
  const s2 = sunSign(birthday2);
  if (!s1 || !s2) return null;
  const level = elementLevel(s1.element, s2.element);
  return {
    level,
    blurb: `${s1.name} & ${s2.name} — ${BLURB[level]}`,
    signs: [s1.name, s2.name],
  };
}
