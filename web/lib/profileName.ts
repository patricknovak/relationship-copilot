// A first-name suggestion from the sign-in provider's profile (Google sends
// given_name / full_name / name), used only to prefill the "What should we
// call you?" fields. Never saved without the person pressing Save, and never
// derived from an email address. Pure and unit-tested.

const MAX = 40;

export function suggestedFirstName(meta: unknown): string {
  if (!meta || typeof meta !== "object") return "";
  const m = meta as Record<string, unknown>;
  const pick = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const given = pick(m.given_name);
  const full = pick(m.full_name) || pick(m.name);
  const candidate = given || full.split(/\s+/)[0] || "";
  if (!candidate || candidate.includes("@") || !/\p{L}/u.test(candidate)) return "";
  return candidate.slice(0, MAX);
}
