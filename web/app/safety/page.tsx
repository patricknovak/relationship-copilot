import type { Metadata } from "next";
import QuickExit from "@/components/QuickExit";

export const metadata: Metadata = {
  title: "Safety & Support — Relationship Copilot",
  description:
    "Immediate, free support resources. If you are in danger, call your local emergency number.",
};

type Resource = {
  name: string;
  contact: string;
  detail: string;
  href?: string;
};

// US-based resources. These are always free and never behind a paywall.
const RESOURCES: Resource[] = [
  {
    name: "988 Suicide & Crisis Lifeline",
    contact: "Call or text 988",
    detail: "24/7 free, confidential support for emotional distress or suicidal crisis.",
    href: "https://988lifeline.org",
  },
  {
    name: "Crisis Text Line",
    contact: "Text HOME to 741741",
    detail: "24/7 text-based support with a trained crisis counselor.",
    href: "https://www.crisistextline.org",
  },
  {
    name: "National Domestic Violence Hotline",
    contact: "Call 1-800-799-7233 · Text START to 88788",
    detail: "24/7 confidential support for anyone affected by relationship abuse.",
    href: "https://www.thehotline.org",
  },
  {
    name: "love is respect (for teens & young adults)",
    contact: "Call 1-866-331-9474 · Text LOVEIS to 22522",
    detail: "Support and information about healthy and unhealthy relationships.",
    href: "https://www.loveisrespect.org",
  },
  {
    name: "RAINN (sexual assault)",
    contact: "Call 1-800-656-4673",
    detail: "24/7 free, confidential support for survivors of sexual violence.",
    href: "https://www.rainn.org",
  },
  {
    name: "Childhelp National Child Abuse Hotline",
    contact: "Call or text 1-800-422-4453",
    detail: "24/7 support for children and adults concerned about a child's safety.",
    href: "https://www.childhelp.org",
  },
];

export default function SafetyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <QuickExit />

      <div className="rounded-lg bg-rose-50 border border-rose-200 p-4">
        <p className="font-semibold text-rose-800">
          If you are in immediate danger, call your local emergency number
          (911 in the US).
        </p>
        <p className="mt-2 text-sm text-rose-900">
          The <span className="font-medium">Quick exit</span> button (or the
          Escape key) instantly replaces this page with an unrelated site. If
          someone may check your device, consider using a private/incognito
          window or a safer device, such as a library or work computer.
        </p>
      </div>

      <h1 className="mt-8 text-2xl font-bold">Safety &amp; Support</h1>
      <p className="mt-2 text-gray-600">
        These resources are free and confidential. Relationship Copilot is not a
        crisis service and does not provide therapy — please reach out to the
        people below for real-time help.
      </p>

      <ul className="mt-6 space-y-4">
        {RESOURCES.map((r) => (
          <li
            key={r.name}
            className="rounded-lg border border-gray-100 p-4"
          >
            <h2 className="font-semibold">{r.name}</h2>
            <p className="mt-1 text-brand-700 font-medium">{r.contact}</p>
            <p className="mt-1 text-sm text-gray-600">{r.detail}</p>
            {r.href && (
              <a
                href={r.href}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-sm underline text-gray-500"
              >
                {r.href.replace("https://", "")}
              </a>
            )}
          </li>
        ))}
      </ul>

      <p className="mt-8 text-xs text-gray-500">
        Resources listed are US-based. Availability and numbers may change; if a
        number does not work, search for your local equivalent or contact local
        emergency services.
      </p>
    </div>
  );
}
