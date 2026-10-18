export type LumiMood = "curious" | "think" | "happy" | "celebrate";
export type LumiPhase = "ymmärrä" | "tutki" | "kokeile" | "oivalla" | "pohdi";

export type LumiMeta = {
  mood: LumiMood;
  technique: string;
  phase: LumiPhase;
  note: string | null;
  celebrate: boolean;
};

export const PHASES: { id: LumiPhase; label: string }[] = [
  { id: "ymmärrä", label: "Ymmärrä" },
  { id: "tutki", label: "Tutki" },
  { id: "kokeile", label: "Kokeile" },
  { id: "oivalla", label: "Oivalla" },
  { id: "pohdi", label: "Pohdi" },
];

const MOODS: LumiMood[] = ["curious", "think", "happy", "celebrate"];

/** Validates the model's status line; anything malformed falls back to safe defaults. */
export function normalizeMeta(raw: unknown): LumiMeta {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const mood = MOODS.includes(o.mood as LumiMood) ? (o.mood as LumiMood) : "curious";
  const phase = PHASES.some((p) => p.id === o.phase) ? (o.phase as LumiPhase) : "tutki";
  const technique = typeof o.technique === "string" && o.technique.trim() ? o.technique.trim().slice(0, 60) : "Ohjaa ajattelemaan";
  const note = typeof o.note === "string" && o.note.trim() ? o.note.trim().slice(0, 90) : null;
  return { mood, phase, technique, note, celebrate: o.celebrate === true || mood === "celebrate" };
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
 * Incrementally separates the `<lumi>{…}</lumi>` status line from the visible
 * reply while text streams in. Tolerates other tags before it and strips any
 * technical tags from the visible text, holding back partial tags at chunk edges.
 */
export class MetaSplitter {
  private buf = "";
  private resolved = false;
  private pending = "";

  /** Returns the parsed meta (once) and any visible text that is safe to emit. */
  push(chunk: string): { meta?: LumiMeta; text: string } {
    if (this.resolved) return { text: this.emit(chunk) };
    this.buf += chunk;

    const end = this.buf.indexOf(CLOSE);
    if (end !== -1) {
      const start = this.buf.lastIndexOf(OPEN, end);
      this.resolved = true;
      const meta = parseMeta(start === -1 ? "" : this.buf.slice(start + OPEN.length, end));
      return { meta, text: this.emit(this.buf.slice(end + CLOSE.length).replace(/^\s+/, "")) };
    }

    // A reply that opens with a tag is still in its preamble – wait for the status line.
    if (this.buf.trimStart().startsWith("<") && this.buf.length < 1500) return { text: "" };

    this.resolved = true;
    return { text: this.emit(this.buf) };
  }

  /** Visible text still held back when the stream ends. */
  flush(): string {
    if (!this.resolved) {
      this.resolved = true;
      this.pending += this.buf;
    }
    const rest = cleanVisible(this.pending.replace(/<lumi>(?![\s\S]*<\/lumi>)[\s\S]*$/i, ""));
    this.pending = "";
    return rest.trim() ? rest : "";
  }

  private emit(text: string): string {
    this.pending += text;
    // Hold back an unfinished tag or status block until it can be removed whole.
    let hold = this.pending.length;
    const lt = this.pending.lastIndexOf("<");
    if (lt !== -1 && !this.pending.includes(">", lt) && this.pending.length - lt < 64) hold = lt;
    const open = this.pending.search(/<lumi>(?![\s\S]*<\/lumi>)/i);
    if (open !== -1) hold = Math.min(hold, open);
    const out = cleanVisible(this.pending.slice(0, hold));
    this.pending = this.pending.slice(hold);
    return out;
  }
}
