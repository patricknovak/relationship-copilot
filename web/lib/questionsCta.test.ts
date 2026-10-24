import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/redirect";
import { normalizeAuthNextParam } from "@/lib/authConfirm";
import {
  parseQuestionsListParam,
  questionsCtaHrefs,
  questionsCtaLoginHref,
  questionsInviteCopy,
  questionsStartPath,
} from "@/lib/questionsCta";

describe("questionsStartPath / questionsCtaHrefs", () => {
  it("hub has no list or type", () => {
    expect(questionsStartPath()).toBe("/connections/new");
    expect(questionsStartPath(null)).toBe("/connections/new");
    expect(questionsCtaHrefs()).toEqual({
      signedIn: "/connections/new",
      signedOut: "/login?next=%2Fconnections%2Fnew",
    });
  });

  it("slug pages carry type + list into the start path", () => {
    expect(questionsStartPath("partners")).toBe(
      "/connections/new?type=romantic&list=partners",
    );
    expect(questionsStartPath("friends")).toBe(
      "/connections/new?type=friend&list=friends",
    );
    expect(questionsStartPath("parents-and-teens")).toBe(
      "/connections/new?type=parent_child&list=parents-and-teens",
    );
    expect(questionsCtaLoginHref("partners")).toBe(
      `/login?next=${encodeURIComponent("/connections/new?type=romantic&list=partners")}`,
    );
  });

  it("unknown slug falls back to hub start path", () => {
    expect(questionsStartPath("nope")).toBe("/connections/new");
  });
});

describe("parseQuestionsListParam / questionsInviteCopy", () => {
  it("accepts known slugs only", () => {
    expect(parseQuestionsListParam("partners")).toBe("partners");
    expect(parseQuestionsListParam("siblings")).toBe("siblings");
    expect(parseQuestionsListParam("evil")).toBeNull();
    expect(parseQuestionsListParam(null)).toBeNull();
  });

  it("builds factual invite copy from list title + forLabel", () => {
    expect(questionsInviteCopy("partners")).toBe(
      'Invite your partner to answer "Questions to ask your partner" together',
    );
    expect(questionsInviteCopy("friends")).toBe(
      'Invite a friend to answer "Questions to ask a friend" together',
    );
    expect(questionsInviteCopy("nope")).toBeNull();
  });
});

describe("questions CTA next-param validation (open redirects)", () => {
  it("rejects //evil.com, absolute URLs, and schemes via safeNextPath", () => {
    expect(safeNextPath("//evil.com")).toBe("/connections");
    expect(safeNextPath("//evil.com/phish")).toBe("/connections");
    expect(safeNextPath("https://evil.com")).toBe("/connections");
    expect(safeNextPath("http://evil.com/x")).toBe("/connections");
    expect(safeNextPath("https://evil.example/phish")).toBe("/connections");
  });

  it("allows the questions start path as a relative next", () => {
    const next = questionsStartPath("partners");
    expect(safeNextPath(next)).toBe(next);
    expect(safeNextPath("/connections/new")).toBe("/connections/new");
  });

  it("normalizeAuthNextParam rejects absolute and protocol-relative evil URLs", () => {
    const origin = "https://relationshipcopilot.com";
    expect(normalizeAuthNextParam("//evil.com", origin)).toBe("");
    expect(normalizeAuthNextParam("https://evil.com", origin)).toBe("");
    expect(
      normalizeAuthNextParam(
        "https://evil.com/login?next=/connections/new",
        origin,
      ),
    ).toBe("");
    expect(
      normalizeAuthNextParam(questionsStartPath("partners"), origin),
    ).toBe("/connections/new?type=romantic&list=partners");
  });
});
