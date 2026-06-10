import { describe, it, expect } from "vitest";
import { safeNextPath } from "@/lib/redirect";

describe("safeNextPath", () => {
  it("allows ordinary internal paths", () => {
    expect(safeNextPath("/connections/abc")).toBe("/connections/abc");
    expect(safeNextPath("/invite/XYZ123?a=1")).toBe("/invite/XYZ123?a=1");
  });

  it("falls back when missing", () => {
    expect(safeNextPath(null)).toBe("/connections");
    expect(safeNextPath(undefined, "/")).toBe("/");
    expect(safeNextPath("")).toBe("/connections");
  });

  it("rejects absolute URLs and scheme-relative URLs", () => {
    expect(safeNextPath("https://evil.example")).toBe("/connections");
    expect(safeNextPath("//evil.example/phish")).toBe("/connections");
    expect(safeNextPath("javascript:alert(1)")).toBe("/connections");
  });

  it("rejects backslash and control-character tricks", () => {
    expect(safeNextPath("/\\evil.example")).toBe("/connections");
    expect(safeNextPath("/ok\\..\\etc")).toBe("/connections");
    expect(safeNextPath("/ok\r\nSet-Cookie: x")).toBe("/connections");
  });
});
