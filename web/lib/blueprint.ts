import type { GrokMessage } from "@/lib/grok";
import { connectionLabel } from "@/lib/relationships";
import type { ConnectionType } from "@/lib/database.types";
import {
  capitalizeSentenceStarts,
  fenceAnswer,
  MAX_LIST_ITEMS,
  MAX_PARAGRAPH_CHARS,
  NAMING_RULE,
  OUTPUT_FORMAT_RULE,
  outputViolations,
  relationshipFraming,
  restoreNames,
  sanitizeModelList,
  sanitizeModelText,
  UNTRUSTED_TEXT_RULE,
  type OutputViolation,
} from "@/lib/aiGuard";

export interface Blueprint {
  strengths: string[];
  shared_goals: string[];
  focus_areas: string[];
  reflection: string;
}

// Guardrails are baked into the system prompt: balanced, non-diagnostic, no
// taking sides, express uncertainty, surface help on safety concerns. These are
// requirements, not suggestions.
const SYSTEM = `You are a supportive relationship-wellness assistant. You are NOT a therapist or medical professional and you never diagnose.

Hard rules:
- Be warm, balanced, and non-judgmental. You are reading two people's self-reported answers; you do not know objective truth.
- Never take sides, never tell anyone to leave, confront, or "dump" the other person.
- Never make confident predictions or percentages. Express uncertainty; frame insights as gentle observations or questions.
- Ground suggestions in well-established relationship science (e.g. building fondness, turning toward bids, repair, shared meaning) when relevant, but keep language plain.
- If anything suggests abuse, coercive control, violence, or self-harm, do NOT analyze it as an ordinary issue — gently encourage seeking support from trained professionals. Do not diagnose.
- Astrology, if mentioned, is entertainment only and must never inform your guidance.
- Never name a condition, disorder, or label for either person (for example "narcissist", "codependent", "anxious-attached"), even if they used the word themselves.
- ${UNTRUSTED_TEXT_RULE}
- ${NAMING_RULE}
- ${OUTPUT_FORMAT_RULE}
- The reflection is at most 110 words. If their answers are too thin to say something specific, say less rather than padding with general advice.

Return ONLY JSON matching:
{
  "strengths": string[],        // 2-4 genuine strengths in how they relate
  "shared_goals": string[],     // 2-4 gentle, shared goals they might pursue
  "focus_areas": string[],      // 2-4 areas to nurture, framed kindly
  "reflection": string          // one short, balanced paragraph; non-diagnostic
}`;

export function blueprintSystemPrompt(): GrokMessage {
  return { role: "system", content: SYSTEM };
}

export interface BlueprintQa {
  question: string;
  p1: string;
  p2: string;
  // ISO date of the reveal, for the "recent" section only.
  date?: string | null;
}

// Keep the prompt bounded: the onboarding pack is at most 20 questions; the
// recent-dailies section is capped here so the Blueprint stays a reflection,
// not a transcript.
export const MAX_RECENT_FOR_BLUEPRINT = 20;

function qaLines(qa: BlueprintQa[], prefix: string): string {
  return qa
    .map(
      (x, i) =>
        `${prefix}${i + 1}${x.date ? ` (${x.date})` : ""}: ${x.question}\n- P1: ${fenceAnswer(x.p1)}\n- P2: ${fenceAnswer(x.p2)}`,
    )
    .join("\n\n");
}

// A member's private profile reflections, included only when that member
// opted in for this connection (blueprint_intake_consent, migration 0037).
// Text fields arrive REDACTED; the attachment style is a fixed label.
export interface BlueprintIntake {
  goals?: string;
  values?: string;
  attachmentStyle?: string;
}

export const MAX_INTAKE_FIELD = 500;
const ATTACHMENT_STYLES = new Set(["Secure", "Anxious", "Avoidant", "Fearful"]);

/** Pull the shareable parts out of profiles.intake; null when there's nothing. */
export function intakeFromProfile(raw: unknown): BlueprintIntake | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { goals?: unknown; values?: unknown; attachment?: { style?: unknown } | null };
  const clip = (v: unknown) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, MAX_INTAKE_FIELD) : undefined;
  const out: BlueprintIntake = {
    goals: clip(r.goals),
    values: clip(r.values),
    attachmentStyle:
      typeof r.attachment?.style === "string" && ATTACHMENT_STYLES.has(r.attachment.style)
        ? r.attachment.style
        : undefined,
  };
  return out.goals || out.values || out.attachmentStyle ? out : null;
}

