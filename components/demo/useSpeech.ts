"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const LANG = "fi-FI";
const STORAGE_KEY = "lumi.autoSpeak";

/** Emojis and symbols are read aloud as their names ("party popper"), so drop them. */
function cleanForSpeech(text: string) {
  return text
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "")
    .replace(/[«»”"]/g, "")
    .replace(/×/g, " kertaa ")
    .replace(/÷/g, " jaettuna ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Chrome cuts off long utterances, so speak sentence by sentence. */
function splitSentences(text: string) {
  return text.match(/[^.!?…]+[.!?…]*/g)?.map((s) => s.trim()).filter(Boolean) ?? [text];
}

function pickVoice(voices: SpeechSynthesisVoice[]) {
  const fi = voices.filter((v) => v.lang.replace("_", "-").toLowerCase().startsWith("fi"));
  return fi.find((v) => /satu|google|natural|online/i.test(v.name)) ?? fi[0] ?? null;
}

export function useSpeech() {
  const [supported, setSupported] = useState(false);
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [voicesLoaded, setVoicesLoaded] = useState(false);
  const [speakingId, setSpeakingId] = useState<number | null>(null);
  const [autoSpeak, setAutoSpeakState] = useState(false);
  const runRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    setSupported(true);
    try {
      setAutoSpeakState(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* storage unavailable – default off */
    }
    const load = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length) {
        setVoice(pickVoice(voices));
        setVoicesLoaded(true);
      }
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", load);
      window.speechSynthesis.cancel();
    };
  }, []);

  const stop = useCallback(() => {
    runRef.current++;
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeakingId(null);
  }, []);

  /** Reads text aloud. `onDone` fires when it finishes on its own – not when stopped. */
  const speak = useCallback(
    (id: number, text: string, onDone?: () => void) => {
      if (!supported) {
        onDone?.();
        return;
      }
      const synth = window.speechSynthesis;
      synth.cancel();
      const run = ++runRef.current;
      const parts = splitSentences(cleanForSpeech(text));
      if (!parts.length) {
        onDone?.();
        return;
      }
      setSpeakingId(id);

      let finished = false;
      let watchdog: ReturnType<typeof setInterval> | undefined;
      const done = () => {
        if (finished) return;
        finished = true;
        clearInterval(watchdog);
        if (run !== runRef.current) return;
        setSpeakingId(null);
        onDone?.();
      };
      // Some browsers occasionally drop the final `end` event; notice silence instead.
      setTimeout(() => {
        if (finished) return;
        watchdog = setInterval(() => {
          if (run !== runRef.current) return clearInterval(watchdog);
          if (!synth.speaking && !synth.pending) done();
        }, 600);
      }, 1200);

      parts.forEach((part, i) => {
        const u = new SpeechSynthesisUtterance(part);
        u.lang = LANG;
        if (voice) u.voice = voice;
        u.rate = 0.95;
        u.pitch = 1.1;
        if (i === parts.length - 1) {
          u.onend = done;
          u.onerror = done;
        }
        synth.speak(u);
      });
    },
    [supported, voice],
  );

  const setAutoSpeak = useCallback(
    (on: boolean) => {
      setAutoSpeakState(on);
      try {
        localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
      } catch {
        /* ignore */
      }
      if (!on) stop();
    },
    [stop],
  );

  return {
    supported,
    /** False once voices are known and none of them is Finnish. */
    hasFinnishVoice: !voicesLoaded || voice !== null,
    speakingId,
    speak,
    stop,
    autoSpeak,
    setAutoSpeak,
  };
}
