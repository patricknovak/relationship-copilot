import { describe, it, expect } from "vitest";
import { buildRedactor } from "@/lib/redact";

describe("buildRedactor", () => {
  it("replaces names case-insensitively with placeholders", () => {
    const { redact } = buildRedactor(["Alex", "Jordan"]);
    const out = redact("alex loves Jordan and ALEX trusts jordan");
    expect(out).toBe("P1 loves P2 and P1 trusts P2");
  });

  it("replaces longer names before shorter overlapping ones", () => {
    const { redact } = buildRedactor(["Anna Lee", "Anna"]);
    // "Anna Lee" maps to P1 (longest first), "Anna" to P2.
    expect(redact("Anna Lee met Anna")).toBe("P1 met P2");
  });

  it("redacts emails and phone numbers", () => {
    const { redact } = buildRedactor([]);
    expect(redact("reach me at a.b+x@mail.co or 555-123-4567")).toBe(
      "reach me at [email] or [phone]",
    );
  });

  it("ignores empty/too-short names", () => {
    const { map } = buildRedactor(["", "A", null, undefined, "Sam"]);
    expect(map).toEqual([{ name: "Sam", placeholder: "P1" }]);
  });
});
