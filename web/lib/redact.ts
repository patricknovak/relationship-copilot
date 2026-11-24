// Strip personally-identifying details before any text leaves our boundary for
// the model. Names → P1/P2…, emails/phones → placeholders. This is a
// best-effort reducer, not a guarantee; pair it with an enterprise no-training
// data agreement on the provider side.

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface Redactor {
  redact: (text: string) => string;
  map: { name: string; placeholder: string }[];
}

// Characters that make something "part of a word". JavaScript's \b only
// knows ASCII, so "\bJosé\b" never matches (é is not a word character to it)
// and names such as José, Zoë or Łukasz went to the provider unredacted.
const WORD = "\\p{L}\\p{M}\\p{N}_";

function namePattern(name: string): RegExp {
  return new RegExp(`(?<![${WORD}])${escapeRegExp(name)}(?![${WORD}])`, "giu");
}

// Everything a participant may be called in free text: the display name as
// entered, plus its parts, because someone whose display name is "Anna Lee"
// is written about as "Anna". The first part counts from two letters ("Jo");
// later parts from three, so particles like "de" or "la" stay ordinary words.
function aliasesFor(name: string): string[] {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return [];
  return parts.filter((part, i) => part.length >= (i === 0 ? 2 : 3));
}

// Build a redactor from the participants' display names. Longest names first so
// "Anna Lee" is replaced before "Anna".
export function buildRedactor(names: (string | null | undefined)[]): Redactor {
  // Placeholder numbering follows input order (P1 = first participant). A
  // missing/short name keeps its slot's number and simply has nothing to
  // replace — filtering before numbering would shift the partner's name onto
  // the wrong placeholder and cross-wire identities in the prompt.
  const map = names
    .map((n, i) => ({ name: n?.trim() ?? "", placeholder: `P${i + 1}` }))
    .filter((e) => e.name.length > 1);

  // Full display names first, then their parts; a part never overrides
  // another participant's full name ("Anna Lee" and "Anna" stay P1 and P2).
  const seen = new Set<string>();
  const targets: { name: string; placeholder: string }[] = [];
  const add = (name: string, placeholder: string) => {
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    targets.push({ name, placeholder });
  };
  for (const e of map) add(e.name, e.placeholder);
  for (const e of map) for (const a of aliasesFor(e.name)) add(a, e.placeholder);

  // ...and replacement applies longest name first so "Anna Lee" beats "Anna".
  const ordered = targets
    .sort((a, b) => b.name.length - a.name.length)
    .map((t) => ({ pattern: namePattern(t.name), placeholder: t.placeholder }));

  function redact(text: string): string {
    let out = text ?? "";
    for (const { pattern, placeholder } of ordered) {
      out = out.replace(pattern, placeholder);
    }
    // Emails, then long digit runs (phone numbers — with or without
    // separators, including "(555) 123-4567" style grouping).
    out = out.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]");
    out = out.replace(/(?:\+|\(?\d)(?:[\s.()-]*\d){7,}/g, "[phone]");
    return out;
  }

  return { redact, map };
}
