"use client";

import { useSyncExternalStore } from "react";
import { appleWebKit } from "../demo/micDiagnostics";

/**
 * Lumi's voice as light: whether she is speaking right now and how loud, for the glow.
 *
 * `speaking` turns on with the first sound of a reply (the audio element's "playing" event
 * or speechSynthesis "start") and off when the last sentence has ended – exactly with the
 * sound. Between sentences it stays on with zero loudness.
 *
 * Loudness comes from, in order of preference:
 *  1. an AnalyserNode on the audio element (desktop, Android – only once its AudioContext
 *     is running, so the voice is never routed through a stopped context and silenced),
 *  2. a loudness curve computed from the downloaded audio file and followed by playback time
 *     (iPhone: routing the element through Web Audio there risks silence and the mute switch),
 *  3. a beat on each spoken word (browser voice: speechSynthesis gives no loudness).
 */
type Source = () => number;

let speaking = false;
let source: Source | null = null;
let pulsing = false;
let pulse = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const speechLevel = {
  /** Sound started (again): `src` gives its loudness, or null for word-synchronised beats. */
  begin(src: Source | null) {
    source = src;
    pulsing = !src;
    pulse = 1;
    if (!speaking) {
      speaking = true;
      emit();
    }
  },
  /** Silent moment between sentences: still Lumi's turn, no light pulse. */
  pause() {
    source = null;
    pulsing = false;
  },
  /** The reply has been spoken (or was stopped). */
  end() {
    source = null;
    pulsing = false;
    pulse = 0;
    if (speaking) {
      speaking = false;
      emit();
    }
  },
  /** A word boundary of the browser voice. */
  beat() {
    pulse = 1;
  },
  /** Loudness 0–1 right now; call once per animation frame. */
  read(): number {
    if (source) return Math.max(0, Math.min(1, source()));
    if (!pulsing) return 0;
    pulse *= 0.92;
    return 0.25 + 0.55 * pulse + Math.random() * 0.12;
  },
  isSpeaking: () => speaking,
};

/** True while Lumi is audibly taking her turn. */
export function useSpeaking() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => speaking,
    () => false,
  );
}

/* ── 1. AnalyserNode (not on Apple's engine) ── */

type AC = typeof AudioContext;
const AudioCtx = (): AC | undefined =>
  typeof window === "undefined" ? undefined : window.AudioContext ?? (window as unknown as { webkitAudioContext?: AC }).webkitAudioContext;

let ctx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
const routed = new WeakSet<HTMLMediaElement>();

/** Call inside a tap: lets the AudioContext run, so the analyser can be used. */
export function primeAudioGraph() {
  if (appleWebKit()) return;
  try {
    const C = AudioCtx();
    if (!C) return;
    ctx ??= new C();
    void ctx.resume().catch(() => {});
  } catch {
    /* no Web Audio */
  }
}

function analyserSource(audio: HTMLMediaElement): Source | null {
  if (appleWebKit()) return null;
  try {
    const C = AudioCtx();
    if (!C) return null;
    ctx ??= new C();
    if (ctx.state !== "running") {
      void ctx.resume().catch(() => {});
      if (!routed.has(audio)) return null; // never route the voice through a context that is not running
    }
    if (!routed.has(audio)) {
      const src = ctx.createMediaElementSource(audio);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      src.connect(analyser);
      analyser.connect(ctx.destination);
      routed.add(audio);
    }
  } catch {
    return null;
  }
  const a = analyser!;
  const data = new Uint8Array(a.fftSize);
  return () => {
    a.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sum += v * v;
    }
    return Math.sqrt(sum / data.length) * 4.5;
  };
}

/* ── 2. Loudness curve from the audio file ── */

const STEP_S = 0.03; // one value per 30 ms
const envelopes = new Map<string, Float32Array>();

/** Computes the loudness curve of a downloaded sentence (in the background). */
export async function analyseBlob(url: string, blob: Blob) {
  try {
    const W = window as unknown as { OfflineAudioContext?: typeof OfflineAudioContext; webkitOfflineAudioContext?: typeof OfflineAudioContext };
    const Offline = W.OfflineAudioContext ?? W.webkitOfflineAudioContext;
    if (!Offline) return;
    const decoded = await new Offline(1, 1, 44100).decodeAudioData(await blob.arrayBuffer());
    const ch = decoded.getChannelData(0);
    const step = Math.max(1, Math.floor(decoded.sampleRate * STEP_S));
    const env = new Float32Array(Math.ceil(ch.length / step));
    let peak = 0;
    for (let i = 0; i < env.length; i++) {
      let sum = 0;
      const end = Math.min(ch.length, (i + 1) * step);
      for (let j = i * step; j < end; j++) sum += ch[j] * ch[j];
      env[i] = Math.sqrt(sum / step);
      peak = Math.max(peak, env[i]);
    }
    if (peak > 0) for (let i = 0; i < env.length; i++) env[i] = Math.min(1, env[i] / (peak * 0.85));
    envelopes.set(url, env);
  } catch {
    /* undecodable: the glow falls back to beats */
  }
}

export function forgetEnvelope(url: string) {
  envelopes.delete(url);
}

function envelopeSource(audio: HTMLMediaElement): Source | null {
  const env = envelopes.get(audio.src);
  if (!env) return null;
  return () => (audio.paused ? 0 : env[Math.floor(audio.currentTime / STEP_S)] ?? 0);
}

/** Loudness of what the audio element is playing now, by the best method available. */
export function audioSource(audio: HTMLMediaElement): Source | null {
  return analyserSource(audio) ?? envelopeSource(audio);
}
