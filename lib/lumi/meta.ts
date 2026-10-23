export type LumiMood = "curious" | "think" | "happy" | "celebrate";
/** How much help Lumi gave in a reply. Falling support = growing independence. */
export type LumiSupport = "high" | "medium" | "low" | "none";

export type LumiMeta = {
  mood: LumiMood;
  technique: string;
  support: LumiSupport;
  celebrate: boolean;
  /** Lumi stepped back: the child carries on alone. */
  handoff: boolean;
};

const MOODS: LumiMood[] = ["curious", "think", "happy", "celebrate"];
export const SUPPORTS: LumiSupport[] = ["high", "medium", "low", "none"];

/** Validates the model's status line; anything malformed falls back to safe defaults. */
export function normalizeMeta(raw: unknown): LumiMeta {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const mood = MOODS.includes(o.mood as LumiMood) ? (o.mood as LumiMood) : "curious";
  const handoff = o.handoff === true;
  const support = SUPPORTS.includes(o.support as LumiSupport) ? (o.support as LumiSupport) : handoff ? "none" : "medium";
  const technique = typeof o.technique === "string" && o.technique.trim() ? o.technique.trim().slice(0, 60) : "Ohjaa ajattelemaan";
  return { mood, support, technique, celebrate: o.celebrate === true || mood === "celebrate", handoff };
}

const OPEN = "<lumi>";
const CLOSE = "</lumi>";

/** Technical tags the model may echo (e.g. `<reasoning_effort>5</reasoning_effort>`); never shown to a child. */
const JUNK_NAMES = "lumi|reasoning_effort|effort|thinking|antml:[a-z_]+";
const JUNK_BLOCK = new RegExp(`<(${JUNK_NAMES})\\b[^>]*>[\\s\\S]*?</\\1>`, "gi");
const JUNK_TAG = new RegExp(`</?(${JUNK_NAMES})\\b[^>]*>`, "gi");

/** Removes status lines and other technical tags from text meant for the child. */
export function cleanVisible(text: string) {
  return text.replace(JUNK_BLOCK, "").replace(JUNK_TAG, "");
}

function parseMeta(json: string): LumiMeta {
  try {
    return normalizeMeta(JSON.parse(json));
  } catch {
    return normalizeMeta(null);
  }
}

/**
 * Incrementally separates the `<lumi>{…}</lumi>` status line from the visible reply while
 * text streams in. The status line normally comes last (so speech can start at once), but
 * it is recognised anywhere. Technical tags are stripped, partial tags at chunk edges are
 * held back, and whitespace around the status line never reaches the child.
 */
export class MetaSplitter {
  private pending = "";
  private metaFound = false;
  private started = false;

  /** Returns the parsed meta (once, whenever it completes) and visible text safe to emit. */
  push(chunk: string): { meta?: LumiMeta; text: string } {
    this.pending += chunk;
    let meta: LumiMeta | undefined;
    const block = /<lumi>([\s\S]*?)<\/lumi>/i.exec(this.pending);
    if (block) {
      if (!this.metaFound) {
        this.metaFound = true;
        meta = parseMeta(block[1]);
      }
      this.pending = this.pending.slice(0, block.index) + this.pending.slice(block.index + block[0].length);
    }
    return { meta, text: this.emit(false) };
  }

  /** Visible text still held back when the stream ends. */
  flush(): string {
    // An unfinished status line is never shown.
    this.pending = this.pending.replace(/<lumi>[\s\S]*$/i, "");
    return this.emit(true);
  }

  private emit(final: boolean): string {
    let hold = this.pending.length;
    if (!final) {
      // Hold back an unfinished tag or status block until it can be removed whole…
      const lt = this.pending.lastIndexOf("<");
      if (lt !== -1 && !this.pending.includes(">", lt) && this.pending.length - lt < 64) hold = lt;
      // A technical block (e.g. <reasoning_effort>…</reasoning_effort>) still waiting for its end tag.
      const opener = new RegExp(`<(${JUNK_NAMES})\\b[^>]*>`, "gi");
      for (let m; (m = opener.exec(this.pending)); ) {
        const closed = new RegExp(`</${m[1]}>`, "i").test(this.pending.slice(m.index));
        if (!closed && this.pending.length - m.index < 1500) {
          hold = Math.min(hold, m.index);
          break;
        }
      }
      // …and trailing whitespace, which may turn out to precede the status line.
      const ws = /\s*$/.exec(this.pending.slice(0, hold));
      if (ws) hold = ws.index;
    }
    let out = cleanVisible(this.pending.slice(0, hold));
    this.pending = this.pending.slice(hold);
    if (!this.started) {
      out = out.replace(/^\s+/, "");
      if (out) this.started = true;
    }
    if (final) {
      out = out.replace(/\s+$/, "");
      this.pending = "";
    }
    return out;
  }
}
