import type { GrokMessage } from "@/lib/grok";
import { connectionLabel } from "@/lib/relationships";
import type { ConnectionType } from "@/lib/database.types";

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

// Build the user message from REDACTED question/answer pairs (names already
// replaced with P1/P2 upstream).
export function blueprintUserPrompt(
  type: ConnectionType,
  qa: { question: string; p1: string; p2: string }[],
): GrokMessage {
  const lines = qa
    .map(
      (x, i) =>
        `Q${i + 1}: ${x.question}\n- P1: ${x.p1 || "(no answer)"}\n- P2: ${x.p2 || "(no answer)"}`,
    )
    .join("\n\n");
  return {
    role: "user",
    content: `Relationship type: ${connectionLabel(type)}.\nHere are their answers to the onboarding questions (names redacted as P1/P2):\n\n${lines}\n\nProduce the JSON blueprint.`,
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
