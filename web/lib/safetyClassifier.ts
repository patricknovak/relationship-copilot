// Model-backed safety classification layered on top of the regex fast path in
// lib/safety.ts. The regex pass is always-on and free; the model pass catches
// paraphrase the keywords miss ("walking on eggshells", indirect ideation).
// The model is advisory-only in one direction: it can RAISE severity, never
// lower it, and any failure degrades to the regex result so safety detection
// never depends on the model being up. Server-only (imports grok).

import { grokChat } from "@/lib/grok";
import {
  detectSafetySignals,
  type SafetyCategory,
  type SafetySeverity,
  type SafetySignal,
} from "@/lib/safety";

const CATEGORIES: SafetyCategory[] = ["self_harm", "abuse", "violence"];
const SEVERITY_RANK: Record<SafetySeverity, number> = {
  none: 0,
  elevated: 1,
  high: 2,
};

// Parse the model's JSON verdict defensively: unknown severities/categories are
// dropped, malformed output returns null (caller falls back to regex).
export function parseSafetyClassification(raw: string): SafetySignal | null {
  let obj: Record<string, unknown> | null = null;
  try {
    obj = JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        obj = JSON.parse(m[0]);
      } catch {
        return null;
      }
    }
  }
  if (!obj || typeof obj !== "object") return null;

  const severity = obj.severity;
  if (severity !== "none" && severity !== "elevated" && severity !== "high") {
    return null;
  }
  const categories = Array.isArray(obj.categories)
    ? obj.categories.filter((c): c is SafetyCategory =>
        CATEGORIES.includes(c as SafetyCategory),
      )
    : [];
  if (severity !== "none" && categories.length === 0) return null;
  return { severity, categories: severity === "none" ? [] : categories };
}

// Combine the regex result with the (optional) model result: highest severity
// wins, categories are unioned. The model can only escalate, never clear.
export function combineSignals(
  fast: SafetySignal,
  model: SafetySignal | null,
): SafetySignal {
  if (!model || SEVERITY_RANK[model.severity] <= SEVERITY_RANK[fast.severity]) {
    if (!model) return fast;
    return {
      severity: fast.severity,
      categories: [...new Set([...fast.categories, ...model.categories])],
    };
  }
  return {
    severity: model.severity,
    categories: [...new Set([...fast.categories, ...model.categories])],
  };
}

function classifierSystemPrompt(): string {
  return [
    "You are a safety screening classifier for a relationship-support app.",
    "You receive journal-style free text two people wrote about their relationship.",
    "Classify whether it contains signals of: self_harm (suicidal ideation or self-injury),",
    "violence (physical harm by or toward a person), or abuse (fear of a partner,",
    "coercive control, isolation, threats, stalking, intimidation, persistent degradation).",
    "Severity: 'high' = clear disclosure of danger, ongoing abuse, or active ideation;",
    "'elevated' = concerning dynamics without immediate danger (put-downs, monitoring,",
    "walking on eggshells); 'none' = ordinary relationship content, including conflict,",
    "metaphor, and discussion of media. Do not flag metaphorical language",
    "(e.g. 'her criticism hit me hard') or third-party fiction.",
    'Respond with ONLY this JSON: {"severity":"none|elevated|high","categories":["self_harm"|"abuse"|"violence", ...]}.',
    "Use an empty categories array when severity is none. When uncertain between",
    "two severities, choose the higher one.",
  ].join(" ");
}

// Ask the model for a verdict. Returns null on any failure (no key, network,
// malformed output) — callers must treat null as "no opinion", not "safe".
export async function classifyWithModel(
  text: string,
): Promise<SafetySignal | null> {
  if (!process.env.XAI_API_KEY) return null;
  try {
    const content = await grokChat(
      [
        { role: "system", content: classifierSystemPrompt() },
        { role: "user", content: text },
      ],
      { json: true, temperature: 0 },
    );
    return parseSafetyClassification(content);
  } catch {
    return null;
  }
}

// Full assessment: regex fast path first; if it already says "high" we're done
// (no model call needed to withhold output). Otherwise consult the model on
// text passed through `redactForModel` (keep the "redact before text leaves
// our boundary" invariant) and take the stricter verdict.
export async function assessSafety(
  rawText: string,
  redactForModel: (t: string) => string = (t) => t,
): Promise<SafetySignal> {
  const fast = detectSafetySignals(rawText);
  if (fast.severity === "high") return fast;
  const model = await classifyWithModel(redactForModel(rawText));
  return combineSignals(fast, model);
}
