"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Lightbulb, NotebookPen, RotateCcw, SendHorizontal, Volume2, VolumeX, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import LumiCharacter, { type LumiMood } from "../LumiCharacter";
import { PHASES, type LumiMeta, type LumiPhase } from "@/lib/lumi/meta";
import { streamLumi, type ApiTurn } from "./client";
import { useSpeech } from "./useSpeech";
import { useVoiceInput } from "./useVoiceInput";
import { HeardHint, MicButton, VoicePanel } from "./Voice";

type ChatMsg = {
  id: number;
  role: "user" | "lumi";
  text: string;
  meta?: LumiMeta;
  status?: "streaming" | "done" | "error";
};

const WELCOME = [
  "En ole täällä tekemässä tehtäviä puolestasi.",
  "Olen täällä auttamassa sinua löytämään vastauksia itse.",
  "Mietitään, tutkitaan ja oivalletaan yhdessä.",
];

const STARTERS = [
  { emoji: "🔢", title: "Matematiikka", prompt: "En ymmärrä murtolukuja", accent: "from-sky-400 to-sky-600" },
  { emoji: "✏️", title: "Kirjoittaminen", prompt: "Keksi tarina lohikäärmeestä", accent: "from-lilac-400 to-lilac-600" },
  { emoji: "🎨", title: "Luova ajattelu", prompt: "Keksi peli", accent: "from-peach-400 to-lilac-500" },
  { emoji: "🔭", title: "Tiedonhaku", prompt: "Miksi taivas on sininen?", accent: "from-mint-400 to-sky-500" },
];

const HELPERS = ["Anna pieni vihje 💡", "En tiedä vielä", "Selitä toisella tavalla"];

const EMPTY_TEXT = "Hmm, ajatus karkasi. Voisitko kertoa sen vielä uudestaan? 🙂";

const REFUSED_TEXT =
  "Tästä aiheesta en pysty juttelemaan. Jos asia mietityttää, kysy siitä luotetulta aikuiselta. Tutkitaanko yhdessä jotain muuta? 🙂";

let seq = 0;
const nextId = () => ++seq;

/** Rebuilds what the model actually said (status line + reply) so the conversation stays consistent. */
function toApiHistory(msgs: ChatMsg[]): ApiTurn[] {
  return msgs
    .filter((m) => m.role === "user" || (m.status === "done" && m.text))
    .map((m) =>
      m.role === "user"
        ? { role: "user", content: m.text }
        : { role: "assistant", content: m.meta ? `<lumi>${JSON.stringify(m.meta)}</lumi>\n${m.text}` : m.text },
    );
}

