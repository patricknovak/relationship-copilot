// A very short, self-report attachment reflection (anxiety + avoidance
// dimensions, à la ECR-RS). Educational, not diagnostic. Each item is a 1–5
// agreement scale; two items per dimension.
export interface AttachmentItem {
  id: string;
  text: string;
  dimension: "anxiety" | "avoidance";
}

export const ATTACHMENT_ITEMS: AttachmentItem[] = [
  { id: "a1", text: "I worry that people I'm close to will stop caring about me.", dimension: "anxiety" },
  { id: "a2", text: "I need a lot of reassurance that I'm loved.", dimension: "anxiety" },
  { id: "a3", text: "I find it hard to depend on or open up to others.", dimension: "avoidance" },
  { id: "a4", text: "I prefer to keep some distance, even with people I care about.", dimension: "avoidance" },
];

export interface AttachmentResult {
  anxiety: number; // 1..5 average
  avoidance: number; // 1..5 average
  style: "Secure" | "Anxious" | "Avoidant" | "Fearful";
}

export function scoreAttachment(answers: Record<string, number>): AttachmentResult {
  const avg = (dim: AttachmentItem["dimension"]) => {
    const items = ATTACHMENT_ITEMS.filter((i) => i.dimension === dim);
    const vals = items.map((i) => answers[i.id]).filter((v) => Number.isFinite(v));
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 3;
  };
  const anxiety = avg("anxiety");
  const avoidance = avg("avoidance");
  const hiAnx = anxiety > 3;
  const hiAvo = avoidance > 3;
  const style = hiAnx && hiAvo ? "Fearful" : hiAnx ? "Anxious" : hiAvo ? "Avoidant" : "Secure";
  return { anxiety, avoidance, style };
}

export const ATTACHMENT_BLURB: Record<AttachmentResult["style"], string> = {
  Secure: "You're generally comfortable with closeness and with independence.",
  Anxious: "You value closeness deeply and can feel uneasy when connection feels uncertain.",
  Avoidant: "You value independence and can find a lot of closeness uncomfortable.",
  Fearful: "You may feel pulled between wanting closeness and protecting yourself from it.",
};
