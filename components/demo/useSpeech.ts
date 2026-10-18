"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_TTS_CHARS, cleanForSpeech, type VoiceOption } from "@/lib/lumi/voice";

const LANG = "fi-FI";
const AUTO_KEY = "lumi.autoSpeak";
const VOICE_KEY = "lumi.voiceId";

/**
 * A short silent WAV. Playing it inside a tap "unlocks" the audio element on iOS,
 * so Lumi's later replies (which arrive without a tap) are allowed to play.
 */
function silentWav() {
  const samples = 800; // 0.1 s at 8 kHz, 8-bit mono
  const buf = new DataView(new ArrayBuffer(44 + samples));
  const str = (o: number, s: string) => [...s].forEach((c, i) => buf.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  buf.setUint32(4, 36 + samples, true);
  str(8, "WAVEfmt ");
  buf.setUint32(16, 16, true);
  buf.setUint16(20, 1, true); // PCM
  buf.setUint16(22, 1, true); // mono
  buf.setUint32(24, 8000, true);
  buf.setUint32(28, 8000, true);
  buf.setUint16(32, 1, true);
  buf.setUint16(34, 8, true);
  str(36, "data");
  buf.setUint32(40, samples, true);
  for (let i = 0; i < samples; i++) buf.setUint8(44 + i, 128);
  let bin = "";
  new Uint8Array(buf.buffer).forEach((b) => (bin += String.fromCharCode(b)));
  return `data:audio/wav;base64,${btoa(bin)}`;
}

type Engine = "elevenlabs" | "browser" | "none";

export type VoicesResponse = {
  configured?: boolean;
  reason?: string;
  source?: string;
  defaultVoiceId?: string;
  voices?: VoiceOption[];
  debug?: {
    source: string;
    pages?: number;
    count: number;
    error?: { status: number | null; body: unknown };
    voices: { name: string; voice_id: string; category: string | null; labels: Record<string, string> }[];
  };
};

/** Chrome's built-in voice cuts off long utterances, so the fallback speaks sentence by sentence. */
function splitSentences(text: string) {
  return text.match(/[^.!?…]+[.!?…]*/g)?.map((s) => s.trim()).filter(Boolean) ?? [text];
}

function pickBrowserVoice(voices: SpeechSynthesisVoice[]) {
  const fi = voices.filter((v) => v.lang.replace("_", "-").toLowerCase().startsWith("fi"));
  return fi.find((v) => /satu|google|natural|online/i.test(v.name)) ?? fi[0] ?? null;
}

/**
 * Lumi's voice. Uses ElevenLabs (natural human voice, streamed from /api/tts) when
 * the server has a key; otherwise – or if a request fails – the browser's own voice.
 */
export function useSpeech() {
  const [engine, setEngine] = useState<Engine>("none");
  const [browserVoice, setBrowserVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [browserVoicesLoaded, setBrowserVoicesLoaded] = useState(false);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [voiceId, setVoiceIdState] = useState<string | null>(null);
  /** Why the natural voice is (not) in use – shown in settings. */
  const [ttsStatus, setTtsStatus] = useState<string>("checking");
  const [speakingId, setSpeakingId] = useState<number | null>(null);
  const [autoSpeak, setAutoSpeakState] = useState(false);
  const runRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const unlockedRef = useRef(false);
  const voiceIdRef = useRef<string | null>(null);
  voiceIdRef.current = voiceId;
  const [voiceSource, setVoiceSource] = useState<string | null>(null);

  /**
   * Fetches the account's voices. `debug` bypasses the server cache and also returns
   * exactly what ElevenLabs sent (for the temporary debug view in settings).
   */
  const loadVoices = useCallback(async (debug = false): Promise<VoicesResponse | null> => {
    try {
      const d = (await (await fetch(`/api/tts?voices=1${debug ? "&debug=1" : ""}`)).json()) as VoicesResponse;
      setTtsStatus(d.reason ?? (d.configured ? "ok" : "missing_key"));
      if (!d.configured) return d;
      audioRef.current ??= new Audio();
      setEngine("elevenlabs");
      setVoices(d.voices ?? []);
      setVoiceSource(d.source ?? null);
      let saved: string | null = null;
      try {
        saved = localStorage.getItem(VOICE_KEY);
      } catch {
        /* ignore */
      }
      const known = (d.voices ?? []).some((v) => v.id === saved);
      setVoiceIdState(known ? saved : (d.defaultVoiceId ?? null));
      return d;
    } catch {
      setTtsStatus("server_error");
      return null;
    }
  }, []);
  const loadVoicesRef = useRef(loadVoices);

  useEffect(() => {
    const hasBrowser = typeof window !== "undefined" && "speechSynthesis" in window;
    if (hasBrowser) setEngine("browser");
    try {
      setAutoSpeakState(localStorage.getItem(AUTO_KEY) === "1");
    } catch {
      /* storage unavailable – default off */
    }

    // Natural voice from the server, if configured.
    loadVoicesRef.current();

    // Unlock audio playback on the first tap (needed on iOS/Safari).
    const unlock = () => {
      const a = audioRef.current;
      if (!a || unlockedRef.current) return;
      unlockedRef.current = true;
      a.src = silentWav();
      a.play().catch(() => (unlockedRef.current = false));
    };
    window.addEventListener("pointerdown", unlock, true);

    if (!hasBrowser) return () => window.removeEventListener("pointerdown", unlock, true);
    const load = () => {
      const list = window.speechSynthesis.getVoices();
      if (list.length) {
        setBrowserVoice(pickBrowserVoice(list));
        setBrowserVoicesLoaded(true);
      }
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => {
      window.removeEventListener("pointerdown", unlock, true);
      window.speechSynthesis.removeEventListener("voiceschanged", load);
      window.speechSynthesis.cancel();
      audioRef.current?.pause();
    };
  }, []);

  const stop = useCallback(() => {
    runRef.current++;
    const a = audioRef.current;
    if (a) {
      a.onended = a.onerror = null;
      a.pause();
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeakingId(null);
  }, []);

  /** Browser voice: used when ElevenLabs is not configured or a request fails. */
  const speakWithBrowser = useCallback(
    (text: string, run: number, done: () => void) => {
      if (!("speechSynthesis" in window)) return done();
      const synth = window.speechSynthesis;
      synth.cancel();
      const parts = splitSentences(text);
      if (!parts.length) return done();
      let finished = false;
      let watchdog: ReturnType<typeof setInterval> | undefined;
      const finish = () => {
        if (finished) return;
        finished = true;
        clearInterval(watchdog);
        done();
      };
      // Some browsers occasionally drop the final `end` event; notice silence instead.
      setTimeout(() => {
        if (finished) return;
        watchdog = setInterval(() => {
          if (run !== runRef.current) return clearInterval(watchdog);
          if (!synth.speaking && !synth.pending) finish();
        }, 600);
      }, 1200);
      parts.forEach((part, i) => {
        const u = new SpeechSynthesisUtterance(part);
        u.lang = LANG;
        if (browserVoice) u.voice = browserVoice;
        u.rate = 0.95;
        u.pitch = 1.1;
        if (i === parts.length - 1) u.onend = u.onerror = finish;
        synth.speak(u);
      });
    },
    [browserVoice],
  );

  /**
   * Reads text aloud. `onDone` fires when it finishes on its own (or could not play) –
   * never when stopped, so a stopped reply does not hand the turn back twice.
   */
  const speak = useCallback(
    (id: number, raw: string, onDone?: () => void, voiceOverride?: string) => {
      const text = cleanForSpeech(raw).slice(0, MAX_TTS_CHARS);
      stop();
      const run = runRef.current;
      if (!text || engine === "none") {
        onDone?.();
        return;
      }
      setSpeakingId(id);
      const done = () => {
        if (run !== runRef.current) return;
        setSpeakingId(null);
        onDone?.();
      };

      const audio = audioRef.current;
      if (engine === "elevenlabs" && audio) {
        let fellBack = false;
        const fallback = () => {
          if (fellBack || run !== runRef.current) return;
          fellBack = true;
          audio.onended = audio.onerror = null;
          speakWithBrowser(text, run, done);
        };
        const params = new URLSearchParams({ text });
        const v = voiceOverride ?? voiceIdRef.current;
        if (v) params.set("voice", v);
        audio.onended = done;
        audio.onerror = fallback;
        audio.src = `/api/tts?${params}`;
        audio.play().catch((e: DOMException) => {
          // Autoplay blocked (no tap yet on iOS) or audio failed: use the browser voice.
          if (e?.name !== "AbortError") fallback();
        });
        return;
      }
      speakWithBrowser(text, run, done);
    },
    [engine, speakWithBrowser, stop],
  );

  const setAutoSpeak = useCallback(
    (on: boolean) => {
      setAutoSpeakState(on);
      try {
        localStorage.setItem(AUTO_KEY, on ? "1" : "0");
      } catch {
        /* ignore */
      }
      if (!on) stop();
    },
    [stop],
  );

  const setVoiceId = useCallback((id: string) => {
    setVoiceIdState(id);
    try {
      localStorage.setItem(VOICE_KEY, id);
    } catch {
      /* ignore */
    }
  }, []);

  return {
    supported: engine !== "none",
    engine,
    ttsStatus,
    voiceSource,
    loadVoices,
    /** False when only the browser voice is available and it has no Finnish voice. */
    hasFinnishVoice: engine === "elevenlabs" || !browserVoicesLoaded || browserVoice !== null,
    voices,
    voiceId,
    setVoiceId,
    speakingId,
    speak,
    stop,
    autoSpeak,
    setAutoSpeak,
  };
}
