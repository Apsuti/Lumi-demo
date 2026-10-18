"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Mic, MicOff, Pause, RotateCcw, SendHorizontal, Volume2, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { SessionState } from "./useVoiceSession";

type Voice = {
  state: SessionState;
  active: boolean;
  transcript: string;
  level: number;
  error: string | null;
  notice: string | null;
};

/** One press starts the spoken conversation; pressing again ends it. Calm colours, no alarm-red. */
export function MicButton({ voice, disabled, big, onStart, onEnd }: { voice: Voice; disabled: boolean; big?: boolean; onStart: () => void; onEnd: () => void }) {
  const on = voice.active;
  const size = big ? "h-20 w-20" : "h-11 w-11";
  return (
    <button
      type="button"
      onClick={on ? onEnd : onStart}
      disabled={disabled && !on}
      aria-pressed={on}
      aria-label={on ? "Lopeta puhekeskustelu" : "Aloita puhekeskustelu"}
      title={on ? "Lopeta puhekeskustelu" : "Puhu Lumille"}
      className={`relative grid ${size} shrink-0 place-items-center rounded-full transition disabled:opacity-30 ${
        on
          ? "bg-mint-400 text-white shadow-[0_0_0_4px_rgba(92,201,160,0.25)]"
          : big
            ? "bg-gradient-to-br from-sky-500 to-lilac-500 text-white shadow-lift hover:scale-105"
            : "bg-lilac-100 text-lilac-600 hover:bg-lilac-200"
      }`}
    >
      {on && voice.state !== "paused" && (
        <motion.span
          className="absolute inset-0 rounded-full ring-4 ring-mint-400/50"
          animate={{ scale: [1, 1.12, 1], opacity: [0.5, 0.15, 0.5] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      {on && voice.state === "paused" ? <Pause className={big ? "h-8 w-8" : "h-4 w-4"} /> : <Mic className={big ? "h-9 w-9" : "h-5 w-5"} />}
    </button>
  );
}

const PATIENT_LINES = ["Ajattele rauhassa.", "Olen täällä, kun haluat jatkaa.", "Voit vastata milloin tahansa."];

function usePatientLine(active: boolean) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setI((n) => (n + 1) % PATIENT_LINES.length), 6000);
    return () => clearInterval(t);
  }, [active]);
  return PATIENT_LINES[i];
}

type Props = {
  voice: Voice;
  lumi: "thinking" | "speaking" | null;
  onStopSpeaking: () => void;
  onSendNow: () => void;
  onEnd: () => void;
  onRestart: () => void;
  onDismiss: () => void;
};

