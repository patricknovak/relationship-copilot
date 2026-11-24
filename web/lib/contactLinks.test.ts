import { describe, expect, it } from "vitest";
import { contactParts } from "./contactLinks";

const text = (contact: string) =>
  contactParts(contact)
    .map((p) => p.text)
    .join("");

describe("contactParts", () => {
  it("never changes the visible wording", () => {
    for (const c of [
      "Call or text 988",
      "Text HOME to 741741",
      "Call 1-800-799-7233 · Text START to 88788",
      "Call or text 9-8-8",
      "Find your nearest shelter and crisis line",
    ]) {
      expect(text(c)).toBe(c);
    }
  });

  it("links short codes without a country code", () => {
    expect(contactParts("Call or text 988")).toEqual([
      { text: "Call or text 988", href: "tel:988" },
    ]);
    expect(contactParts("Call or text 9-8-8")[0].href).toBe("tel:988");
  });

  it("links toll-free numbers in international form", () => {
    expect(contactParts("Call 1-800-656-4673")[0].href).toBe("tel:+18006564673");
    expect(contactParts("Call or text 1-800-422-4453")[0].href).toBe("tel:+18004224453");
  });

  it("prefills the keyword for text lines", () => {
    expect(contactParts("Text HOME to 741741")).toEqual([
      { text: "Text HOME to 741741", href: "sms:741741?&body=HOME" },
    ]);
  });

  it("handles a call and a text option together", () => {
    expect(contactParts("Call 1-866-331-9474 · Text LOVEIS to 22522")).toEqual([
      { text: "Call 1-866-331-9474", href: "tel:+18663319474" },
      { text: " · " },
      { text: "Text LOVEIS to 22522", href: "sms:22522?&body=LOVEIS" },
    ]);
  });

  it("leaves contacts without a number as plain text", () => {
    expect(contactParts("Find your nearest shelter and crisis line")).toEqual([
      { text: "Find your nearest shelter and crisis line" },
    ]);
  });
});
