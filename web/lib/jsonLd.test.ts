import { describe, expect, it } from "vitest";
import { homepageJsonLd, homepageJsonLdScriptContent } from "./jsonLd";

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
