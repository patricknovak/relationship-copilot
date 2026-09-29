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
