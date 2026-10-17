import { describe, expect, it } from "vitest";
import { suggestedFirstName } from "./profileName";

describe("suggestedFirstName", () => {
  it("prefers given_name, else the first word of full_name or name", () => {
    expect(suggestedFirstName({ given_name: "Sam", full_name: "Samuel Rivera" })).toBe("Sam");
    expect(suggestedFirstName({ full_name: "  Alex  Kim " })).toBe("Alex");
    expect(suggestedFirstName({ name: "Zoë Müller" })).toBe("Zoë");
  });

  it("never suggests an email, a non-name, or anything from nothing", () => {
    expect(suggestedFirstName({ name: "alex@example.com" })).toBe("");
    expect(suggestedFirstName({ full_name: "12345" })).toBe("");
    expect(suggestedFirstName({})).toBe("");
    expect(suggestedFirstName(null)).toBe("");
    expect(suggestedFirstName({ given_name: 42 })).toBe("");
  });

  it("caps the length", () => {
    expect(suggestedFirstName({ given_name: "x".repeat(100) })).toHaveLength(40);
  });
});
