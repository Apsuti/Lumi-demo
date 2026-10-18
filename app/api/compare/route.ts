import { BASELINE_SYSTEM_PROMPT } from "@/lib/lumi/prompt";
import {
  EFFORT,
  FALLBACK_BETA,
  MODEL,
  MAX_MESSAGE_CHARS,
  apiErrorToResponse,
  getClient,
  hasCredentials,
  jsonError,
  rateLimited,
} from "@/lib/lumi/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Generates how an ordinary answer-giving AI would respond – shown side by side with Lumi. */
export async function POST(req: Request) {
  if (!hasCredentials()) return jsonError(503, "not_configured", "API-avain puuttuu.");
  if (rateLimited(req)) return jsonError(429, "rate_limited", "Pidetään pieni tauko.");

  let prompt = "";
  try {
    const body = (await req.json()) as { prompt?: unknown };
    prompt = typeof body.prompt === "string" ? body.prompt.trim().slice(0, MAX_MESSAGE_CHARS) : "";
  } catch {
    /* handled below */
  }
  if (!prompt) return jsonError(400, "bad_request", "Virheellinen pyyntö.");

  try {
    const response = await getClient().beta.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: BASELINE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
      output_config: { effort: EFFORT },
      betas: [FALLBACK_BETA],
      fallbacks: "default",
    });
    if (response.stop_reason === "refusal") return Response.json({ text: null });
    const text = response.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    return Response.json({ text });
  } catch (err) {
    return apiErrorToResponse(err);
  }
}
