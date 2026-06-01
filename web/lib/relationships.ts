import type { ConnectionType } from "@/lib/database.types";

// Free plan can hold this many connections; premium is unlimited (enforced
// server-side in createConnection).
export const FREE_CONNECTION_CAP = 3;

// Onboarding is a single, non-dated instance per connection. We pin it to a
// sentinel date so the unique(connection_id, kind, scheduled_for) constraint
// dedupes it (NULLs would not be deduped by Postgres).
export const ONBOARDING_DATE = "2000-01-01";

export const CONNECTION_TYPES: {
  value: ConnectionType;
  label: string;
  blurb: string;
}[] = [
  { value: "romantic", label: "Romantic partner", blurb: "Deepen intimacy and navigate life together." },
  { value: "friend", label: "Friend", blurb: "Stay close and grow a real friendship." },
  { value: "family", label: "Family", blurb: "Build understanding and shared meaning." },
  { value: "coworker", label: "Coworker", blurb: "Collaborate with trust and clarity." },
  { value: "parent_child", label: "Parent & child", blurb: "Connection-first, trust over surveillance." },
  { value: "sibling", label: "Sibling", blurb: "Reconnect and repair." },
  { value: "mentor", label: "Mentor / mentee", blurb: "Grow through guidance." },
];

export function connectionLabel(type: ConnectionType): string {
  return CONNECTION_TYPES.find((t) => t.value === type)?.label ?? type;
}
