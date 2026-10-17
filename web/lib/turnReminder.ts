// Pure selection for the "still your turn" follow-up (cron, hourly). Picks,
// for each open shared set, the one person who hasn't answered when the
// other answered between MIN and MAX hours ago. Reads ids and timestamps
// only, never answer content. Unit-tested.

export const TURN_REMINDER_MIN_HOURS = 36;
export const TURN_REMINDER_MAX_HOURS = 7 * 24;

// Daily questions have their own reminder and move on every day; the
// follow-up is for the sets people put off.
export const TURN_REMINDER_KINDS = ["onboarding", "quiz", "challenge"] as const;

export interface OpenInstance {
  id: string;
  connection_id: string;
  kind: string;
  status: string;
}

export interface AnsweredRow {
  instance_id: string;
  user_id: string;
  submitted_at: string;
}

export interface TurnReminder {
  instanceId: string;
  connectionId: string;
  recipientId: string;
  answeredById: string;
}

export function pickTurnReminders(input: {
  instances: OpenInstance[];
  membersByConnection: Map<string, string[]>;
  responses: AnsweredRow[];
  now: Date;
  minHours?: number;
  maxHours?: number;
}): TurnReminder[] {
  const minMs = (input.minHours ?? TURN_REMINDER_MIN_HOURS) * 3600_000;
  const maxMs = (input.maxHours ?? TURN_REMINDER_MAX_HOURS) * 3600_000;
  const byInstance = new Map<string, AnsweredRow[]>();
  for (const r of input.responses) {
    const list = byInstance.get(r.instance_id) ?? [];
    list.push(r);
    byInstance.set(r.instance_id, list);
  }

  const out: TurnReminder[] = [];
  for (const inst of input.instances) {
    if (inst.status !== "open") continue;
    if (!(TURN_REMINDER_KINDS as readonly string[]).includes(inst.kind)) continue;
    const members = input.membersByConnection.get(inst.connection_id) ?? [];
    if (members.length !== 2) continue;

    const answered = (byInstance.get(inst.id) ?? []).filter((r) => members.includes(r.user_id));
    if (answered.length !== 1) continue;
    const [row] = answered;
    const waited = input.now.getTime() - new Date(row.submitted_at).getTime();
    if (!(waited >= minMs && waited <= maxMs)) continue;

    const recipient = members.find((m) => m !== row.user_id);
    if (!recipient) continue;
    out.push({
      instanceId: inst.id,
      connectionId: inst.connection_id,
      recipientId: recipient,
      answeredById: row.user_id,
    });
  }
  return out;
}
