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

  it("redacts phone numbers without separators and with parentheses", () => {
    const { redact } = buildRedactor([]);
    expect(redact("call 5551234567 ok")).toBe("call [phone] ok");
    expect(redact("call (555) 123-4567 ok")).toBe("call [phone] ok");
    expect(redact("intl +1 555 123 4567 ok")).toBe("intl [phone] ok");
  });

  it("redacts possessive forms of names", () => {
    const { redact } = buildRedactor(["Anna"]);
    expect(redact("Anna's mom met Anna")).toBe("P1's mom met P1");
  });

  it("ignores empty/too-short names but keeps slot numbering", () => {
    const { map } = buildRedactor(["", "A", null, undefined, "Sam"]);
    expect(map).toEqual([{ name: "Sam", placeholder: "P5" }]);
  });

  it("keeps placeholder numbers aligned to participant slots when a name is missing", () => {
    const { redact, map } = buildRedactor([null, "Sam"]);
    // Sam is the SECOND participant, so their placeholder must stay P2 even
    // though the first participant has no name to redact.
    expect(map).toEqual([{ name: "Sam", placeholder: "P2" }]);
    expect(redact("I love how Sam listens")).toBe("I love how P2 listens");
  });
});
