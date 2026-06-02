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

// Build a redactor from the participants' display names. Longest names first so
// "Anna Lee" is replaced before "Anna".
export function buildRedactor(names: (string | null | undefined)[]): Redactor {
  // Placeholder numbering follows input order (P1 = first participant)...
  const map = names
    .filter((n): n is string => !!n && n.trim().length > 1)
    .map((n, i) => ({ name: n.trim(), placeholder: `P${i + 1}` }));

  // ...but replacement applies longest name first so "Anna Lee" beats "Anna".
  const ordered = [...map].sort((a, b) => b.name.length - a.name.length);

  function redact(text: string): string {
    let out = text ?? "";
    for (const { name, placeholder } of ordered) {
      out = out.replace(new RegExp(`\\b${escapeRegExp(name)}\\b`, "gi"), placeholder);
    }
    // Emails, then long digit runs (phone numbers).
    out = out.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]");
    out = out.replace(/(?:\+?\d[\s.-]?){7,}\d/g, "[phone]");
    return out;
  }

  return { redact, map };
}
