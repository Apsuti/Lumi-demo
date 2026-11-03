"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Settings } from "lucide-react";
import { createPortal } from "react-dom";
import LumiCharacter, { type LumiMood } from "../LumiCharacter";

/**
 * Toy mode (?nfc=1): the phone sits inside a plush toy and the child never looks at the
 * screen. The page is just Lumi, a short status for whoever holds the phone, and – only
 * when the browser insists on a touch – one big "Taputa minua" area.
 */
export function ToyView({
  mood,
  speaking,
  status,
  transcript,
  lastLine,
  onDiagnostics,
}: {
  mood: LumiMood;
  speaking: boolean;
  status: string;
  transcript: string;
  lastLine: string | null;
  onDiagnostics: () => void;
}) {
  return (
    <FullScreen className="bg-gradient-to-b from-sky-50 via-white to-lilac-50">
      <button
        onClick={onDiagnostics}
        className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/70 text-ink-mute ring-1 ring-ink/10"
        aria-label="Laitetiedot"
      >
        <Settings className="h-4 w-4" />
      </button>
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <LumiCharacter size={210} mood={mood} speaking={speaking} />
        <p className="mt-8 font-display text-2xl font-extrabold text-ink" role="status" aria-live="polite">
          {status}
        </p>
        <div className="mt-3 min-h-[3.5rem] max-w-md text-base leading-relaxed text-ink-soft">
          {transcript ? <span className="font-semibold text-ink">”{transcript}”</span> : lastLine}
        </div>
      </div>
    </FullScreen>
  );
}

/** Calm sleep view: no listening. A tap on the toy (motion sensor) or the screen wakes Lumi. */
export function SleepView({ onWake }: { onWake: () => void }) {
  return (
    <FullScreen className="cursor-pointer bg-gradient-to-b from-[#1E2148] to-[#2E2A5C]" onClick={onWake} label="Herätä Lumi">
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="relative opacity-70">
          <LumiCharacter size={170} mood="idle" />
          <motion.span
            className="absolute -right-2 top-0 font-display text-2xl font-extrabold text-lilac-200"
            animate={{ opacity: [0, 1, 0], y: [6, -10, -22] }}
            transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
          >
            z z
          </motion.span>
        </div>
        <p className="mt-8 font-display text-2xl font-extrabold text-white">Lumi nukkuu</p>
        <p className="mt-2 text-base text-white/70">Taputa minua kevyesti, niin herään.</p>
        <p className="mt-6 text-xs text-white/40">Mikrofoni on pois päältä.</p>
      </div>
    </FullScreen>
  );
}

/** Shown when the browser needs a touch before it lets Lumi listen or talk. The whole screen is the button. */
export function TapOverlay({ reason, onTap }: { reason: string | null; onTap: () => void }) {
  return (
    <AnimatePresence>
      {reason !== null && (
        <motion.button
          key="tap"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onTap}
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-gradient-to-br from-sky-500 to-lilac-500 px-6 text-center text-white"
          aria-label="Taputa minua"
        >
          <motion.span
            className="font-display text-5xl font-black"
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          >
            Taputa minua
          </motion.span>
          <span className="mt-4 text-lg font-semibold text-white/85">Kosketa mitä tahansa kohtaa näytöllä.</span>
          {reason && <span className="mt-8 max-w-sm text-xs text-white/60">{reason}</span>}
        </motion.button>
      )}
    </AnimatePresence>
  );
}

function FullScreen({ children, className, onClick, label }: { children: React.ReactNode; className: string; onClick?: () => void; label?: string }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex flex-col ${className}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      aria-label={label}
    >
      {children}
    </div>,
    document.body,
  );
}
