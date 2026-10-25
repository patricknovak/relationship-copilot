import { describe, expect, it } from "vitest";
import {
  emailShareHref,
  facebookShareHref,
  inviteShareTargets,
  linkedinShareHref,
  milestoneShareText,
  publicShareTargets,
  redditShareHref,
  smsShareHref,
  telegramShareHref,
  threadsShareHref,
  whatsappShareHref,
  xShareHref,
} from "./share";

const URL_ = "https://relationshipcopilot.com/invite/ABC123DEF456";

describe("share hrefs", () => {
  it("encodes messages for each channel", () => {
    expect(smsShareHref("a b?&")).toBe("sms:?&body=a%20b%3F%26");
    expect(whatsappShareHref("a b")).toBe("https://wa.me/?text=a%20b");
    expect(telegramShareHref(URL_, "hi there")).toBe(
      `https://t.me/share/url?url=${encodeURIComponent(URL_)}&text=hi%20there`,
    );
    expect(emailShareHref("Sub ject", "Body & more")).toBe("mailto:?subject=Sub%20ject&body=Body%20%26%20more");
    expect(xShareHref("hello", URL_)).toContain("twitter.com/intent/tweet?text=hello&url=");
    expect(facebookShareHref(URL_, "q")).toContain("sharer.php?u=");
    expect(facebookShareHref(URL_, "q")).toContain("&quote=q");
    expect(linkedinShareHref(URL_)).toBe(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(URL_)}`);
    expect(threadsShareHref("t", URL_)).toContain("threads.net/intent/post?text=t%20");
    expect(redditShareHref(URL_, "title")).toContain("reddit.com/submit?url=");
  });

  it("keeps private invites off social networks", () => {
    const targets = inviteShareTargets({ url: URL_, message: `Join me ${URL_}`, subject: "Join me" });
    const channels = targets.map((t) => t.channel);
    expect(channels).toEqual(["sms", "whatsapp", "telegram", "email"]);
    for (const t of targets) expect(t.href).toContain(encodeURIComponent(URL_));
  });

  it("offers social networks for public shares, with the url in every link", () => {
    const targets = publicShareTargets({ url: "https://relationshipcopilot.com/questions/friends", text: "Questions for a friend" });
    const channels = targets.map((t) => t.channel);
    expect(channels).toContain("x");
    expect(channels).toContain("facebook");
    expect(channels).toContain("linkedin");
    expect(channels).toContain("threads");
    for (const t of targets) expect(t.href).toContain(encodeURIComponent("relationshipcopilot.com"));
  });

  it("milestone text never carries answers, names, or ids", () => {
    const text = milestoneShareText("first_reveal", { count: 20 });
    expect(text).toContain("first 20 questions");
    expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/);
    expect(milestoneShareText("streak", { streak: 9 })).toMatch(/^9-day streak/);
    expect(milestoneShareText("reveal")).toContain("today's question");
  });
});
