"use client";

import { motion } from "framer-motion";
import { Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import LumiCharacter, { type LumiMood } from "../LumiCharacter";
import { speechLevel } from "./speechLevel";
import { requestMotionPermission } from "./tapWake";
import "./glow.css";

/**
 * Toy mode (?nfc=1): the phone sits inside a lunch-box shell and the child never looks at
 * the screen. Through the shell only light shows, so the whole screen glows in a colour and
 * rhythm that tells what Lumi is doing (colours and speeds: glow.css). Lumi and a short
 * status are on top for whoever holds the phone. Lumi is either awake or asleep: anything
 * that keeps her from listening or talking puts her to sleep, and a tap wakes her.
 */
export type GlowState = "idle" | "listening" | "thinking" | "speaking";

/** Full-screen light. While speaking, its brightness follows Lumi's voice frame by frame. */
export function Glow({ state, sleep = false, hearing = false }: { state: GlowState; sleep?: boolean; hearing?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (state !== "speaking" || !el) return;
    let raf = 0;
    let smooth = 0;
    const tick = () => {
      const v = speechLevel.read();
      // Rise fast with the voice, fall a little slower: a calm, living pulse.
      smooth = v > smooth ? smooth * 0.4 + v * 0.6 : smooth * 0.8 + v * 0.2;
      el.style.setProperty("--lumi-level", smooth.toFixed(3));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      el.style.setProperty("--lumi-level", "0");
    };
  }, [state]);

  return (
    <div ref={ref} className="lumi-glow" data-state={state} data-sleep={sleep} data-hearing={hearing} aria-hidden>
      <div className="lumi-glow__layer lumi-glow__idle" />
      <div className="lumi-glow__layer lumi-glow__listen" />
      <div className="lumi-glow__layer lumi-glow__think" />
      <div className="lumi-glow__layer lumi-glow__speak" />
    </div>
  );
}

export function ToyView({
  glow,
  hearing,
  mood,
  speaking,
  status,
  transcript,
  lastLine,
  onDiagnostics,
}: {
  glow: GlowState;
  hearing: boolean;
  mood: LumiMood;
  speaking: boolean;
  status: string;
  transcript: string;
  lastLine: string | null;
  onDiagnostics: () => void;
}) {
  return (
    // iPhone: a touch while Lumi is awake also allows waking her later by tapping the toy.
    <FullScreen onClick={() => void requestMotionPermission()} label="Lumi">
      <Glow state={glow} hearing={hearing} />
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDiagnostics();
        }}
        className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white/60 ring-1 ring-white/20"
        aria-label="Laitetiedot"
      >
        <Settings className="h-4 w-4" />
      </button>
      <div className="relative flex flex-1 flex-col items-center justify-center px-6 text-center">
        <LumiCharacter size={190} mood={mood} speaking={speaking} />
        <p className="mt-8 font-display text-2xl font-extrabold text-white" role="status" aria-live="polite">
          {status}
        </p>
        <div className="mt-3 min-h-[3.5rem] max-w-md text-base leading-relaxed text-white/70">
          {transcript ? <span className="font-semibold text-white">”{transcript}”</span> : lastLine}
        </div>
      </div>
    </FullScreen>
  );
}

/** Calm sleep view: no listening. A tap on the toy (motion sensor) or the screen wakes Lumi. */
export function SleepView({ onWake, note }: { onWake: () => void; note?: string | null }) {
  return (
    <FullScreen onClick={onWake} label="Herätä Lumi">
      <Glow state="idle" sleep />
      <div className="relative flex flex-1 cursor-pointer flex-col items-center justify-center px-6 text-center">
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
        {note && <p className="mt-2 max-w-xs text-xs text-white/40">Nukahti itsestään: {note}</p>}
      </div>
    </FullScreen>
  );
}

/**
 * ?nfc=1&glow=demo – tries every light on a computer, without microphone or speech:
 * cycles waiting → listening → child talking → thinking → speaking → sleeping.
 */
const DEMO_STEPS: { label: string; glow: GlowState; hearing?: boolean; sleep?: boolean }[] = [
  { label: "Odottaa", glow: "idle" },
  { label: "Kuuntelee", glow: "listening" },
  { label: "Kuulee lapsen puhetta", glow: "listening", hearing: true },
  { label: "Miettii", glow: "thinking" },
  { label: "Puhuu", glow: "speaking" },
  { label: "Nukkuu", glow: "idle", sleep: true },
];

export function GlowDemo() {
  const [i, setI] = useState(0);
  const step = DEMO_STEPS[i];

  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % DEMO_STEPS.length), 5000);
    return () => clearInterval(t);
  }, []);

  // "Speaking" in the demo: syllable-like beats, like the browser voice's word rhythm.
  useEffect(() => {
    if (step.glow !== "speaking") return;
    speechLevel.begin(null);
    const t = setInterval(() => Math.random() < 0.7 && speechLevel.beat(), 180);
    return () => {
      clearInterval(t);
      speechLevel.end();
    };
  }, [step.glow]);

  return (
    <FullScreen onClick={() => setI((n) => (n + 1) % DEMO_STEPS.length)} label="Seuraava tila">
      <Glow state={step.glow} hearing={step.hearing} sleep={step.sleep} />
      <div className="relative flex flex-1 flex-col items-center justify-end pb-16 text-center">
        <p className="font-display text-3xl font-extrabold text-white">{step.label}</p>
        <p className="mt-2 text-sm text-white/60">Valojen esittely – kosketus vaihtaa tilaa, muuten 5 s välein.</p>
      </div>
    </FullScreen>
  );
}

function FullScreen({ children, onClick, label }: { children: React.ReactNode; onClick?: () => void; label?: string }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#060a22]"
      onClick={onClick}
      role={onClick ? "button" : undefined}
      aria-label={label}
    >
      {children}
    </div>,
    document.body,
  );
}
