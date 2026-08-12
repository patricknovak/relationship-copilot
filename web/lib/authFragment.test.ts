import { describe, expect, it } from "vitest";
import { parseAuthFragment } from "./authFragment";

describe("parseAuthFragment", () => {
  it("extracts both tokens from an implicit-flow hash", () => {
    expect(
      parseAuthFragment("#access_token=aaa&refresh_token=bbb&token_type=bearer"),
    ).toEqual({ access_token: "aaa", refresh_token: "bbb" });
  });

  it("works without the leading #", () => {
    expect(parseAuthFragment("access_token=a&refresh_token=b")).toEqual({
      access_token: "a",
      refresh_token: "b",
    });
  });

  it("returns null when either token is missing or hash is empty", () => {
    expect(parseAuthFragment("#access_token=aaa")).toBeNull();
    expect(parseAuthFragment("#refresh_token=bbb")).toBeNull();
    expect(parseAuthFragment("#error=access_denied")).toBeNull();
    expect(parseAuthFragment("")).toBeNull();
    expect(parseAuthFragment(null)).toBeNull();
  });
});
