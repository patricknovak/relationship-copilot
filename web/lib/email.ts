// Server-only transactional email via Resend's HTTP API. The domain already
// signs mail for Resend (Supabase auth uses it over SMTP), so this reuses that
// setup. Without RESEND_API_KEY every send is a logged no-op: the product
// works, it just doesn't email.

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
  // One-click unsubscribe (RFC 8058); clients show a native "Unsubscribe".
  unsubscribeUrl?: string;
}

export type SendResult =
  | { sent: true; id: string | null }
  | { sent: false; reason: "not_configured" | "rejected" | "failed" };

export const DEFAULT_FROM =
  "Relationship Copilot <noreply@relationshipcopilot.com>";

export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export async function sendEmail(mail: OutgoingEmail): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: "not_configured" };

  const headers: Record<string, string> = {};
  if (mail.unsubscribeUrl) {
    headers["List-Unsubscribe"] = `<${mail.unsubscribeUrl}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? DEFAULT_FROM,
        to: [mail.to],
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        headers,
      }),
      // A slow provider must not pin a server action or a cron run.
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      console.error("[email] provider rejected send", res.status);
      return { sent: false, reason: "rejected" };
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { sent: true, id: data.id ?? null };
  } catch (err) {
    console.error("[email] send failed", err);
    return { sent: false, reason: "failed" };
  }
}
