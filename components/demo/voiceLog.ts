"use client";

import { useSyncExternalStore } from "react";

/**
 * Debug log for the speech pipeline, visible in the browser console (on Android via
 * chrome://inspect, on iPhone via Safari's Web Inspector on a Mac) and – because a phone
 * is hard to inspect – also in the in-app "Laitetiedot" panel. Every line shows the
 * step and the time since the current turn began.
 *
 *   1. Voice detected  2. Transcript received  3. Transcript finalized
 *   4. Message send started  5. API request sent  6. API response received
 */
let turnStart = typeof performance !== "undefined" ? performance.now() : 0;

export function newTurn() {
  turnStart = performance.now();
}

export function vlog(step: string, ...data: unknown[]) {
  const t = Math.round(performance.now() - turnStart);
  console.info(`%c[Lumi puhe] +${t} ms ${step}`, "color:#7253D6;font-weight:bold", ...data);
  pushEvent(`+${t} ms ${step}${data.length ? " " + data.map(short).join(" ") : ""}`);
}

/* ── live device/audio state for the diagnostics panel ── */

export type DebugState = {
  /** Can the page play sound without a tap? Set by the iOS/Safari audio unlock. */
  audioUnlock: "pending" | "unlocked" | "blocked";
  /** AudioContext state probed during the unlock tap. */
  audioContext: string;
  /** navigator.audioSession.type on iOS 16.4+ (routes playback to the loudspeaker). */
  audioSession: string;
  /** Natural voice: configured on the server, and how the last request went. */
  ttsConfigured: boolean | null;
  ttsLast: string;
  /** Which voice actually spoke the last reply. */
  voiceUsed: string;
  /** Speech recognition: how listening resumes (automatically or by a tap). */
  recognitionMode: string;
  recognitionLast: string;
  lastError: string;
  events: string[];
};

let state: DebugState = {
  audioUnlock: "pending",
  audioContext: "ei testattu",
  audioSession: "–",
  ttsConfigured: null,
  ttsLast: "ei vielä käytetty",
  voiceUsed: "–",
  recognitionMode: "–",
  recognitionLast: "–",
  lastError: "ei virheitä",
  events: [],
};
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const clock = () => new Date().toTimeString().slice(0, 8);
function short(v: unknown) {
  try {
    const s = typeof v === "string" ? v : JSON.stringify(v);
    return s.length > 160 ? `${s.slice(0, 160)}…` : s;
  } catch {
    return String(v);
  }
}

function pushEvent(line: string) {
  state = { ...state, events: [...state.events.slice(-59), `${clock()} ${line}`] };
  emit();
}

export function debugSet(patch: Partial<Omit<DebugState, "events">>) {
  state = { ...state, ...patch };
  emit();
}

/** Remembers the latest problem (shown in the panel) and logs it. */
export function debugError(source: string, message: string) {
  console.warn(`[Lumi] ${source}: ${message}`);
  state = { ...state, lastError: `${clock()} ${source}: ${message}` };
  pushEvent(`⚠ ${source}: ${message}`);
}

export function debugEvent(line: string) {
  pushEvent(line);
}

export function useDebugState() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}
