import { CANONICAL_ORIGIN } from "@/lib/site";

/**
 * Homepage JSON-LD. Claims only mirror public marketing copy (About + Pricing).
 * No aggregate ratings/reviews — those are not published on the site.
 */
export function homepageJsonLd() {
  const orgId = `${CANONICAL_ORIGIN}/#organization`;
  const websiteId = `${CANONICAL_ORIGIN}/#website`;
  const appId = `${CANONICAL_ORIGIN}/#app`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": orgId,
        name: "Relationship Copilot",
        url: CANONICAL_ORIGIN,
        description:
          "Answer thoughtful questions together and see each other's answers only when you've both shared — for partners, friends, family, and coworkers.",
        foundingLocation: {
          "@type": "Place",
          name: "Vancouver, Canada",
        },
        founder: {
          "@type": "Person",
          name: "Patrick Novak",
        },
      },
      {
        "@type": "WebSite",
        "@id": websiteId,
        url: CANONICAL_ORIGIN,
        name: "Relationship Copilot",
        description:
          "Closer, on purpose — prompts you answer privately and only share together.",
        publisher: { "@id": orgId },
        inLanguage: "en",
      },
      {
        "@type": ["SoftwareApplication", "WebApplication"],
        "@id": appId,
        name: "Relationship Copilot",
        url: CANONICAL_ORIGIN,
        applicationCategory: "LifestyleApplication",
        operatingSystem: "Web",
        browserRequirements: "Requires JavaScript",
        offers: {
          "@type": "Offer",
          name: "Premium",
          price: "18.00",
          priceCurrency: "USD",
          description:
            "Premium ($18/mo) adds the AI Relationship Blueprint and weekly digests. Core prompts and safety resources stay free.",
          url: `${CANONICAL_ORIGIN}/pricing`,
          priceSpecification: {
            "@type": "UnitPriceSpecification",
            price: "18.00",
            priceCurrency: "USD",
            billingDuration: "P1M",
          },
        },
        publisher: { "@id": orgId },
        isPartOf: { "@id": websiteId },
      },
    ],
  };
}

/** Serialize for a `<script type="application/ld+json">` tag (non-executable). */
export function homepageJsonLdScriptContent(): string {
  return JSON.stringify(homepageJsonLd());
}

export type ArticleJsonLdInput = {
  headline: string;
  description: string | null;
  url: string;
  /** ISO timestamp from education_articles.created_at when available. */
  datePublished?: string | null;
};

/**
 * Article JSON-LD for public library pages. Reuses the homepage Organization
 * `@id`. Evidence stars are display-only — never mapped to AggregateRating.
 */
export function articleJsonLd(input: ArticleJsonLdInput) {
  const orgId = `${CANONICAL_ORIGIN}/#organization`;
  const node: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.headline,
    url: input.url,
    inLanguage: "en",
    author: { "@id": orgId },
    publisher: { "@id": orgId },
    isPartOf: { "@id": `${CANONICAL_ORIGIN}/#website` },
  };
  if (input.description) {
    node.description = input.description;
  }
  // Only real columns: education_articles has created_at, no updated_at.
  if (input.datePublished) {
    node.datePublished = input.datePublished;
  }
  return node;
}

export function articleJsonLdScriptContent(input: ArticleJsonLdInput): string {
  return JSON.stringify(articleJsonLd(input));
}
