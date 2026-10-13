// Quiz reflections for templates whose config.scoring is "dimensions": the
// per-dimension averages of a person's scale answers, plus an attachment
// label when the dimensions are the ECR-style anxiety/avoidance pair. Pure
// and framed as reflection, never diagnosis (same thresholds as the profile
// reflection in lib/attachment.ts).

import type { PromptQuestion } from "@/lib/database.types";
import { ATTACHMENT_BLURB, type AttachmentResult } from "@/lib/attachment";

export interface DimensionScore {
  dimension: string;
  average: number; // on the question's scale (usually 1–5)
  max: number;
  count: number;
}

export interface QuizReflection {
  scores: DimensionScore[];
  label: string | null; // e.g. "Secure" for the attachment pair
  blurb: string | null;
}

export function isDimensionScored(config: unknown): boolean {
  return (
    !!config &&
    typeof config === "object" &&
    (config as { scoring?: unknown }).scoring === "dimensions"
  );
}

export function scoreDimensions(
  questions: PromptQuestion[],
  answers: Record<string, string>,
): DimensionScore[] {
  const acc = new Map<string, { sum: number; count: number; max: number }>();
  for (const q of questions) {
    if (q.format !== "scale" || !q.dimension) continue;
    const raw = (answers[q.id] ?? "").trim();
    if (raw === "") continue; // Number("") is 0, which would count a blank as a score
    const v = Number(raw);
    if (!Number.isFinite(v)) continue;
    const cur = acc.get(q.dimension) ?? { sum: 0, count: 0, max: q.max ?? 5 };
    cur.sum += v;
    cur.count += 1;
    cur.max = Math.max(cur.max, q.max ?? 5);
    acc.set(q.dimension, cur);
  }
  return Array.from(acc.entries()).map(([dimension, { sum, count, max }]) => ({
    dimension,
    average: Math.round((sum / count) * 10) / 10,
    max,
    count,
  }));
}

function attachmentLabel(scores: DimensionScore[]): AttachmentResult["style"] | null {
  const anx = scores.find((s) => s.dimension === "anxiety");
  const avo = scores.find((s) => s.dimension === "avoidance");
  if (!anx || !avo) return null;
  const hiAnx = anx.average > 3;
  const hiAvo = avo.average > 3;
  return hiAnx && hiAvo ? "Fearful" : hiAnx ? "Anxious" : hiAvo ? "Avoidant" : "Secure";
}

export function quizReflection(
  questions: PromptQuestion[],
  answers: Record<string, string>,
): QuizReflection | null {
  const scores = scoreDimensions(questions, answers);
  if (scores.length === 0) return null;
  const label = attachmentLabel(scores);
  return {
    scores,
    label,
    blurb: label ? ATTACHMENT_BLURB[label] : null,
  };
}

export function dimensionLabel(dimension: string): string {
  return dimension.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}
