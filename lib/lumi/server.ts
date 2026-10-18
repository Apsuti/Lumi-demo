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

export type ChatTurn = { role: "user" | "assistant"; content: string };

/** Accepts only a well-formed, bounded conversation that starts and ends with the child. */
export function parseHistory(body: unknown): ChatTurn[] | null {
  const msgs = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(msgs) || msgs.length === 0) return null;
  const turns: ChatTurn[] = [];
  for (const m of msgs.slice(-MAX_TURNS)) {
    const role = (m as ChatTurn)?.role;
    const content = (m as ChatTurn)?.content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") return null;
    const text = content.trim().slice(0, role === "user" ? MAX_MESSAGE_CHARS : 4000);
    if (!text) continue;
    turns.push({ role, content: text });
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
