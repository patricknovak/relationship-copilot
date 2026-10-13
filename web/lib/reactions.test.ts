import { describe, expect, it } from "vitest";
import {
  groupReactions,
  isReactionEmoji,
  reactionKey,
  REACTION_EMOJIS,
} from "./reactions";

describe("reactions", () => {
  it("accepts only the allowed emoji set", () => {
    for (const e of REACTION_EMOJIS) expect(isReactionEmoji(e)).toBe(true);
    expect(isReactionEmoji("💩")).toBe(false);
    expect(isReactionEmoji("")).toBe(false);
    expect(isReactionEmoji(null)).toBe(false);
  });

  it("groups by answer and drops unknown emoji", () => {
    const g = groupReactions([
      { user_id: "a", target_user_id: "b", question_id: "q1", emoji: "❤️" },
      { user_id: "c", target_user_id: "b", question_id: "q1", emoji: "😂" },
      { user_id: "a", target_user_id: "b", question_id: "q2", emoji: "🥹" },
      { user_id: "a", target_user_id: "b", question_id: "q2", emoji: "nope" },
    ]);
    expect(g.get(reactionKey("b", "q1"))).toEqual([
      { user_id: "a", emoji: "❤️" },
      { user_id: "c", emoji: "😂" },
    ]);
    expect(g.get(reactionKey("b", "q2"))).toEqual([{ user_id: "a", emoji: "🥹" }]);
    expect(g.get(reactionKey("a", "q1"))).toBeUndefined();
  });
});
