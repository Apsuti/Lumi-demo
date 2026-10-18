"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Mic, MicOff, RotateCcw, Square, X } from "lucide-react";
import type { VoiceState } from "./useVoiceInput";

type Voice = {
  state: VoiceState;
  active: boolean;
  transcript: string;
  level: number;
  error: string | null;
};

/** Round mic button: violet when off, red with ripples while the mic is really on. */
export function MicButton({ voice, disabled, onStart, onStop }: { voice: Voice; disabled: boolean; onStart: () => void; onStop: () => void }) {
  const on = voice.active;
  return (
    <button
      type="button"
      onClick={on ? onStop : onStart}
      disabled={disabled && !on}
      aria-pressed={on}
      aria-label={on ? "Lopeta kuuntelu" : "Puhu Lumille"}
      title={on ? "Lopeta kuuntelu" : "Puhu Lumille"}
      className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-full transition disabled:opacity-30 ${
        on ? "bg-rose-500 text-white shadow-[0_0_0_4px_rgba(244,63,94,0.2)]" : "bg-lilac-100 text-lilac-600 hover:bg-lilac-200"
      }`}
    >
      {on && (
        <>
          <motion.span
            className="absolute inset-0 rounded-full border-2 border-rose-400"
            animate={{ scale: [1, 1.6], opacity: [0.7, 0] }}
            transition={{ duration: 1.3, repeat: Infinity, ease: "easeOut" }}
          />
          <motion.span
            className="absolute inset-0 rounded-full border-2 border-rose-400"
            animate={{ scale: [1, 1.6], opacity: [0.7, 0] }}
            transition={{ duration: 1.3, repeat: Infinity, ease: "easeOut", delay: 0.65 }}
          />
        </>
      )}
      {on ? <Square className="relative h-4 w-4 fill-current" /> : <Mic className="h-5 w-5" />}
    </button>
  );
}

const STATUS: Record<VoiceState, string> = {
  idle: "",
  starting: "Avataan mikkiä…",
  listening: "Puhu nyt!",
  hearing: "Kuulen sinut!",
  error: "",
};

/** Big, unmistakable panel shown while the mic is on, or when something went wrong. */
export function VoicePanel({ voice, onStop, onCancel, onRetry, onDismiss }: { voice: Voice; onStop: () => void; onCancel: () => void; onRetry: () => void; onDismiss: () => void }) {
  return (
    <AnimatePresence mode="wait">
      {voice.active && (
        <motion.div
          key="listening"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          className="mx-4 mt-3 rounded-3xl border-2 border-rose-300 bg-rose-50/80 p-4 sm:mx-6"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-3">
            <span className="relative flex h-3.5 w-3.5 shrink-0">
              {voice.state !== "starting" && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />}
              <span className={`relative inline-flex h-3.5 w-3.5 rounded-full ${voice.state === "starting" ? "bg-ink-mute/50" : "bg-rose-500"}`} />
            </span>
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider ${voice.state === "starting" ? "bg-ink/5 text-ink-mute" : "bg-rose-500 text-white"}`}>
              {voice.state === "starting" ? "Mikki avautuu" : "Mikki päällä"}
            </span>
            <span className="min-w-0 flex-1 truncate font-display text-base font-extrabold text-ink">{STATUS[voice.state]}</span>
            <LevelBars state={voice.state} level={voice.level} />
          </div>

          <div className={`mt-3 min-h-[3.25rem] rounded-2xl bg-white px-4 py-3 text-lg leading-snug ${voice.transcript ? "font-semibold text-ink" : "text-ink-mute/70"}`}>
            {voice.transcript || (voice.state === "starting" ? "Hetki vain…" : "Sanasi ilmestyvät tähän, kun puhut.")}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={onStop}
              disabled={voice.state === "starting"}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-rose-500 px-5 py-3 text-[15px] font-bold text-white transition hover:bg-rose-600 disabled:opacity-40"
            >
              <Check className="h-4 w-4" strokeWidth={3} /> Valmis
            </button>
            <button onClick={onCancel} className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-3 text-sm font-bold text-ink-soft ring-1 ring-ink/10">
              <X className="h-4 w-4" /> Peruuta
            </button>
          </div>
          <p className="mt-2 text-center text-xs text-ink-mute">Mikki sammuu itsestään, kun lopetat puhumisen.</p>
        </motion.div>
      )}

      {voice.state === "error" && voice.error && (
        <motion.div
          key="error"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="mx-4 mt-3 flex items-start gap-3 rounded-3xl border border-peach-400/40 bg-peach-100/80 p-4 sm:mx-6"
          role="alert"
        >
          <MicOff className="mt-0.5 h-5 w-5 shrink-0 text-[#C0643A]" />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-ink">{voice.error}</p>
            <div className="mt-2.5 flex gap-2">
              <button onClick={onRetry} className="inline-flex items-center gap-1.5 rounded-full bg-lilac-500 px-4 py-2 text-sm font-bold text-white">
                <RotateCcw className="h-3.5 w-3.5" /> Kokeile uudelleen
              </button>
              <button onClick={onDismiss} className="rounded-full bg-white px-4 py-2 text-sm font-bold text-ink-soft ring-1 ring-ink/10">
                Kirjoitan mieluummin
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Real mic level when available; otherwise reacts to the recogniser's "sound detected" events. */
function LevelBars({ state, level }: { state: VoiceState; level: number }) {
  const heights = [0.45, 0.75, 1, 0.75, 0.45];
  const hasMeter = level > 0.06;
  return (
    <span className="flex h-6 shrink-0 items-center gap-[3px]" aria-hidden>
      {heights.map((h, i) =>
        hasMeter ? (
          <span
            key={i}
            className="w-1 rounded-full bg-rose-500 transition-[height] duration-75"
            style={{ height: `${Math.max(15, Math.min(100, level * h * 140))}%` }}
          />
        ) : (
          <motion.span
            key={i}
            className={`w-1 rounded-full ${state === "hearing" ? "bg-rose-500" : "bg-rose-300"}`}
            animate={state === "hearing" ? { height: ["25%", `${h * 100}%`, "25%"] } : { height: "15%" }}
            transition={state === "hearing" ? { duration: 0.6, repeat: Infinity, delay: i * 0.1 } : { duration: 0.2 }}
          />
        ),
      )}
    </span>
  );
}

/** Shown after speech is captured: the text is in the input, waiting for the child to check and send. */
export function HeardHint({ onRedo }: { onRedo: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="mx-4 mt-3 flex items-center gap-2 rounded-2xl bg-mint-100 px-4 py-2.5 text-sm font-semibold text-mint-600 sm:mx-6"
    >
      <Check className="h-4 w-4 shrink-0" strokeWidth={3} />
      <span className="flex-1">Kuulin sinut! Tarkista teksti ja paina lähetä.</span>
      <button onClick={onRedo} className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-bold text-ink-soft ring-1 ring-ink/10">
        Puhu uudelleen
      </button>
    </motion.div>
  );
}
