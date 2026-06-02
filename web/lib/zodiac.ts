// Zodiac is included purely as a fun, social layer. It is entertainment, not
// science, and is NEVER used as input to relationship guidance, the Blueprint,
// or any green/red-flag reflection. Keep this framing wherever signs appear.
export const ZODIAC_DISCLAIMER =
  "Just for fun — astrology is entertainment, not science. We never use it in your relationship guidance.";

export interface SunSign {
  name: string;
  symbol: string;
  element: "Fire" | "Earth" | "Air" | "Water";
  blurb: string;
}

const META: Record<string, Omit<SunSign, "name">> = {
  Aquarius: { symbol: "♒", element: "Air", blurb: "Independent and inventive." },
  Pisces: { symbol: "♓", element: "Water", blurb: "Imaginative and empathetic." },
  Aries: { symbol: "♈", element: "Fire", blurb: "Bold and energetic." },
  Taurus: { symbol: "♉", element: "Earth", blurb: "Steady and devoted." },
  Gemini: { symbol: "♊", element: "Air", blurb: "Curious and expressive." },
  Cancer: { symbol: "♋", element: "Water", blurb: "Caring and intuitive." },
  Leo: { symbol: "♌", element: "Fire", blurb: "Warm and generous." },
  Virgo: { symbol: "♍", element: "Earth", blurb: "Thoughtful and practical." },
  Libra: { symbol: "♎", element: "Air", blurb: "Harmonious and fair." },
  Scorpio: { symbol: "♏", element: "Water", blurb: "Passionate and loyal." },
  Sagittarius: { symbol: "♐", element: "Fire", blurb: "Adventurous and optimistic." },
  Capricorn: { symbol: "♑", element: "Earth", blurb: "Grounded and ambitious." },
};

// Sign start cutoffs, indexed by month (entry i is the sign beginning that month).
const CUTOFFS = [
  { d: 20, name: "Aquarius" },   // Jan
  { d: 19, name: "Pisces" },     // Feb
  { d: 21, name: "Aries" },      // Mar
  { d: 20, name: "Taurus" },     // Apr
  { d: 21, name: "Gemini" },     // May
  { d: 21, name: "Cancer" },     // Jun
  { d: 23, name: "Leo" },        // Jul
  { d: 23, name: "Virgo" },      // Aug
  { d: 23, name: "Libra" },      // Sep
  { d: 23, name: "Scorpio" },    // Oct
  { d: 22, name: "Sagittarius" },// Nov
  { d: 22, name: "Capricorn" },  // Dec
];

// Returns the sun sign for a YYYY-MM-DD birthday (date-only).
export function sunSign(birthday: string | null | undefined): SunSign | null {
  if (!birthday) return null;
  const [, m, d] = birthday.split("-").map(Number);
  if (!m || !d || m < 1 || m > 12) return null;
  const entry = CUTOFFS[m - 1];
  // On/after the cutoff → that month's sign; before it → the previous sign.
  const name = d >= entry.d ? entry.name : CUTOFFS[(m + 10) % 12].name;
  return { name, ...META[name] };
}
