"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_TTS_CHARS, cleanForSpeech } from "@/lib/lumi/voice";

const LANG = "fi-FI";
const AUTO_KEY = "lumi.autoSpeak";

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

export type SpeechStream = {
  /** Feed more of the reply as it streams in. */
  push: (text: string) => void;
  /** No more text is coming; `onDone` fires after the last sentence has been spoken. */
  end: () => void;
  /** Stop speaking this reply. */
  cancel: () => void;
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
  const [speakingId, setSpeakingId] = useState<number | null>(null);
  const [autoSpeak, setAutoSpeakState] = useState(false);
  const runRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const unlockedRef = useRef(false);

  useEffect(() => {
    const hasBrowser = typeof window !== "undefined" && "speechSynthesis" in window;
    if (hasBrowser) setEngine("browser");
    try {
      setAutoSpeakState(localStorage.getItem(AUTO_KEY) === "1");
    } catch {
      /* storage unavailable – default off */
    }

    // Natural voice (ElevenLabs, always the same voice) when the server has a key.
    fetch("/api/tts?status=1")
      .then((r) => r.json())
      .then((d: { configured?: boolean }) => {
        if (!d.configured) return;
        audioRef.current ??= new Audio();
        setEngine("elevenlabs");
      })
      .catch(() => {});

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

  const abortRef = useRef<AbortController | null>(null);
  const urlsRef = useRef<string[]>([]);

  const stop = useCallback(() => {
    runRef.current++;
    abortRef.current?.abort();
    abortRef.current = null;
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    urlsRef.current = [];
    const a = audioRef.current;
    if (a) {
      a.onended = a.onerror = null;
      a.pause();
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeakingId(null);
  }, []);

  /** Browser voice for one piece of text: used without ElevenLabs, or when a request fails. */
  const speakWithBrowser = useCallback(
    (text: string, run: number) =>
      new Promise<void>((resolve) => {
        if (!("speechSynthesis" in window)) return resolve();
        const synth = window.speechSynthesis;
        const parts = splitSentences(text);
        if (!parts.length) return resolve();
        let finished = false;
        let watchdog: ReturnType<typeof setInterval> | undefined;
        const finish = () => {
          if (finished) return;
          finished = true;
          clearInterval(watchdog);
          resolve();
        };
        // Some browsers occasionally drop the final `end` event; notice silence instead.
        setTimeout(() => {
          if (finished) return;
          watchdog = setInterval(() => {
            if (run !== runRef.current) return finish();
            if (!synth.speaking && !synth.pending) finish();
          }, 600);
        }, 1200);
        parts.forEach((part, i) => {
          const u = new SpeechSynthesisUtterance(part);
          u.lang = LANG;
          if (browserVoice) u.voice = browserVoice;
          u.rate = 1.12; // natural conversational pace, matching the ElevenLabs voice
          u.pitch = 1.1;
          if (i === parts.length - 1) u.onend = u.onerror = finish;
          synth.speak(u);
        });
      }),
    [browserVoice],
  );

  /** Plays one audio source on the (iOS-unlocked) audio element; resolves false if it can't play. */
  const playAudio = useCallback(
    (src: string, run: number) =>
      new Promise<boolean>((resolve) => {
        const audio = audioRef.current;
        if (!audio || run !== runRef.current) return resolve(true);
        let settled = false;
        const settle = (ok: boolean) => {
          if (settled) return;
          settled = true;
          audio.onended = audio.onerror = null;
          resolve(ok);
        };
        audio.onended = () => settle(true);
        audio.onerror = () => settle(false);
        audio.src = src;
        audio.play().catch((e: DOMException) => {
          // Autoplay blocked (no tap yet on iOS) or audio failed.
          if (e?.name !== "AbortError") settle(false);
        });
      }),
    [],
  );

  /**
   * Starts speaking a reply *while it is still being written*. Text is pushed in as it
   * streams from Claude. The first sentence goes to ElevenLabs straight away and streams
   * directly into the player (fastest start). The rest of the reply is sent as ONE request
   * (with the first sentence as context) and buffered: every separate request is spoken as
   * a complete utterance that slows down and falls at its end, so fewer seams keep the
   * tempo even from start to finish. It is sent when the reply ends – or earlier if the
   * player would otherwise have to wait, or the rest grows long.
   * `onDone` fires once everything has been spoken – never when stopped.
   */
  const beginStream = useCallback(
    (id: number, onDone?: () => void): SpeechStream => {
      stop();
      const run = runRef.current;
      const live = () => run === runRef.current;
      const t0 = performance.now();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const useEleven = engine === "elevenlabs" && !!audioRef.current;

      type Chunk = { text: string; audio?: Promise<string | null> };
      const queue: Chunk[] = [];
      let pending = "";
      let batch = ""; // finished sentences after the first, spoken together as one request
      let prev = "";
      let chunkCount = 0;
      let ended = false;
      let playing = false;
      let started = false;
      let finished = false;

      const ttsUrl = (text: string, previous: string) => {
        const q = new URLSearchParams({ text });
        if (previous) q.set("prev", previous.slice(-300));
        return `/api/tts?${q}`;
      };

      // Buffer a later sentence in the background so it can play the moment the previous ends.
      const prefetch = (url: string) =>
        fetch(url, { signal: ctrl.signal })
          .then((r) => (r.ok ? r.blob() : null))
          .then((b) => {
            if (!b || !live()) return null;
            const u = URL.createObjectURL(b);
            urlsRef.current.push(u);
            return u;
          })
          .catch(() => null);

      const finish = () => {
        if (finished || !live()) return;
        finished = true;
        setSpeakingId(null);
        onDone?.();
      };

      const pump = async () => {
        if (playing || !live()) return;
        // About to go quiet while the reply is still being written: speak what is ready.
        if (!queue.length && batch.trim()) flushBatch();
        const chunk = queue.shift();
        if (!chunk) {
          if (ended) finish();
          return;
        }
        playing = true;
        if (!started) {
          started = true;
          setSpeakingId(id);
          console.info(`[Lumi viive] puhe alkaa ${Math.round(performance.now() - t0)} ms vastauksen alusta`);
        }
        let ok = false;
        if (useEleven) {
          const src = chunk.audio ? await chunk.audio : ttsUrl(chunk.text, "");
          if (src && live()) ok = await playAudio(src, run);
        }
        if (!ok && live()) await speakWithBrowser(chunk.text, run);
        playing = false;
        if (live()) pump();
      };

      const enqueue = (raw: string) => {
        const text = cleanForSpeech(raw).slice(0, MAX_TTS_CHARS);
        if (!text) return;
        const chunk: Chunk = { text };
        // The first sentence streams directly (no wait for the whole file); later ones are buffered.
        if (useEleven) chunk.audio = chunkCount === 0 ? Promise.resolve(ttsUrl(text, "")) : prefetch(ttsUrl(text, prev));
        prev = prev ? `${prev} ${text}` : text;
        chunkCount++;
        queue.push(chunk);
        pump();
      };

      const flushBatch = () => {
        const text = batch;
        batch = "";
        enqueue(text);
      };

      const take = () => {
        for (;;) {
          // A sentence ends at . ! ? … followed by whitespace (so "3.5" is not split).
          const m = /[.!?…]+["»”)]*\s/.exec(pending);
          if (m) {
            const end = m.index + m[0].length;
            const sentence = pending.slice(0, end);
            pending = pending.slice(end);
            if (chunkCount === 0) enqueue(sentence);
            else {
              batch += sentence;
              if (batch.length > 300) flushBatch(); // very long reply: don't wait for the end
            }
            continue;
          }
          // Start sooner only if the very first sentence is really long: cut at a comma.
          // (A cut mid-sentence is spoken as an ending, so it is kept rare.)
          if (chunkCount === 0 && pending.length > 160) {
            const comma = pending.lastIndexOf(", ", 200);
            if (comma > 40) {
              enqueue(pending.slice(0, comma + 1));
              pending = pending.slice(comma + 2);
              continue;
            }
          }
          break;
        }
      };

      return {
        push(text: string) {
          if (!live() || ended) return;
          pending += text;
          take();
        },
        end() {
          if (!live() || ended) return;
          ended = true;
          batch += pending;
          pending = "";
          if (batch.trim()) flushBatch();
          if (!playing && !queue.length) finish();
        },
        cancel() {
          if (live()) stop();
        },
      };
    },
    [engine, playAudio, speakWithBrowser, stop],
  );

  /** Reads a finished text aloud (replay button, short messages). Same pipeline, fed at once. */
  const speak = useCallback(
    (id: number, text: string, onDone?: () => void) => {
      if (engine === "none") return onDone?.();
      const stream = beginStream(id, onDone);
      stream.push(text);
      stream.end();
    },
    [beginStream, engine],
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


  return {
    supported: engine !== "none",
    engine,
    /** False when only the browser voice is available and it has no Finnish voice. */
    hasFinnishVoice: engine === "elevenlabs" || !browserVoicesLoaded || browserVoice !== null,
    speakingId,
    speak,
    beginStream,
    stop,
    autoSpeak,
    setAutoSpeak,
  };
}
