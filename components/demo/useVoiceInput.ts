"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Child-friendly voice input on top of the browser's SpeechRecognition API.
 * Every phase is surfaced so the UI can always tell the child whether the mic
 * is really on and whether their voice is being picked up.
 */
export type VoiceState =
  | "idle"
  | "starting" // asking for permission / opening the mic
  | "listening" // mic on, nothing heard yet
  | "hearing" // voice detected, words arriving
  | "error";

type Rec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onsoundstart: (() => void) | null;
  onspeechstart: (() => void) | null;
};

// Children pause mid-sentence, so wait longer while words are still unsettled.
const SILENCE_AFTER_FINAL_MS = 1500;
const SILENCE_AFTER_INTERIM_MS = 2600;
const NOTHING_MS = 9000; // stop if nothing at all is heard
const MAX_MS = 30000;
// Android Chrome repeats words in continuous mode; one utterance per turn is more reliable there.
const isAndroid = () => /android/i.test(navigator.userAgent);

const ERRORS: Record<string, string> = {
  "not-allowed": "Mikrofonin käyttö on estetty. Salli mikrofoni selaimen osoiterivin lukkokuvakkeesta ja kokeile uudelleen.",
  "service-not-allowed": "Mikrofonin käyttö on estetty. Salli mikrofoni selaimen asetuksista ja kokeile uudelleen.",
  "no-speech": "En kuullut mitään. Paina mikkiä ja puhu vähän kovempaa.",
  "audio-capture": "Mikrofonia ei löytynyt. Onko laitteessa mikrofoni päällä?",
  network: "Puheentunnistus tarvitsee nettiyhteyden. Tarkista yhteys ja kokeile uudelleen.",
  "language-not-supported": "Tämä selain ei osaa tunnistaa suomea. Kokeile Chromea tai Safaria.",
};

function getRecognition(): (new () => Rec) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useVoiceInput(onFinal: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<Rec | null>(null);
  const textRef = useRef("");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const silenceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const meterRef = useRef<{ stream: MediaStream; ctx: AudioContext; raf: number } | null>(null);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  useEffect(() => setSupported(getRecognition() !== null), []);

  const stopMeter = useCallback(() => {
    const m = meterRef.current;
    meterRef.current = null;
    if (!m) return;
    cancelAnimationFrame(m.raf);
    m.stream.getTracks().forEach((t) => t.stop());
    m.ctx.close().catch(() => {});
    setLevel(0);
  }, []);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (silenceRef.current) clearTimeout(silenceRef.current);
    silenceRef.current = null;
  }, []);

  /** Optional live level meter. Skipped on Android, where a second mic stream can break recognition. */
  const startMeter = useCallback(async () => {
    if (/android/i.test(navigator.userAgent) || !navigator.mediaDevices?.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!recRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const v of data) sum += ((v - 128) / 128) ** 2;
        setLevel(Math.min(1, Math.sqrt(sum / data.length) * 6));
        if (meterRef.current) meterRef.current.raf = requestAnimationFrame(tick);
      };
      meterRef.current = { stream, ctx, raf: requestAnimationFrame(tick) };
    } catch {
      /* the meter is a nice-to-have */
    }
  }, []);

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const cancel = useCallback(() => {
    const rec = recRef.current;
    recRef.current = null;
    textRef.current = "";
    rec?.abort();
    clearTimers();
    stopMeter();
    setTranscript("");
    setState("idle");
  }, [clearTimers, stopMeter]);

  const start = useCallback(() => {
    const SR = getRecognition();
    if (!SR || recRef.current) return;
    if (meterRef.current) stopMeter();
    const rec = new SR();
    rec.lang = "fi-FI";
    rec.continuous = !isAndroid();
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    recRef.current = rec;
    textRef.current = "";
    setTranscript("");
    setError(null);
    setState("starting");

    const armSilence = (settled: boolean) => {
      if (silenceRef.current) clearTimeout(silenceRef.current);
      silenceRef.current = setTimeout(() => rec.stop(), settled ? SILENCE_AFTER_FINAL_MS : SILENCE_AFTER_INTERIM_MS);
    };

    rec.onstart = () => {
      setState("listening");
      startMeter();
      timers.current.push(
        setTimeout(() => !textRef.current && rec.stop(), NOTHING_MS),
        setTimeout(() => rec.stop(), MAX_MS),
      );
    };
    rec.onsoundstart = () => setState((s) => (s === "listening" ? "hearing" : s));
    rec.onspeechstart = () => setState((s) => (s === "listening" ? "hearing" : s));
    rec.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += ` ${e.results[i][0].transcript}`;
      text = text.replace(/\s+/g, " ").trim();
      if (!text) return;
      textRef.current = text;
      setTranscript(text);
      setState("hearing");
      armSilence(e.results[e.results.length - 1].isFinal);
    };
    rec.onerror = (e) => {
      if (e.error === "aborted") return;
      if (e.error === "no-speech" && textRef.current) return;
      setError(ERRORS[e.error] ?? "Puheentunnistus ei onnistunut. Kokeile uudelleen tai kirjoita viesti.");
    };
    rec.onend = () => {
      if (recRef.current !== rec) return; // cancelled
      recRef.current = null;
      clearTimers();
      stopMeter();
      const text = textRef.current;
      setTranscript("");
      if (text) {
        setState("idle");
        onFinalRef.current(text);
      } else {
        setError((err) => err ?? ERRORS["no-speech"]);
        setState("error");
      }
    };

    try {
      rec.start();
    } catch {
      recRef.current = null;
      setError("Mikkiä ei saatu päälle. Kokeile uudelleen.");
      setState("error");
    }
  }, [clearTimers, startMeter, stopMeter]);

  const dismissError = useCallback(() => {
    setError(null);
    setState("idle");
  }, []);

  useEffect(
    () => () => {
      recRef.current?.abort();
      recRef.current = null;
      clearTimers();
      stopMeter();
    },
    [clearTimers, stopMeter],
  );

  return {
    supported,
    state,
    active: state === "starting" || state === "listening" || state === "hearing",
    transcript,
    level,
    error,
    start,
    stop,
    cancel,
    dismissError,
  };
}
