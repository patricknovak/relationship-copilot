// Server-only Grok (xAI) client, OpenAI-compatible. Never import into client
// components. The model is read from env so it can change without code edits.

export interface GrokMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

let warnedAboutDpa = false;

export async function grokChat(
  messages: GrokMessage[],
  opts: { json?: boolean; temperature?: number } = {},
): Promise<string> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error("XAI_API_KEY is not configured.");

  // Operational guardrail: production AI calls require an attested
  // no-training data agreement with the provider (XAI_NO_TRAINING_DPA=true).
  // Non-production environments warn once instead of failing, so local
  // development still works.
  if (process.env.XAI_NO_TRAINING_DPA !== "true") {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "AI features are disabled: XAI_NO_TRAINING_DPA is not attested. " +
          "Set XAI_NO_TRAINING_DPA=true only once a no-training DPA is in place.",
      );
    }
    if (!warnedAboutDpa) {
      warnedAboutDpa = true;
      console.warn(
        "[grok] XAI_NO_TRAINING_DPA is not set — AI calls would be blocked in production.",
      );
    }
  }
  const baseUrl = process.env.XAI_BASE_URL ?? "https://api.x.ai/v1";
  const model = process.env.XAI_MODEL ?? "grok-4";

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: opts.temperature ?? 0.4,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Grok request failed (${res.status}): ${detail.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Grok returned no content.");
  return content;
}
