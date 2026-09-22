import type { Metadata } from "next";
import { canonicalUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in to Relationship Copilot to answer prompts privately and reveal together with someone you care about.",
  alternates: { canonical: canonicalUrl("/login") },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
