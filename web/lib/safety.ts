import { SAFETY_INTERRUPT } from "@/lib/firstRevealCopy";

// Safety detection + resource routing. THIS RUNS FOR EVERY USER REGARDLESS OF
// PLAN — it is never behind the paywall. It is a deliberately conservative,
// keyword-based first pass that errs toward surfacing help; it does NOT
// diagnose, and high-severity hits are meant to route to human review before
// any AI output is shown (see the Blueprint flow). A production system should
// replace these heuristics with a proper classifier.

export type SafetyCategory = "self_harm" | "abuse" | "violence";
export type SafetySeverity = "none" | "elevated" | "high";

export interface SafetySignal {
  severity: SafetySeverity;
  categories: SafetyCategory[];
}

// Phones type curly apostrophes by default ("don’t want to be here"), people
// stretch and space words, and none of that may hide a disclosure from the
// patterns below, which are written against plain lower-case ASCII.
export function normalizeForSafety(text: string): string {
  return (text ?? "")
    .normalize("NFKC")
    .replace(/[‘’‛′ʼ`´]/g, "'")
    .replace(/[“”‟″]/g, '"')
    .replace(/[​-‏⁠﻿­]/g, "")
    .replace(/[‐-―]/g, "-")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

// Family words a child or a partner would use for the person they fear.
const PERSON =
  "(?:him|her|them|my (?:partner|husband|wife|boyfriend|girlfriend|ex|dad|father|mom|mum|mother|stepdad|stepfather|stepmom|stepmother|parents?|brother|sister|uncle|boss))";

const PATTERNS: { category: SafetyCategory; severity: SafetySeverity; rx: RegExp }[] = [
  {
    category: "self_harm",
    severity: "high",
    rx: /\b(kill myself|killing myself|end my life|ending my life|take my own life|end it all|suicid(?:e|al)|want to die|wanna die|wish i (?:was|were) dead|wish i'?d never been born|(?:do not|don'?t) want to (?:live|be here|be alive|wake up)|rather be dead|hurt(?:ing)? myself|harm(?:ing)? myself|self[-\s]?harm|cut(?:ting)? myself|overdos(?:e|ed|ing)|better off without me|no reason to (?:live|go on)|can'?t go on (?:like this|anymore|any more))\b/,
  },
  {
    category: "violence",
    severity: "high",
    rx: new RegExp(
      "\\b(hit me|hits me|hitting me|beat me|beats me|beating me|beat me up|threaten(?:ed|s)? me|hurt me|strangl|chok(?:ed|es|ing) me|punch(?:ed|es|ing)? me|slap(?:ped|s|ping)? me|kick(?:ed|s|ing) me(?! out)|push(?:ed|es)? me|shov(?:ed|es)? me|grab(?:bed|s)? me|thr(?:ew|ows) things at me" +
        "|(?:(?:he|she|they)(?:'s|'re| is| are| was| were) going|threaten(?:ed|s)?|wants?|tried|trying) to kill (?:me|him|her|us|them|you|the kids)|kill (?:him|her|them) (?:if|when)|pulled a (?:knife|gun) on" +
        "|rap(?:ed|es|ing) me|sexually (?:assault|abus)|molest|forc(?:ed|es|ing) (?:himself|herself|themselves) on me|forc(?:ed|es|ing) me to have sex|made me have sex|touch(?:ed|es|ing) me (?:where|when i (?:said|say) no|inappropriately|down there|in (?:a way|ways|places))" +
        "|(?:i|he|she|they) (?:hit|hits|beat|beats|slap(?:s|ped)?|punch(?:es|ed)?|chok(?:es|ed)) (?:him|her|them|the kids|the baby|my (?:kid|kids|son|daughter|child|children|wife|husband|girlfriend|boyfriend|partner)))\\b",
    ),
  },
  {
    category: "abuse",
    severity: "high",
    rx: new RegExp(
      `\\b((?:afraid|scared|terrified|frightened) of ${PERSON}|(?:afraid|scared|terrified) to (?:go|come|be) home|controls? (?:me|everything|who i)|(?:won'?t|will not|doesn'?t|does not) let me (?:see|leave|have|go|talk to|work)|isolat(?:e|es|ed|ing) me|threatens? to (?:kill|hurt|leave me|take (?:the|my) kids)|stalk(?:s|ing|ed) me|abus(?:es|ed|ing) me|(?:is|was|being) abusive|lock(?:s|ed) me (?:in|out)|(?:takes?|took|controls?) (?:all )?my (?:money|paycheck|passport|phone)|not allowed to (?:see|leave|talk to|have)|(?:told|tells) me (?:not to tell|to keep it (?:a )?secret))\\b`,
    ),
  },
  {
    category: "abuse",
    severity: "elevated",
    rx: /\b(yell(?:s|ed)? at me|scream(?:s|ed)? at me|calls me (?:stupid|worthless|names|crazy|fat|ugly)|puts me down|jealous (?:and|,)? controlling|gaslight(?:s|ing|ed)?|walking on eggshells|(?:checks|goes through|reads) my (?:phone|messages|texts|emails?)|tracks? (?:my location|where i (?:am|go))|forc(?:es|ed|ing) me to|humiliat(?:es|ed|ing) me|silent treatment)\b/,
  },
];

export function detectSafetySignals(text: string): SafetySignal {
  const normalized = normalizeForSafety(text);
  const found = new Map<SafetyCategory, SafetySeverity>();
  for (const p of PATTERNS) {
    if (p.rx.test(normalized)) {
      const cur = found.get(p.category);
      if (cur !== "high") found.set(p.category, p.severity);
    }
  }
  const categories = [...found.keys()];
  const severity: SafetySeverity = categories.length
    ? [...found.values()].includes("high")
      ? "high"
      : "elevated"
    : "none";
  return { severity, categories };
}

export interface SafetyResource {
  name: string;
  contact: string;
}

// A compact set surfaced inline when a signal fires; the full list lives at /safety.
export const INLINE_RESOURCES: SafetyResource[] = [
  { name: "988 Suicide & Crisis Lifeline", contact: "Call or text 988" },
  { name: "National Domestic Violence Hotline", contact: "1-800-799-7233 · text START to 88788" },
  { name: "Crisis Text Line", contact: "Text HOME to 741741" },
];

export const SAFETY_NOTE =
  "It sounds like things may be really hard right now. You deserve support from people trained to help — please consider reaching out.";

// Calm interrupt line (always free; never notifies the other person).
export const SAFETY_PRIVACY_LINE = SAFETY_INTERRUPT.calm;
