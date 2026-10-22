import { describe, expect, it } from "vitest";
import { postAuthPath } from "./postAuthRedirect";

describe("postAuthPath", () => {
  it("sends incomplete profiles to onboarding with invite next", () => {
    expect(
      postAuthPath({ profile: null, connections: [] }),
    ).toBe("/onboarding?next=%2Fconnections%2Fnew");
    expect(
      postAuthPath({ profile: { display_name: "  " }, connections: [] }),
    ).toBe("/onboarding?next=%2Fconnections%2Fnew");
  });

  it("sends named users with no connections to create + invite", () => {
    expect(
      postAuthPath({
        profile: { display_name: "Alex" },
        connections: [],
      }),
    ).toBe("/connections/new");
  });

  it("reopens the invite step for a solo pending connection", () => {
    expect(
      postAuthPath({
        profile: { display_name: "Alex" },
        connections: [{ id: "c1", hasPartner: false }],
      }),
    ).toBe("/connections/c1#invite");
  });

  it("sends users who already have a partner to the hub", () => {
    expect(
      postAuthPath({
        profile: { display_name: "Alex" },
        connections: [{ id: "c1", hasPartner: true }],
      }),
    ).toBe("/connections");
  });
});
