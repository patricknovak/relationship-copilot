// Reactions on revealed answers: the allowed set (mirrors the DB check in
// migration 0023) and a pure grouping helper for rendering.

export const REACTION_EMOJIS = ["❤️", "😂", "🥹", "👀"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export function isReactionEmoji(v: unknown): v is ReactionEmoji {
  return typeof v === "string" && (REACTION_EMOJIS as readonly string[]).includes(v);
}

export interface ReactionRow {
  user_id: string; // who reacted
  target_user_id: string; // whose answer
  question_id: string;
  emoji: string;
}

// Key: `${target_user_id}:${question_id}` → reactions on that answer.
export function groupReactions(
  rows: ReactionRow[],
): Map<string, { user_id: string; emoji: string }[]> {
  const out = new Map<string, { user_id: string; emoji: string }[]>();
  for (const r of rows) {
    if (!isReactionEmoji(r.emoji)) continue;
    const key = `${r.target_user_id}:${r.question_id}`;
    const list = out.get(key) ?? [];
    list.push({ user_id: r.user_id, emoji: r.emoji });
    out.set(key, list);
  }
  return out;
}

export function reactionKey(targetUserId: string, questionId: string): string {
  return `${targetUserId}:${questionId}`;
}
