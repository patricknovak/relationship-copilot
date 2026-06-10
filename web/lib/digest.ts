import type { GrokMessage } from "@/lib/grok";
import { connectionLabel } from "@/lib/relationships";
import type { ConnectionType } from "@/lib/database.types";

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
): GrokMessage {
  const lines = items
    .map(
      (x, i) =>
        `${i + 1}. [${x.title}] ${x.question}\n- P1: ${x.p1 || "(no answer)"}\n- P2: ${x.p2 || "(no answer)"}`,
    )
    .join("\n\n");
  return {
    role: "user",
    content: `Relationship type: ${connectionLabel(type)}.\nHere is what they answered together this week (names redacted as P1/P2):\n\n${lines}\n\nProduce the JSON weekly digest.`,
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