export default function Demo() {
  const [phase, setPhase] = useState<"welcome" | "start" | "chat">("welcome");
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [mood, setMood] = useState<LumiMood>("greet");
  const [burst, setBurst] = useState(0);
  const [meta, setMeta] = useState<LumiMeta | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [fromVoice, setFromVoice] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);

  const speech = useSpeech();
  const speechRef = useRef(speech);
  speechRef.current = speech;

  const voice = useVoiceInput((text) => {
    setDraft((d) => (d.trim() ? `${d.trim()} ${text}` : text));
    setFromVoice(true);
  });

  const abortRef = useRef<AbortController | null>(null);
  const msgsRef = useRef(msgs);
  msgsRef.current = msgs;
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/lumi")
      .then((r) => r.json())
      .then((d: { configured?: boolean }) => setConfigured(Boolean(d.configured)))
      .catch(() => setConfigured(false));
    const t = setTimeout(() => setMood("happy"), 2000);
    const t2 = setTimeout(() => setMood("idle"), 3600);
    return () => {
      abortRef.current?.abort();
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [msgs, waiting]);

  // Lumi looks attentive while the child is talking.
  useEffect(() => {
    if (voice.active) setMood("curious");
  }, [voice.active]);

  const patchMsg = (id: number, patch: Partial<ChatMsg> | ((m: ChatMsg) => Partial<ChatMsg>)) =>
    setMsgs((prev) => prev.map((m) => (m.id === id ? { ...m, ...(typeof patch === "function" ? patch(m) : patch) } : m)));

  const ask = useCallback(async (history: ChatMsg[]) => {
    const lumiId = nextId();
    setMsgs([...history, { id: lumiId, role: "lumi", text: "", status: "streaming" }]);
    setBusy(true);
    setWaiting(true);
    setMood("think");

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let gotMeta: LumiMeta | undefined;
    let spoken = "";

    await streamLumi(toApiHistory(history), ctrl.signal, {
      onMeta: (m) => {
        gotMeta = m;
        setMeta(m);
        patchMsg(lumiId, { meta: m });
        if (m.note) setNotes((n) => (n.includes(m.note!) ? n : [...n, m.note!]));
        setMood(m.celebrate ? "celebrate" : m.mood);
        if (m.celebrate) setBurst((b) => b + 1);
      },
      onDelta: (text) => {
        spoken += text;
        setWaiting(false);
        patchMsg(lumiId, (m) => ({ text: m.text + text }));
      },
      onDone: (stopReason) => {
        if (stopReason === "refusal") {
          spoken = REFUSED_TEXT;
          patchMsg(lumiId, { text: REFUSED_TEXT, meta: undefined, status: "done" });
          setMood("happy");
        } else {
          spoken ||= EMPTY_TEXT;
          patchMsg(lumiId, { status: "done", text: spoken });
        }
        if (speechRef.current.autoSpeak) speechRef.current.speak(lumiId, spoken);
      },
      onError: (message) => {
        patchMsg(lumiId, { text: message, status: "error" });
        setMood("curious");
      },
    });

    if (ctrl.signal.aborted) return;
    setWaiting(false);
    setBusy(false);
    if (gotMeta?.celebrate) setTimeout(() => setMood("happy"), 2600);
    else if (gotMeta) setMood(gotMeta.mood === "think" ? "idle" : gotMeta.mood);
    if (window.matchMedia("(pointer: fine)").matches) inputRef.current?.focus({ preventScroll: true });
  }, []);

  const send = (raw: string) => {
    const text = raw.trim();
    if (!text || busy) return;
    voice.cancel();
    speech.stop();
    setDraft("");
    setFromVoice(false);
    if (phase !== "chat") setPhase("chat");
    const base = msgsRef.current.filter((m) => m.status !== "error");
    ask([...base, { id: nextId(), role: "user", text }]);
  };

  const listen = () => {
    speech.stop(); // never let the mic hear Lumi's own voice
    setFromVoice(false);
    voice.start();
  };

  const redo = () => {
    setDraft("");
    listen();
  };

  const retry = () => {
    if (busy) return;
    ask(msgsRef.current.filter((m) => m.status !== "error"));
  };

  const reset = () => {
    abortRef.current?.abort();
    speech.stop();
    voice.cancel();
    setMsgs([]);
    setNotes([]);
    setMeta(null);
    setBusy(false);
    setWaiting(false);
    setDraft("");
    setFromVoice(false);
    setMood("curious");
    setSheet(false);
    setPhase("start");
  };

  const lumiSpeaking = speech.speakingId !== null;
  const toggle = <SpeechToggle supported={speech.supported} on={speech.autoSpeak} onChange={speech.setAutoSpeak} />;

  const composer = (placeholder: string) => (
    <div className="border-t border-ink/[0.06] bg-white/85 backdrop-blur">
      <VoicePanel voice={voice} onStop={voice.stop} onCancel={voice.cancel} onRetry={listen} onDismiss={voice.dismissError} />
      <AnimatePresence>{fromVoice && draft && !voice.active && <HeardHint onRedo={redo} />}</AnimatePresence>
      <AnimatePresence>
        {phase === "chat" && !busy && !voice.active && !fromVoice && voice.state !== "error" && msgs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="no-scrollbar flex gap-2 overflow-x-auto px-4 pt-3 sm:px-6"
          >
            {HELPERS.map((h) => (
              <button
                key={h}
                onClick={() => send(h)}
                className="shrink-0 rounded-full border border-lilac-200 bg-white px-3.5 py-1.5 text-[13px] font-semibold text-ink-soft transition hover:-translate-y-0.5 hover:border-lilac-400 hover:bg-lilac-50"
              >
                {h}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <Composer
        draft={draft}
        setDraft={(v) => {
          setDraft(v);
          if (!v) setFromVoice(false);
        }}
        disabled={busy || voice.active}
        highlightSend={fromVoice}
        onSend={send}
        inputRef={inputRef}
        placeholder={voice.active ? "Kuuntelen…" : busy ? "Lumi miettii…" : placeholder}
        mic={voice.supported ? <MicButton voice={voice} disabled={busy} onStart={listen} onStop={voice.stop} /> : null}
      />
    </div>
  );

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-white/80 shadow-[0_40px_120px_-40px_rgba(91,135,245,0.45)] ring-1 ring-ink/[0.05] backdrop-blur-xl sm:rounded-[2.5rem]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_10%_0%,rgba(204,221,255,0.55),transparent),radial-gradient(50%_50%_at_100%_100%,rgba(221,210,255,0.55),transparent)]" />
      <div className="relative h-[calc(100svh-4.5rem)] max-h-[900px] min-h-[540px] sm:h-[calc(100svh-6rem)]">
        <AnimatePresence mode="wait">
          {phase === "welcome" && (
            <Welcome
              key="welcome"
              mood={mood}
              burst={burst}
              onStart={() => {
                setMood("curious");
                setPhase("start");
              }}
            />
          )}

          {phase === "start" && (
            <motion.div key="start" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex h-full flex-col">
              <div className="no-scrollbar relative flex-1 overflow-y-auto px-5 py-8 sm:px-10 sm:py-10">
                <div className="absolute right-4 top-4 sm:right-6 sm:top-6">{toggle}</div>
                <Start configured={configured} mood={voice.active ? "curious" : mood} micSupported={voice.supported} onPick={send} />
              </div>
              {composer("Kirjoita tai paina mikkiä…")}
            </motion.div>
          )}

          {phase === "chat" && (
            <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid h-full grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="flex min-h-0 min-w-0 flex-col">
                <ChatHeader
                  mood={mood}
                  burst={burst}
                  status={voice.active ? "kuuntelee sinua…" : waiting ? "miettii…" : busy ? "kirjoittaa…" : lumiSpeaking ? "puhuu…" : "sinun vuorosi"}
                  phase={meta?.phase}
                  speaking={lumiSpeaking}
                  toggle={toggle}
                  onBack={reset}
                  onSheet={() => setSheet(true)}
                />

                <div ref={scrollRef} className="no-scrollbar flex-1 space-y-3 overflow-y-auto px-4 pb-4 pt-4 sm:px-6">
                  {msgs.map((m) =>
                    m.role === "user" ? (
                      <UserBubble key={m.id} text={m.text} />
                    ) : (
                      <LumiBubble
                        key={m.id}
                        msg={m}
                        waiting={waiting}
                        onRetry={retry}
                        canSpeak={speech.supported}
                        speaking={speech.speakingId === m.id}
                        onSpeak={() => (speech.speakingId === m.id ? speech.stop() : speech.speak(m.id, m.text))}
                      />
                    ),
                  )}
                </div>

                {composer("Kirjoita tai paina mikkiä…")}
              </div>

              <aside className="hidden min-h-0 flex-col gap-4 overflow-y-auto border-l border-ink/[0.06] bg-gradient-to-b from-white/60 to-lilac-50/60 p-5 lg:flex">
                <SidePanel mood={mood} burst={burst} talking={busy && !waiting} speaking={lumiSpeaking} meta={meta} notes={notes} noFinnishVoice={speech.supported && !speech.hasFinnishVoice} />
              </aside>

              <AnimatePresence>
                {sheet && (
                  <motion.div
                    className="absolute inset-0 z-20 flex flex-col bg-white/95 backdrop-blur lg:hidden"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 30 }}
                  >
                    <div className="flex items-center justify-between px-5 pt-5">
                      <span className="font-display text-base font-extrabold">Oivallukset</span>
                      <button onClick={() => setSheet(false)} className="grid h-9 w-9 place-items-center rounded-full bg-ink/5" aria-label="Sulje">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex-1 space-y-4 overflow-y-auto p-5">
                      <SidePanel mood={mood} burst={burst} talking={false} speaking={false} meta={meta} notes={notes} noFinnishVoice={speech.supported && !speech.hasFinnishVoice} compact />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ───────────────────────── Welcome & start ───────────────────────── */

function Welcome({ mood, burst, onStart }: { mood: LumiMood; burst: number; onStart: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -10 }} className="flex h-full flex-col items-center justify-center px-6 text-center">
      <LumiCharacter size={150} mood={mood} burstKey={burst} />
      <motion.h1
        className="mt-8 font-display text-3xl font-extrabold tracking-tight sm:text-4xl"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.6 }}
      >
        Hei! Minä olen Lumi.
      </motion.h1>
      <div className="mt-4 max-w-md space-y-1.5">
        {WELCOME.map((line, i) => (
          <motion.p
            key={line}
            className={`text-base leading-relaxed sm:text-lg ${i === 2 ? "font-semibold text-lilac-600" : "text-ink-soft"}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1 + i * 0.75, duration: 0.6 }}
          >
            {line}
          </motion.p>
        ))}
      </div>
      <motion.button
        onClick={onStart}
        className="btn-primary mt-9"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 3.6, duration: 0.5 }}
      >
        Aloitetaan yhdessä <ArrowRight className="h-4 w-4" />
      </motion.button>
    </motion.div>
  );
}

function Start({
  configured,
  mood,
  micSupported,
  onPick,
}: {
  configured: boolean | null;
  mood: LumiMood;
  micSupported: boolean;
  onPick: (p: string) => void;
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-col items-center text-center">
        <LumiCharacter size={84} mood={mood === "idle" ? "curious" : mood} />
        <h2 className="mt-5 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">Mitä tutkitaan tänään?</h2>
        <p className="mt-2 text-ink-soft">
          {micSupported ? "Kirjoita, paina mikkiä ja puhu – tai valitse joku näistä." : "Kirjoita oma kysymys – tai valitse joku näistä."}
        </p>
      </div>

      {configured === false && (
        <div className="mt-6 rounded-2xl border border-peach-400/40 bg-peach-100/70 px-4 py-3 text-sm text-ink-soft">
          <span className="font-bold text-ink">Tekoälyä ei ole vielä yhdistetty.</span> Lisää <code className="rounded bg-white/70 px-1">ANTHROPIC_API_KEY</code>{" "}
          palvelimen ympäristömuuttujiin.
        </div>
      )}

      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        {STARTERS.map((s, i) => (
          <motion.button
            key={s.title}
            onClick={() => onPick(s.prompt)}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 + i * 0.06 }}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.98 }}
            className="group flex items-center gap-4 rounded-3xl border border-ink/[0.06] bg-white p-4 text-left shadow-soft transition-shadow hover:shadow-lift"
          >
            <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${s.accent} text-2xl shadow-soft`}>{s.emoji}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-ink-mute">{s.title}</span>
              <span className="block font-display text-[17px] font-extrabold text-ink">”{s.prompt}”</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-lilac-500 opacity-0 transition group-hover:opacity-100" />
          </motion.button>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── Chat pieces ───────────────────────── */

function ChatHeader({
  mood,
  burst,
  status,
  phase,
  speaking,
  toggle,
  onBack,
  onSheet,
}: {
  mood: LumiMood;
  burst: number;
  status: string;
  phase?: LumiPhase;
  speaking: boolean;
  toggle: React.ReactNode;
  onBack: () => void;
  onSheet: () => void;
}) {
  return (
    <div className="border-b border-ink/[0.06] bg-white/70 px-4 pb-3 pt-3.5 backdrop-blur sm:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink/[0.04] text-ink-soft transition hover:bg-ink/[0.08]"
          aria-label="Aloita alusta"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="lg:hidden">
          <LumiCharacter size={40} mood={mood} burstKey={burst} speaking={speaking} float={false} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-[15px] font-extrabold">Lumi</div>
          <div className="truncate text-xs text-ink-mute">{status}</div>
        </div>
        {toggle}
        <button
          onClick={onSheet}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sky-50 text-sky-600 lg:hidden"
          aria-label="Oivallukset"
        >
          <NotebookPen className="h-4 w-4" />
        </button>
      </div>
      <PhaseBar phase={phase} />
    </div>
  );
}

function PhaseBar({ phase }: { phase?: LumiPhase }) {
  const idx = phase ? PHASES.findIndex((p) => p.id === phase) : -1;
  return (
    <div className="mt-3 flex items-center gap-1.5" aria-label="Ajattelun polku">
      {PHASES.map((p, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <div key={p.id} className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="h-1.5 overflow-hidden rounded-full bg-ink/[0.06]">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-sky-400 to-lilac-500"
                initial={false}
                animate={{ width: done ? "100%" : active ? "60%" : "0%" }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>
            <span
              className={`truncate text-[10px] font-bold uppercase tracking-wider transition-colors sm:text-[11px] ${
                active ? "text-lilac-600" : done ? "text-ink-soft" : "text-ink-mute/60"
              } ${active ? "" : "hidden sm:block"}`}
            >
              {p.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const bubbleMotion = {
  initial: { opacity: 0, y: 10, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { type: "spring" as const, stiffness: 260, damping: 24 },
};

function UserBubble({ text }: { text: string }) {
  return (
    <motion.div {...bubbleMotion} className="flex justify-end">
      <div className="max-w-[82%] whitespace-pre-wrap break-words rounded-[1.4rem] rounded-br-md bg-gradient-to-br from-sky-500 to-sky-600 px-4 py-2.5 text-[15px] font-medium leading-relaxed text-white shadow-soft">
        {text}
      </div>
    </motion.div>
  );
}

function LumiDot() {
  return (
    <span className="mb-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-sky-100 to-lilac-200 shadow-soft">
      <span className="h-2.5 w-2.5 rounded-full bg-white shadow-[0_0_8px_2px_rgba(167,139,250,0.9)]" />
    </span>
  );
}

function LumiBubble({
  msg,
  waiting,
  onRetry,
  canSpeak,
  speaking,
  onSpeak,
}: {
  msg: ChatMsg;
  waiting: boolean;
  onRetry: () => void;
  canSpeak: boolean;
  speaking: boolean;
  onSpeak: () => void;
}) {
  if (msg.status === "streaming" && !msg.text) {
    return waiting ? <TypingBubble /> : null;
  }
  if (msg.status === "error") {
    return (
      <motion.div {...bubbleMotion} className="flex items-end gap-2">
        <LumiDot />
        <div className="max-w-[82%] rounded-[1.4rem] rounded-bl-md bg-peach-100/70 px-4 py-2.5 text-[15px] leading-relaxed text-ink ring-1 ring-peach-400/30">
          {msg.text}
          <button onClick={onRetry} className="ml-2 inline-flex items-center gap-1 text-sm font-bold text-lilac-600 hover:underline">
            <RotateCcw className="h-3.5 w-3.5" /> Yritä uudelleen
          </button>
        </div>
      </motion.div>
    );
  }
  const success = msg.meta?.celebrate;
  return (
    <motion.div {...bubbleMotion} className="flex items-end gap-2">
      <LumiDot />
      <motion.div
        className={`relative max-w-[82%] whitespace-pre-wrap break-words rounded-[1.4rem] rounded-bl-md px-4 py-2.5 text-[15px] leading-relaxed shadow-soft transition-colors ${
          success
            ? "bg-gradient-to-br from-lilac-50 to-sky-50 font-semibold text-ink ring-1 ring-lilac-300"
            : speaking
              ? "bg-lilac-50/70 text-ink ring-1 ring-lilac-300"
              : "bg-white text-ink ring-1 ring-ink/[0.05]"
        }`}
        animate={
          speaking
            ? { boxShadow: ["0 0 0 0 rgba(167,139,250,0)", "0 0 0 6px rgba(167,139,250,0.16)", "0 0 0 0 rgba(167,139,250,0)"] }
            : success
              ? { boxShadow: ["0 0 0 0 rgba(167,139,250,0)", "0 0 0 8px rgba(167,139,250,0.18)", "0 0 0 0 rgba(167,139,250,0)"] }
              : { boxShadow: "0 0 0 0 rgba(167,139,250,0)" }
        }
        transition={speaking ? { duration: 1.4, repeat: Infinity } : { duration: 1.6 }}
      >
        {msg.text}
        {msg.status === "streaming" && <span className="ml-0.5 inline-block h-4 w-[3px] translate-y-0.5 animate-pulse rounded-full bg-lilac-400" />}
      </motion.div>
      {canSpeak && msg.status === "done" && (
        <button
          onClick={onSpeak}
          className={`mb-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full transition ${
            speaking ? "bg-lilac-500 text-white shadow-glow" : "bg-white text-ink-mute ring-1 ring-ink/[0.08] hover:text-lilac-600 hover:ring-lilac-300"
          }`}
          aria-label={speaking ? "Lopeta lukeminen" : "Lue ääneen"}
          title={speaking ? "Lopeta lukeminen" : "Lue ääneen"}
        >
          {speaking ? <SpeakingBars /> : <Volume2 className="h-4 w-4" />}
        </button>
      )}
    </motion.div>
  );
}

function TypingBubble() {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-end gap-2">
      <LumiDot />
      <div className="flex gap-1 rounded-[1.4rem] rounded-bl-md bg-white px-4 py-3.5 shadow-soft ring-1 ring-ink/[0.05]">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-2 w-2 rounded-full bg-lilac-300"
            animate={{ y: [0, -4, 0], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>
    </motion.div>
  );
}

function Composer({
  draft,
  setDraft,
  disabled,
  highlightSend,
  onSend,
  inputRef,
  placeholder,
  mic,
}: {
  draft: string;
  setDraft: (v: string) => void;
  disabled: boolean;
  highlightSend: boolean;
  onSend: (v: string) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  placeholder: string;
  mic: React.ReactNode;
}) {
  const canSend = !disabled && !!draft.trim();
  return (
    <div className="px-4 pb-4 pt-3 sm:px-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSend(draft);
        }}
        className="flex items-center gap-2"
      >
        <div
          className={`flex min-w-0 flex-1 items-center rounded-full border bg-white py-1.5 pl-5 pr-1.5 transition ${
            disabled ? "border-ink/10" : "border-lilac-300 shadow-[0_0_0_4px_rgba(196,179,255,0.25)]"
          }`}
        >
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={disabled}
            placeholder={placeholder}
            className="h-9 min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-mute/70 disabled:cursor-not-allowed"
            maxLength={1200}
            aria-label="Viestisi Lumille"
          />
          <motion.button
            type="submit"
            disabled={!canSend}
            animate={highlightSend && canSend ? { scale: [1, 1.12, 1] } : { scale: 1 }}
            transition={highlightSend ? { duration: 1.1, repeat: Infinity } : {}}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-sky-500 to-lilac-500 text-white transition disabled:opacity-30"
            aria-label="Lähetä"
          >
            <SendHorizontal className="h-4 w-4" />
          </motion.button>
        </div>
        {mic}
      </form>
    </div>
  );
}

/* ───────────────────────── Side panel ───────────────────────── */

function SidePanel({
  mood,
  burst,
  talking,
  speaking,
  meta,
  notes,
  noFinnishVoice,
  compact,
}: {
  mood: LumiMood;
  burst: number;
  talking: boolean;
  speaking: boolean;
  meta: LumiMeta | null;
  notes: string[];
  noFinnishVoice: boolean;
  compact?: boolean;
}) {
  return (
    <>
      {!compact && (
        <div className="flex flex-col items-center pt-2">
          <LumiCharacter size={124} mood={mood} burstKey={burst} talking={talking} speaking={speaking} />
        </div>
      )}

      <div className="rounded-3xl border border-ink/[0.06] bg-white/90 p-4 shadow-soft">
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="font-display text-sm font-extrabold">Sinun oivalluksesi</h3>
          <span className="text-[11px] font-medium text-ink-mute">Ideat ovat sinun</span>
        </div>
        {notes.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-ink/10 px-3 py-3 text-sm text-ink-mute">
            Kun kerrot oman arvauksen, idean tai yrityksen, se tallentuu tähän.
          </p>
        ) : (
          <ul className="space-y-2">
            <AnimatePresence initial={false}>
              {notes.map((n) => (
                <motion.li
                  key={n}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-start gap-2.5 rounded-2xl bg-lilac-50 px-3 py-2.5 text-sm font-semibold text-ink"
                >
                  <span className="mt-0.5 text-lilac-500">✦</span>
                  {n}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      {noFinnishVoice && (
        <p className="rounded-2xl bg-peach-100/70 px-3 py-2 text-[11px] leading-relaxed text-ink-soft">
          Laitteelta ei löytynyt suomenkielistä puheääntä, joten ääntäminen voi kuulostaa oudolta. Suomen äänen voi lisätä
          käyttöjärjestelmän kieliasetuksista.
        </p>
      )}

      <details className="group mt-auto rounded-2xl border border-ink/[0.06] bg-white/70 px-3 py-2 text-xs text-ink-mute">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 font-bold">
          <Lightbulb className="h-3.5 w-3.5 text-lilac-500" /> Aikuiselle: mitä Lumi tekee nyt
        </summary>
        <p className="mt-2 text-sm font-bold text-ink">{meta?.technique ?? "Ei vielä vastauksia."}</p>
        <p className="mt-2 leading-relaxed">Vastaukset luo kielimalli (Anthropic Claude) Lumin pedagogisen ohjauksen mukaisesti. Tekoäly voi erehtyä.</p>
      </details>
    </>
  );
}

/* ───────────────────────── Speech output ───────────────────────── */

function SpeechToggle({ supported, on, onChange }: { supported: boolean; on: boolean; onChange: (v: boolean) => void }) {
  if (!supported) return null;
  return (
    <button
      onClick={() => onChange(!on)}
      role="switch"
      aria-checked={on}
      title={on ? "Lumi lukee vastaukset ääneen" : "Lumi ei lue vastauksia automaattisesti"}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold transition ${
        on ? "bg-lilac-500 text-white shadow-glow" : "bg-white text-ink-soft ring-1 ring-ink/10 hover:ring-lilac-300"
      }`}
    >
      {on ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
      <span>Puhe {on ? "päällä" : "pois"}</span>
    </button>
  );
}

function SpeakingBars() {
  return (
    <span className="flex h-4 items-center gap-[2px]" aria-hidden>
      {[0, 0.15, 0.3].map((d) => (
        <motion.span
          key={d}
          className="w-[3px] rounded-full bg-white"
          animate={{ height: ["30%", "100%", "30%"] }}
          transition={{ duration: 0.7, repeat: Infinity, delay: d, ease: "easeInOut" }}
        />
      ))}
    </span>
  );
}
