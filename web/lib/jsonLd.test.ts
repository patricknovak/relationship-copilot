import { describe, expect, it } from "vitest";
import {
  articleJsonLd,
  articleJsonLdScriptContent,
  homepageJsonLd,
  homepageJsonLdScriptContent,
  serializeJsonLd,
} from "./jsonLd";

describe("homepageJsonLd", () => {
  it("emits Organization + WebSite + SoftwareApplication with Premium offer", () => {
    const data = homepageJsonLd();
    expect(data["@context"]).toBe("https://schema.org");
    const graph = data["@graph"];
    expect(graph).toHaveLength(3);

    const org = graph.find((n) => n["@type"] === "Organization");
    const site = graph.find((n) => n["@type"] === "WebSite");
    const app = graph.find(
      (n) =>
        Array.isArray(n["@type"]) &&
        (n["@type"] as string[]).includes("SoftwareApplication"),
    );

    expect(org?.name).toBe("Relationship Copilot");
    expect(site?.url).toBe("https://relationshipcopilot.com");
    expect(app).toBeDefined();
    const offer = app!.offers as {
      price: string;
      priceCurrency: string;
      name: string;
    };
    expect(offer.name).toBe("Premium");
    expect(offer.price).toBe("18.00");
    expect(offer.priceCurrency).toBe("USD");
  });

  it("does not invent ratings or review aggregates", () => {
    const raw = homepageJsonLdScriptContent();
    expect(raw).not.toMatch(/aggregateRating/i);
    expect(raw).not.toMatch(/reviewRating/i);
    expect(JSON.parse(raw)["@graph"][0].name).toBe("Relationship Copilot");
  });

  it("script content stays byte-identical to JSON.stringify for current content", () => {
    // Homepage strings have no `<`, so the escape pass is a no-op.
    expect(homepageJsonLdScriptContent()).toBe(JSON.stringify(homepageJsonLd()));
  });
});

describe("articleJsonLd", () => {
  const org = {
    "@type": "Organization",
    "@id": "https://relationshipcopilot.com/#organization",
    name: "Relationship Copilot",
    url: "https://relationshipcopilot.com",
  };
  const website = {
    "@type": "WebSite",
    "@id": "https://relationshipcopilot.com/#website",
    name: "Relationship Copilot",
    url: "https://relationshipcopilot.com",
  };
  const base = {
    headline: "Attachment basics",
    description: "A short summary.",
    url: "https://relationshipcopilot.com/library/attachment-basics",
    datePublished: "2026-01-15T00:00:00.000Z",
  };

  it("inlines Organization/WebSite nodes that share the homepage @ids", () => {
    const data = articleJsonLd(base);
    expect(data["@context"]).toBe("https://schema.org");
    expect(data["@type"]).toBe("Article");
    expect(data.headline).toBe("Attachment basics");
    expect(data.description).toBe("A short summary.");
    expect(data.url).toBe(base.url);
    expect(data.inLanguage).toBe("en");
    expect(data.datePublished).toBe(base.datePublished);
    expect(data.author).toEqual(org);
    expect(data.publisher).toEqual(org);
    expect(data.isPartOf).toEqual(website);
  });

  it("omits datePublished when absent and never adds ratings", () => {
    const raw = articleJsonLdScriptContent({
      headline: "Bids for connection",
      description: null,
      url: "https://relationshipcopilot.com/library/bids-for-connection",
    });
    const data = JSON.parse(raw);
    expect(data.datePublished).toBeUndefined();
    expect(data.dateModified).toBeUndefined();
    expect(data.description).toBeUndefined();
    expect(raw).not.toMatch(/aggregateRating/i);
    expect(raw).not.toMatch(/reviewRating/i);
    expect(raw).not.toMatch(/evidence/i);
  });

  it("escapes < in script-serialized JSON-LD", () => {
    const raw = articleJsonLdScriptContent({
      headline: 'Title with </script> breakout',
      description: "summary <em>ok</em>",
      url: "https://relationshipcopilot.com/library/test",
    });
    expect(raw).toContain("\\u003c");
    expect(raw).not.toContain("<");
    // Still valid JSON after escape.
    const data = JSON.parse(raw);
    expect(data.headline).toBe("Title with </script> breakout");
    expect(data.description).toBe("summary <em>ok</em>");
  });
});

describe("serializeJsonLd", () => {
  it("escapes angle brackets without changing parseable values", () => {
    const escaped = serializeJsonLd({ a: "<b>x</b>" });
    expect(escaped).toBe('{"a":"\\u003cb>x\\u003c/b>"}');
    expect(JSON.parse(escaped).a).toBe("<b>x</b>");
  });
});
