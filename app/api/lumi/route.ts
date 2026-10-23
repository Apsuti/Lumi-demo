import Anthropic from "@anthropic-ai/sdk";
import { MetaSplitter } from "@/lib/lumi/meta";
import { LUMI_SYSTEM_PROMPT } from "@/lib/lumi/prompt";
import {
  EFFORT,
  FALLBACK_BETA,
  MODEL,
  apiErrorToResponse,
  getClient,
  hasCredentials,
  jsonError,
  parseHistory,
  rateLimited,
} from "@/lib/lumi/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST { messages: {role, content}[] } → text/event-stream
 *   event: meta   data: LumiMeta          (mood, technique, support, celebrate, handoff)
 *   event: delta  data: {"text": "..."}   (visible reply, streamed)
 *   event: done   data: {"stop_reason": "...", "model": "..."}
 *   event: error  data: {"message": "..."}
 */
export async function POST(req: Request) {
  if (!hasCredentials()) {
    return jsonError(503, "not_configured", "Lisää ANTHROPIC_API_KEY tiedostoon .env.local ja käynnistä palvelin uudelleen.");
  }
  if (rateLimited(req)) return jsonError(429, "rate_limited", "Pidetään pieni tauko ja jatketaan hetken päästä.");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "bad_request", "Virheellinen pyyntö.");
  }
  const messages = parseHistory(body);
  if (!messages) return jsonError(400, "bad_request", "Virheellinen keskustelu.");

  let stream;
  try {
    stream = getClient().beta.messages.stream(
      {
        model: MODEL,
        max_tokens: 4000,
        system: LUMI_SYSTEM_PROMPT,
        messages,
        output_config: { effort: EFFORT },
        cache_control: { type: "ephemeral" },
        betas: [FALLBACK_BETA],
        fallbacks: "default",
      },
      { signal: req.signal },
    );
  } catch (err) {
    return apiErrorToResponse(err);
  }

  const encoder = new TextEncoder();
  const send = (controller: ReadableStreamDefaultController, event: string, data: unknown) =>
    controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));

  const body$ = new ReadableStream({
    async start(controller) {
      const splitter = new MetaSplitter();
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            const { meta, text } = splitter.push(event.delta.text);
            if (meta) send(controller, "meta", meta);
            if (text) send(controller, "delta", { text });
          }
        }
        const rest = splitter.flush();
        if (rest) send(controller, "delta", { text: rest });
        const final = await stream.finalMessage();
        send(controller, "done", { stop_reason: final.stop_reason, model: final.model });
      } catch (err) {
        if (!req.signal.aborted) {
          const message =
            err instanceof Anthropic.RateLimitError
              ? "Tekoälypalvelu on hetken ruuhkainen. Kokeillaan pian uudelleen."
              : err instanceof Anthropic.AuthenticationError
                ? "API-avain ei kelpaa."
                : "Yhteys tekoälyyn katkesi. Kokeillaan uudelleen.";
          send(controller, "error", { message });
        }
      } finally {
        controller.close();
      }
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(body$, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function GET() {
  return Response.json({ configured: hasCredentials(), model: MODEL });
}