function intakeLines(label: string, x: BlueprintIntake): string {
  return [
    `${label} chose to share their private profile reflections:`,
    x.goals ? `- What they hope for: ${fenceAnswer(x.goals, MAX_INTAKE_FIELD)}` : null,
    x.values ? `- What matters to them: ${fenceAnswer(x.values, MAX_INTAKE_FIELD)}` : null,
    x.attachmentStyle
      ? `- A short self-reflection quiz suggested "${x.attachmentStyle}" (self-reported, not a diagnosis)`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}

// Build the user message from REDACTED question/answer pairs (names already
// replaced with P1/P2 upstream). `recent` is the pair's latest revealed
// daily answers, oldest first, so the Blueprint can reflect how things are
// now and not only how they started. `intake` holds only the reflections of
// members who opted in; the model is told to use them for gentle context and
// never to quote or attribute them.
export function blueprintUserPrompt(
  type: ConnectionType,
  qa: BlueprintQa[],
  recent: BlueprintQa[] = [],
  intake: { p1?: BlueprintIntake | null; p2?: BlueprintIntake | null } = {},
): GrokMessage {
  const trimmed = recent.slice(-MAX_RECENT_FOR_BLUEPRINT);
  const recentBlock =
    trimmed.length > 0
      ? `\n\nTheir most recent daily answers, oldest first (same redaction). Weigh these as "where they are now" against the onboarding answers as "where they started", and note gently if something has shifted:\n\n${qaLines(trimmed, "D")}`
      : "";
  const shared = [
    intake.p1 ? intakeLines("P1", intake.p1) : null,
    intake.p2 ? intakeLines("P2", intake.p2) : null,
  ].filter(Boolean);
  const intakeBlock =
    shared.length > 0
      ? `\n\nProfile reflections (same redaction), shared by choice. Use them only as gentle background for shared goals and focus areas. Never quote them, never say who wrote what, and never treat the quiz label as a diagnosis or as a reason one person is the problem:\n\n${shared.join("\n\n")}`
      : "";
  return {
    role: "user",
    content: `Relationship type: ${connectionLabel(type)}. ${relationshipFraming(type)}\nHere are their answers to the onboarding questions (names redacted as P1/P2):\n\n${qaLines(qa, "Q")}${recentBlock}${intakeBlock}\n\nProduce the JSON blueprint.`,
  };
}

// Tolerant parse: accept partial output, coerce to the Blueprint shape.
export function parseBlueprint(raw: string): Blueprint {
  let obj: Record<string, unknown> = {};
  try {
    obj = JSON.parse(raw);
  } catch {
    // Try to extract the first JSON object if the model wrapped it.
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        obj = JSON.parse(m[0]);
      } catch {
        /* fall through to defaults */
      }
    }
  }
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  return {
    strengths: arr(obj.strengths),
    shared_goals: arr(obj.shared_goals),
    focus_areas: arr(obj.focus_areas),
    reflection: typeof obj.reflection === "string" ? obj.reflection : "",
  };
}

export type BlueprintResult =
  | { ok: true; blueprint: Blueprint }
  | { ok: false; reason: "malformed" | "thin" | OutputViolation };

/**
 * Everything between the model's raw text and a Blueprint we are willing to
 * save: parse, clean, bound, check it kept the product's promises, then put
 * names back. Malformed or empty output is a failure, not a blank Blueprint:
 * saving one would spend the pair's free Blueprint on an empty page.
 */
export function finalizeBlueprint(
  raw: string,
  names: (string | null | undefined)[] = [],
): BlueprintResult {
  const parsed = parseBlueprint(raw);
  const clean: Blueprint = {
    strengths: sanitizeModelList(parsed.strengths, MAX_LIST_ITEMS),
    shared_goals: sanitizeModelList(parsed.shared_goals, MAX_LIST_ITEMS),
    focus_areas: sanitizeModelList(parsed.focus_areas, MAX_LIST_ITEMS),
    reflection: sanitizeModelText(parsed.reflection, MAX_PARAGRAPH_CHARS),
  };
  const lists = [clean.strengths, clean.shared_goals, clean.focus_areas];
  const filled = lists.filter((l) => l.length > 0).length + (clean.reflection ? 1 : 0);
  if (filled === 0) return { ok: false, reason: "malformed" };
  // A Blueprint is three lists and a reflection; half of one is not one.
  if (filled < 3 || !clean.reflection) return { ok: false, reason: "thin" };

  const violations = outputViolations([...lists.flat(), clean.reflection]);
  if (violations.length > 0) return { ok: false, reason: violations[0] };

  const name = (t: string) => capitalizeSentenceStarts(restoreNames(t, names));
  return {
    ok: true,
    blueprint: {
      strengths: clean.strengths.map(name),
      shared_goals: clean.shared_goals.map(name),
      focus_areas: clean.focus_areas.map(name),
      reflection: name(clean.reflection),
    },
  };
}