/** Always tells the child, calmly, whether the mic is listening, paused, or off. */
export function VoicePanel({ voice, lumi, onStopSpeaking, onSendNow, onEnd, onRestart, onDismiss }: Props) {
  const waiting = voice.state === "listening" || voice.state === "starting";
  const line = usePatientLine(waiting);

  let content: React.ReactNode = null;
  let key = "none";

  if (voice.state === "error" && voice.error) {
    key = "error";
    content = (
      <div className="flex items-start gap-3 rounded-3xl border border-peach-400/40 bg-peach-100/80 p-4" role="alert">
        <MicOff className="mt-0.5 h-5 w-5 shrink-0 text-[#C0643A]" />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-ink">{voice.error}</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button onClick={onRestart} className="inline-flex items-center gap-1.5 rounded-full bg-lilac-500 px-4 py-2 text-sm font-bold text-white">
              <RotateCcw className="h-3.5 w-3.5" /> Aloita uudelleen
            </button>
            <button onClick={onDismiss} className="rounded-full bg-white px-4 py-2 text-sm font-bold text-ink-soft ring-1 ring-ink/10">
              Kirjoitan mieluummin
            </button>
          </div>
        </div>
      </div>
    );
  } else if (!voice.active && voice.notice) {
    key = "notice";
    content = (
      <div className="flex items-center gap-3 rounded-3xl border border-ink/[0.08] bg-white/90 px-4 py-3" role="status">
        <MicOff className="h-5 w-5 shrink-0 text-ink-mute" />
        <p className="flex-1 text-sm font-semibold text-ink-soft">{voice.notice}</p>
        <button onClick={onDismiss} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-ink-mute ring-1 ring-ink/10" aria-label="Sulje">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  } else if (voice.active && (voice.state === "paused" || lumi)) {
    key = "paused";
    content = (
      <div className="flex items-center gap-3 rounded-3xl border border-lilac-200 bg-lilac-50/80 px-4 py-3" role="status" aria-live="polite">
        {lumi === "speaking" ? (
          <Volume2 className="h-5 w-5 shrink-0 text-lilac-500" />
        ) : (
          <span className="flex shrink-0 gap-1">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="h-2 w-2 rounded-full bg-lilac-400"
                animate={{ opacity: [0.35, 1, 0.35] }}
                transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.25 }}
              />
            ))}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="font-display text-[15px] font-extrabold text-ink">{lumi === "speaking" ? "Lumi puhuu" : "Lumi miettii…"}</div>
          <div className="text-xs text-ink-mute">Kuuntelu on tauolla. Jatkan kuuntelemista, kun Lumi on valmis.</div>
        </div>
        {lumi === "speaking" && (
          <button onClick={onStopSpeaking} className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-lilac-600 ring-1 ring-lilac-200">
            Hiljennä
          </button>
        )}
      </div>
    );
  } else if (voice.active) {
    const hearing = voice.state === "hearing";
    key = "listening";
    content = (
      <div className="rounded-3xl border border-mint-400/40 bg-mint-100/50 p-4" role="status" aria-live="polite">
        <div className="flex items-center gap-2.5">
          <BreathingDot hearing={hearing} level={voice.level} />
          <span className="rounded-full bg-mint-400/90 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-white">
            {voice.state === "starting" ? "Mikki avautuu" : "Mikki päällä"}
          </span>
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={hearing ? "h" : line}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="mt-2 font-display text-lg font-extrabold text-ink"
          >
            {hearing ? "Kuulen sinut" : line}
          </motion.div>
        </AnimatePresence>

        {hearing && voice.transcript ? (
          <div className="mt-3 rounded-2xl bg-white px-4 py-3 text-lg font-semibold leading-snug text-ink">{voice.transcript}</div>
        ) : (
          <p className="mt-1 text-sm text-ink-soft">Kun alat puhua, kuulen sinut. Viesti lähtee Lumille, kun lopetat puhumisen.</p>
        )}

        <div className="mt-3 flex items-center gap-2">
          {hearing && voice.transcript && (
            <button onClick={onSendNow} className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold text-ink ring-1 ring-ink/10">
              <SendHorizontal className="h-3.5 w-3.5" /> Valmis
            </button>
          )}
          <button onClick={onEnd} className="ml-auto rounded-full px-3 py-2 text-xs font-bold text-ink-mute hover:text-ink">
            Lopeta puhekeskustelu
          </button>
        </div>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {content && (
        <motion.div key={key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} className="mx-4 mt-3 sm:mx-6">
          {content}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Slow "breathing" while waiting; follows the voice gently while the child talks. */
function BreathingDot({ hearing, level }: { hearing: boolean; level: number }) {
  const voiced = hearing ? Math.max(0.35, Math.min(1, level * 2)) : 0;
  return (
    <span className="relative grid h-5 w-5 shrink-0 place-items-center">
      <motion.span
        className="absolute inset-0 rounded-full bg-mint-400/40"
        animate={hearing ? { scale: 1 + voiced * 0.8 } : { scale: [1, 1.5, 1], opacity: [0.6, 0.2, 0.6] }}
        transition={hearing ? { duration: 0.15 } : { duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      />
      <span className="relative h-2.5 w-2.5 rounded-full bg-mint-600" />
    </span>
  );
}
