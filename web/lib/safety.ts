// Safety detection + resource routing. THIS RUNS FOR EVERY USER REGARDLESS OF
// PLAN — it is never behind the paywall. It is a deliberately conservative,
// keyword-based first pass that errs toward surfacing help; it does NOT
// diagnose, and high-severity hits are meant to route to human review before
// any AI output is shown (see the Blueprint flow). A production system should
// replace these heuristics with a proper classifier.

export type SafetyCategory = "self_harm" | "abuse" | "violence";
export type SafetySeverity = "none" | "elevated" | "high";

export interface SafetySignal {
  severity: SafetySeverity;
  categories: SafetyCategory[];
}

const PATTERNS: { category: SafetyCategory; severity: SafetySeverity; rx: RegExp }[] = [
  {
    category: "self_harm",
    severity: "high",
    rx: /\b(kill myself|killing myself|end my life|suicid(?:e|al)|want to die|don'?t want to (?:live|be here)|hurt myself|self[-\s]?harm)\b/i,
  },
  {
    category: "violence",
    severity: "high",
    rx: /\b(hit me|hits me|beat me|beats me|threaten(?:ed|s)? me|hurt me|strangl|choked me|punch(?:ed|es)? me)\b/i,
  },
  {
    category: "abuse",
    severity: "high",
    rx: /\b(afraid of (?:him|her|them|my partner)|scared of (?:him|her|them)|controls? (?:me|everything|who i)|won'?t let me (?:see|leave|have)|isolat(?:e|ing) me)\b/i,
  },
  {
    category: "abuse",
    severity: "elevated",
    rx: /\b(yell(?:s|ed)? at me|calls me (?:stupid|worthless|names)|puts me down|jealous (?:and|,)? controlling)\b/i,
  },
];

export function detectSafetySignals(text: string): SafetySignal {
  const found = new Map<SafetyCategory, SafetySeverity>();
  for (const p of PATTERNS) {
    if (p.rx.test(text)) {
      const cur = found.get(p.category);
      if (cur !== "high") found.set(p.category, p.severity);
    }
  }
  const categories = [...found.keys()];
  const severity: SafetySeverity = categories.length
    ? [...found.values()].includes("high")
      ? "high"
      : "elevated"
    : "none";
  return { severity, categories };
}

export interface SafetyResource {
  name: string;
  contact: string;
}

// A compact set surfaced inline when a signal fires; the full list lives at /safety.
export const INLINE_RESOURCES: SafetyResource[] = [
  { name: "988 Suicide & Crisis Lifeline", contact: "Call or text 988" },
  { name: "National Domestic Violence Hotline", contact: "1-800-799-7233 · text START to 88788" },
  { name: "Crisis Text Line", contact: "Text HOME to 741741" },
];

export const SAFETY_NOTE =
  "It sounds like things may be really hard right now. You deserve support from people trained to help — please consider reaching out.";
