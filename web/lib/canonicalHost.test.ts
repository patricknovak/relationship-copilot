import { describe, expect, it } from "vitest";
import { canonicalRedirect } from "./canonicalHost";

describe("canonicalRedirect", () => {
  it("sends www to the bare domain, keeping path and query", () => {
    expect(canonicalRedirect("https://www.relationshipcopilot.com/invite/AB12CD34?utm_source=x&next=%2Fa")).toBe(
      "https://relationshipcopilot.com/invite/AB12CD34?utm_source=x&next=%2Fa",
    );
    expect(canonicalRedirect("http://WWW.relationshipcopilot.com/")).toBe("https://relationshipcopilot.com/");
  });

  it("drops the fragment (browsers re-apply it after a redirect)", () => {
    expect(canonicalRedirect("https://www.relationshipcopilot.com/a#b")).toBe("https://relationshipcopilot.com/a");
  });

  it("leaves every other host alone", () => {
    expect(canonicalRedirect("https://relationshipcopilot.com/pricing?x=1")).toBeNull();
    expect(canonicalRedirect("https://relationship-copilot.patricknovak1.workers.dev/")).toBeNull();
    expect(canonicalRedirect("not a url")).toBeNull();
  });
});
