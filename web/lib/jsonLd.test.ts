import { describe, expect, it } from "vitest";
import {
  articleJsonLd,
  articleJsonLdScriptContent,
  homepageJsonLd,
  homepageJsonLdScriptContent,
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
});

describe("articleJsonLd", () => {
  const base = {
    headline: "Attachment basics",
    description: "A short summary.",
    url: "https://relationshipcopilot.com/library/attachment-basics",
    datePublished: "2026-01-15T00:00:00.000Z",
  };

  it("emits Article with Organization author/publisher @id", () => {
    const data = articleJsonLd(base);
    expect(data["@context"]).toBe("https://schema.org");
    expect(data["@type"]).toBe("Article");
    expect(data.headline).toBe("Attachment basics");
    expect(data.description).toBe("A short summary.");
    expect(data.url).toBe(base.url);
    expect(data.inLanguage).toBe("en");
    expect(data.datePublished).toBe(base.datePublished);
    expect(data.author).toEqual({
      "@id": "https://relationshipcopilot.com/#organization",
    });
    expect(data.publisher).toEqual({
      "@id": "https://relationshipcopilot.com/#organization",
    });
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
});
