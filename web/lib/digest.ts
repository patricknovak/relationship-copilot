import type { GrokMessage } from "@/lib/grok";
import { connectionLabel } from "@/lib/relationships";
import type { ConnectionType } from "@/lib/database.types";
import {
  capitalizeSentenceStarts,
  fenceAnswer,
  MAX_ITEM_CHARS,
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

// The weekly digest looks back at the last week of revealed answers and
// reflects them back: what shone, what to appreciate, one gentle suggestion.
// Same guardrails as the Blueprint: balanced, non-diagnostic, no sides.

export interface Digest {
  highlights: string[];
  appreciations: string[];
  gentle_suggestion: string;
  reflection: string;
}

const SYSTEM = `You are a supportive relationship-wellness assistant writing a short weekly reflection for two people based on the prompts they answered together this week. You are NOT a therapist and you never diagnose.

Hard rules:
- Be warm, balanced, and non-judgmental. Treat both people's answers as equally valid self-reports.
- Never take sides, never tell anyone to leave, confront, or "dump" the other person.
- No predictions, scores, or percentages. Frame everything as gentle observation.
- If anything suggests abuse, coercive control, violence, or self-harm, do NOT analyze it as an ordinary issue — gently encourage seeking support from trained professionals.
- Keep it short and specific to what they actually wrote; never invent details.
- Never name a condition, disorder, or label for either person, even if they used the word themselves.
- ${UNTRUSTED_TEXT_RULE}
- ${NAMING_RULE}
- ${OUTPUT_FORMAT_RULE}
- The reflection is at most 70 words. If one of them did not answer something, do not point it out or guess why.

Return ONLY JSON matching:
{
  "highlights": string[],       // 2-3 specific bright spots from this week's answers
  "appreciations": string[],    // 1-2 things each could thank the other for, grounded in the answers
  "gentle_suggestion": string,  // ONE small, optional thing to try next week
  "reflection": string          // one short, warm closing paragraph
}`;

export function digestSystemPrompt(): GrokMessage {
  return { role: "system", content: SYSTEM };
}

export interface DigestItem {
  title: string; // e.g. "Daily question (Mon)" or a quiz title
  question: string;
  p1: string;
  p2: string;
}

// Build the user message from REDACTED answers (names already P1/P2 upstream).
export function digestUserPrompt(
  type: ConnectionType,
  items: DigestItem[],
  goals: string[] = [],
): GrokMessage {
  const lines = items
    .map(
      (x, i) =>
        `${i + 1}. [${x.title}] ${x.question}\n- P1: ${fenceAnswer(x.p1)}\n- P2: ${fenceAnswer(x.p2)}`,
    )
    .join("\n\n");
  const goalBlock =
    goals.length > 0
      ? `\n\nThings they have said they are trying together (their shared list, redacted the same way):\n${goals
          .slice(0, 10)
          .map((g) => `- ${fenceAnswer(g, 200)}`)
          .join("\n")}\nIf the week's answers touch on any of these, say so gently; never scold about ones they didn't get to.`
      : "";
  return {
    role: "user",
    content: `Relationship type: ${connectionLabel(type)}. ${relationshipFraming(type)}\nHere is what they answered together this week (names redacted as P1/P2):\n\n${lines}${goalBlock}\n\nProduce the JSON weekly digest.`,
  };
}

// Tolerant parse, mirroring parseBlueprint: accept partial output, coerce shape.
export function parseDigest(raw: string): Digest {
  let obj: Record<string, unknown> = {};
  try {
    obj = JSON.parse(raw);
  } catch {
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
    highlights: arr(obj.highlights),
    appreciations: arr(obj.appreciations),
    gentle_suggestion:
      typeof obj.gentle_suggestion === "string" ? obj.gentle_suggestion : "",
    reflection: typeof obj.reflection === "string" ? obj.reflection : "",
  };
}

export type DigestResult =
  | { ok: true; digest: Digest }
  | { ok: false; reason: "malformed" | "thin" | OutputViolation };

/** Parse, clean, bound, check and name a digest. See finalizeBlueprint. */
export function finalizeDigest(
  raw: string,
  names: (string | null | undefined)[] = [],
): DigestResult {
  const parsed = parseDigest(raw);
  const clean: Digest = {
    highlights: sanitizeModelList(parsed.highlights, 3),
    appreciations: sanitizeModelList(parsed.appreciations, 3),
    gentle_suggestion: sanitizeModelText(parsed.gentle_suggestion, MAX_ITEM_CHARS),
    reflection: sanitizeModelText(parsed.reflection, MAX_PARAGRAPH_CHARS),
  };
  const all = [
    ...clean.highlights,
    ...clean.appreciations,
    clean.gentle_suggestion,
    clean.reflection,
  ].filter(Boolean);
  if (all.length === 0) return { ok: false, reason: "malformed" };
  // The card needs something to open with and something to close with.
  if (clean.highlights.length === 0 || !clean.reflection) return { ok: false, reason: "thin" };

  const violations = outputViolations(all);
  if (violations.length > 0) return { ok: false, reason: violations[0] };

  const name = (t: string) => capitalizeSentenceStarts(restoreNames(t, names));
  return {
    ok: true,
    digest: {
      highlights: clean.highlights.map(name),
      appreciations: clean.appreciations.map(name),
      gentle_suggestion: name(clean.gentle_suggestion),
      reflection: name(clean.reflection),
    },
  };
}

const AUTO_DIGEST_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Generate-on-visit (decision 0001, option A): when a member opens the hub,
 * write this week's digest in their session if the pair is Premium, the AI
 * is enabled, the week has revealed answers, nothing is already being
 * written, and the last digest is at least a week old. Pure.
 */
export function shouldAutoGenerateDigest(input: {
  isPremium: boolean;
  aiEnabled: boolean;
  hasMaterial: boolean;
  pending: boolean;
  lastGeneratedAt: string | null;
  nowMs?: number;
}): boolean {
  const { isPremium, aiEnabled, hasMaterial, pending, lastGeneratedAt } = input;
  if (!isPremium || !aiEnabled || !hasMaterial || pending) return false;
  if (!lastGeneratedAt) return true;
  const last = new Date(lastGeneratedAt).getTime();
  if (Number.isNaN(last)) return false;
  return (input.nowMs ?? Date.now()) - last >= AUTO_DIGEST_AFTER_MS;
}
