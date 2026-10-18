import Anthropic from "@anthropic-ai/sdk";

export const MODEL = process.env.LUMI_MODEL || "claude-opus-5-5";
export const EFFORT = (process.env.LUMI_EFFORT || "low") as "low" | "medium" | "high";
export const FALLBACK_BETA = "server-side-fallback-2026-07-01";

let client: Anthropic | null = null;
export function getClient() {
  client ??= new Anthropic();
  return client;
}

export function hasCredentials() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export const MAX_MESSAGE_CHARS = 1200;
const MAX_TURNS = 40;

export type ChatTurn = Anthropic.MessageParam;

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];
const MAX_IMAGES = 2;
const MAX_IMAGE_B64 = 2_500_000; // ≈1.8 MB; the client sends ~0.3–0.8 MB JPEGs

/**
 * Accepts only a well-formed, bounded conversation that starts and ends with the child.
 * Wire format: { role, content: string, images?: { mediaType, data }[] } – images only on child turns.
 */
export function parseHistory(body: unknown): ChatTurn[] | null {
  const msgs = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(msgs) || msgs.length === 0) return null;
  const turns: ChatTurn[] = [];
  let imageCount = 0;
  for (const m of msgs.slice(-MAX_TURNS)) {
    const { role, content, images } = (m ?? {}) as { role?: unknown; content?: unknown; images?: unknown };
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") return null;
    const text = content.trim().slice(0, role === "user" ? MAX_MESSAGE_CHARS : 4000);

    const blocks: Anthropic.ImageBlockParam[] = [];
    if (images !== undefined) {
      if (role !== "user" || !Array.isArray(images)) return null;
      for (const img of images) {
        const { mediaType, data } = (img ?? {}) as { mediaType?: unknown; data?: unknown };
        if (!IMAGE_TYPES.includes(mediaType as ImageType) || typeof data !== "string") return null;
        if (data.length > MAX_IMAGE_B64 || !/^[A-Za-z0-9+/=]+$/.test(data)) return null;
        if (++imageCount > MAX_IMAGES) return null;
        blocks.push({ type: "image", source: { type: "base64", media_type: mediaType as ImageType, data } });
      }
    }

    if (blocks.length) {
      turns.push({ role: "user", content: [...blocks, { type: "text", text: text || "(Lapsi lähetti kuvan.)" }] });
    } else if (text) {
      turns.push({ role, content: text });
    }
  }
  while (turns.length && turns[0].role !== "user") turns.shift();
  if (!turns.length || turns[turns.length - 1].role !== "user") return null;
  return turns;
}

// Simple in-memory limiter so a public demo can't run up the bill.
const hits = new Map<string, number[]>();
const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = Number(process.env.LUMI_RATE_LIMIT || 60);

export function rateLimited(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > LIMIT;
}

export function jsonError(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export function apiErrorToResponse(err: unknown) {
  if (err instanceof Anthropic.AuthenticationError) return jsonError(503, "not_configured", "API-avain ei kelpaa.");
  if (err instanceof Anthropic.RateLimitError) return jsonError(429, "rate_limited", "Tekoälypalvelu on hetken ruuhkainen.");
  if (err instanceof Anthropic.APIError) return jsonError(502, "upstream", `Tekoälypalvelun virhe (${err.status ?? "?"}).`);
  return jsonError(500, "internal", "Odottamaton virhe.");
}
