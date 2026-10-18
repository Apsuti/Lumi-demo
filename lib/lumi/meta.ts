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

/**
 * Incrementally separates the leading `<lumi>{…}</lumi>` status line from the
 * visible reply while text streams in.
 */
export class MetaSplitter {
  private buf = "";
  private resolved = false;

  /** Returns the parsed meta (once) and any visible text that is safe to emit. */
  push(chunk: string): { meta?: LumiMeta; text: string } {
    if (this.resolved) return { text: chunk };
    this.buf += chunk;
    const lead = this.buf.trimStart();

    // Still could be the opening tag – wait for more.
    if (lead.length < OPEN.length && OPEN.startsWith(lead)) return { text: "" };

    if (!lead.startsWith(OPEN)) {
      this.resolved = true;
      return { text: this.buf };
    }

    const end = lead.indexOf(CLOSE);
    if (end === -1) {
      if (lead.length > 800) {
        // Never closed: drop the broken header rather than show it to a child.
        this.resolved = true;
        return { text: "" };
      }
      return { text: "" };
    }

    this.resolved = true;
    let meta: LumiMeta;
    try {
      meta = normalizeMeta(JSON.parse(lead.slice(OPEN.length, end)));
    } catch {
      meta = normalizeMeta(null);
    }
    return { meta, text: lead.slice(end + CLOSE.length).replace(/^\s+/, "") };
  }

  /** Text still held back when the stream ends without a complete header. */
  flush(): string {
    if (this.resolved) return "";
    this.resolved = true;
    return this.buf.trimStart().startsWith(OPEN) ? "" : this.buf;
  }
}
