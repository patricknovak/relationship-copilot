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

  it("ignores archived and blocked connections", () => {
    // Left a pending connection (or the other person deleted their account):
    // sign-in used to land on the dead connection's #invite every time.
    expect(
      postAuthPath({
        profile: { display_name: "Alex" },
        connections: [{ id: "old", hasPartner: false, status: "archived" }],
      }),
    ).toBe("/connections/new");
    expect(
      postAuthPath({
        profile: { display_name: "Alex" },
        connections: [
          { id: "old", hasPartner: false, status: "archived" },
          { id: "gone", hasPartner: true, status: "blocked" },
          { id: "live", hasPartner: true, status: "active" },
        ],
      }),
    ).toBe("/connections");
  });

  it("still reopens a live solo invite next to an archived one", () => {
    expect(
      postAuthPath({
        profile: { display_name: "Alex" },
        connections: [
          { id: "old", hasPartner: false, status: "archived" },
          { id: "c2", hasPartner: false, status: "pending" },
        ],
      }),
    ).toBe("/connections/c2#invite");
  });

  it("sends a nameless invitee back to their connection after naming", () => {
    // Joined through an invite link (explicit next skips onboarding), then
    // signed in again before setting a name. They already have their person;
    // they must not be walked into creating a second connection.
    expect(
      postAuthPath({
        profile: { display_name: null },
        connections: [{ id: "c1", hasPartner: true, status: "onboarding" }],
      }),
    ).toBe("/onboarding?next=%2Fconnections");
  });

  it("sends a nameless inviter back to their pending invite after naming", () => {
    expect(
      postAuthPath({
        profile: null,
        connections: [{ id: "c1", hasPartner: false, status: "pending" }],
      }),
    ).toBe("/onboarding?next=%2Fconnections%2Fc1%23invite");
  });
});
