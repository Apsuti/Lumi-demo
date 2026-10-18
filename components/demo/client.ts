import type { LumiMeta } from "@/lib/lumi/meta";

export type ApiTurn = { role: "user" | "assistant"; content: string };

type Handlers = {
  onMeta: (m: LumiMeta) => void;
  onDelta: (text: string) => void;
  onDone: (stopReason: string | null) => void;
  onError: (message: string) => void;
};

/** Calls /api/lumi and dispatches its server-sent events. Never throws. */
export async function streamLumi(messages: ApiTurn[], signal: AbortSignal, h: Handlers) {
  let res: Response;
  try {
    res = await fetch("/api/lumi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
      signal,
    });
  } catch {
    if (!signal.aborted) h.onError("En saanut yhteyttä. Tarkistetaanko verkkoyhteys?");
    return;
  }

  if (!res.ok || !res.body) {
    let message = "Jokin meni pieleen. Kokeillaan uudelleen.";
    try {
      const d = (await res.json()) as { error?: { message?: string } };
      if (d.error?.message) message = d.error.message;
    } catch {
      /* keep default */
    }
    h.onError(message);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let finished = false;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let cut: number;
      while ((cut = buf.indexOf("\n\n")) !== -1) {
        const block = buf.slice(0, cut);
        buf = buf.slice(cut + 2);
        const event = /^event: (.+)$/m.exec(block)?.[1];
        const data = /^data: (.*)$/m.exec(block)?.[1];
        if (!event || data === undefined) continue;
        const payload = JSON.parse(data);
        if (event === "meta") h.onMeta(payload as LumiMeta);
        else if (event === "delta") h.onDelta(payload.text as string);
        else if (event === "done") {
          finished = true;
          h.onDone(payload.stop_reason ?? null);
        } else if (event === "error") {
          finished = true;
          h.onError(payload.message as string);
        }
      }
    }
  } catch {
    if (signal.aborted) return;
  }
  if (!finished && !signal.aborted) h.onError("Yhteys katkesi kesken. Kokeillaan uudelleen.");
}
