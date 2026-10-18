"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Continuous, patient voice conversation on top of the Web Speech API.
 *
 * The child turns the mic on once. From then on:
 *  - the recogniser listens with no time pressure (silence never ends the session),
 *  - when the child stops talking, the utterance is handed to `onUtterance`,
 *  - while Lumi thinks or speaks, recognition is paused so Lumi never hears herself,
 *  - afterwards listening resumes by itself,
 *  - browsers end recognition sessions on their own (silence, ~60 s limits, tab
 *    switches); every such end is restarted quietly.
 */
export type SessionState =
  | "off"
  | "starting" // asking for permission / opening the mic
  | "listening" // mic on, waiting patiently
  | "hearing" // voice detected, words arriving
  | "paused" // Lumi is thinking or speaking – recognition stopped on purpose
  | "error";

type RecResult = ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
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
  onresult: ((e: { resultIndex: number; results: RecResult }) => void) | null;
  onspeechstart: (() => void) | null;
};

// End of an utterance. The recogniser only marks a phrase final after it has already
// heard a pause, so little extra waiting is needed then; mid-phrase we wait longer.
const END_AFTER_FINAL_MS = 700;
const END_AFTER_INTERIM_MS = 1500;
const RESUME_DELAY_MS = 450; // let the speaker's echo die away before listening again
const IDLE_SLEEP_MS = 3 * 60 * 1000; // after 3 quiet minutes the session rests (privacy, battery)

const FATAL: Record<string, string> = {
  "not-allowed": "Mikrofonin käyttö on estetty. Salli mikrofoni selaimen osoiterivin lukkokuvakkeesta ja aloita uudelleen.",
  "service-not-allowed": "Mikrofonin käyttö on estetty. Salli mikrofoni selaimen asetuksista ja aloita uudelleen.",
  "audio-capture": "Mikrofonia ei löytynyt. Onko laitteessa mikrofoni päällä?",
  "language-not-supported": "Tämä selain ei osaa tunnistaa suomea. Kokeile Chromea tai Safaria.",
};

function getRecognition(): (new () => Rec) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const isAndroid = () => /android/i.test(navigator.userAgent);
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export function useVoiceSession(onUtterance: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [state, setState] = useState<SessionState>("off");
  const [transcript, setTranscript] = useState("");
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const activeRef = useRef(false);
  const pausedRef = useRef(false);
  const recRef = useRef<Rec | null>(null);
  const textRef = useRef("");
  const endTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restarts = useRef<number[]>([]);
  const meterRef = useRef<{ stream: MediaStream; ctx: AudioContext; raf: number } | null>(null);
  const onUtteranceRef = useRef(onUtterance);
  onUtteranceRef.current = onUtterance;

  useEffect(() => setSupported(getRecognition() !== null), []);

  const clear = (t: React.MutableRefObject<ReturnType<typeof setTimeout> | null>) => {
    if (t.current) clearTimeout(t.current);
    t.current = null;
  };

  /* ── level meter / voice activity (desktop only; mobile browsers dislike a second mic stream) ── */

  const stopMeter = useCallback(() => {
    const m = meterRef.current;
    meterRef.current = null;
    if (!m) return;
    cancelAnimationFrame(m.raf);
    m.stream.getTracks().forEach((t) => t.stop());
    m.ctx.close().catch(() => {});
    setLevel(0);
  }, []);

  const startMeter = useCallback(async () => {
    if (meterRef.current || isAndroid() || isIOS() || !navigator.mediaDevices?.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (!activeRef.current) return stream.getTracks().forEach((t) => t.stop());
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      let smooth = 0;
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const v of data) sum += ((v - 128) / 128) ** 2;
        const rms = Math.min(1, Math.sqrt(sum / data.length) * 6);
        smooth = smooth * 0.8 + rms * 0.2;
        // Only show the voice while we are actually listening.
        setLevel(pausedRef.current ? 0 : smooth);
        if (meterRef.current) meterRef.current.raf = requestAnimationFrame(tick);
      };
      meterRef.current = { stream, ctx, raf: requestAnimationFrame(tick) };
    } catch {
      /* the meter is a nice-to-have */
    }
  }, []);

  /* ── recogniser lifecycle ── */

  const killRec = () => {
    const rec = recRef.current;
    recRef.current = null;
    if (rec) {
      rec.onend = rec.onresult = rec.onerror = rec.onstart = rec.onspeechstart = null;
      try {
        rec.abort();
      } catch {
        /* already stopped */
      }
    }
    clear(endTimer);
  };

  const armIdle = useCallback(() => {
    clear(idleTimer);
    idleTimer.current = setTimeout(() => {
      if (!activeRef.current || pausedRef.current) return;
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      end();
      setNotice("Keskustelu jäi lepäämään. Paina mikkiä, kun haluat jatkaa.");
    }, IDLE_SLEEP_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const listen = useCallback(() => {
    const SR = getRecognition();
    if (!SR || !activeRef.current || pausedRef.current || recRef.current) return;

    // Guard against a browser that ends sessions instantly: back off instead of spinning.
    const now = Date.now();
    restarts.current = restarts.current.filter((t) => now - t < 10_000);
    restarts.current.push(now);
    if (restarts.current.length > 8) {
      resumeTimer.current = setTimeout(listen, 3000);
      restarts.current = [];
      return;
    }

    const rec = new SR();
    rec.lang = "fi-FI";
    rec.continuous = !isAndroid(); // Android repeats words in continuous mode
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    recRef.current = rec;
    textRef.current = "";

    const commit = () => {
      const text = textRef.current.trim();
      textRef.current = "";
      setTranscript("");
      if (!text || recRef.current !== rec) return;
      // Hand over the utterance and pause until Lumi has answered.
      pausedRef.current = true;
      killRec();
      setState("paused");
      clear(idleTimer);
      onUtteranceRef.current(text);
    };

    rec.onstart = () => {
      if (recRef.current !== rec) return;
      setState((s) => (s === "hearing" ? s : "listening"));
    };
    rec.onspeechstart = () => recRef.current === rec && setState("hearing");
    rec.onresult = (e) => {
      if (recRef.current !== rec || pausedRef.current) return;
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += ` ${e.results[i][0].transcript}`;
      text = text.replace(/\s+/g, " ").trim();
      if (!text) return;
      textRef.current = text;
      setTranscript(text);
      setState("hearing");
      armIdle();
      clear(endTimer);
      endTimer.current = setTimeout(commit, e.results[e.results.length - 1].isFinal ? END_AFTER_FINAL_MS : END_AFTER_INTERIM_MS);
    };
    rec.onerror = (e) => {
      if (recRef.current !== rec) return;
      if (FATAL[e.error]) {
        activeRef.current = false;
        killRec();
        stopMeter();
        clear(idleTimer);
        setError(FATAL[e.error]);
        setState("error");
      }
      // no-speech, network, aborted: onend restarts quietly.
    };
    rec.onend = () => {
      if (recRef.current !== rec) return;
      recRef.current = null;
      // A browser-ended session in the middle of a phrase still counts as the child's turn.
      if (textRef.current) return commit();
      if (activeRef.current && !pausedRef.current) resumeTimer.current = setTimeout(listen, 250);
    };

    try {
      rec.start();
    } catch {
      recRef.current = null;
      resumeTimer.current = setTimeout(listen, 800);
    }
  }, [armIdle, stopMeter]);

  /** The child presses the mic once to start talking with Lumi. */
  const start = useCallback(() => {
    if (!getRecognition() || activeRef.current) return;
    activeRef.current = true;
    pausedRef.current = false;
    restarts.current = [];
    setError(null);
    setNotice(null);
    setState("starting");
    armIdle();
    startMeter();
    listen();
  }, [armIdle, listen, startMeter]);

  /** Lumi is thinking or speaking: stop recognising so she never hears herself. */
  const pause = useCallback(() => {
    if (!activeRef.current) return;
    pausedRef.current = true;
    clear(resumeTimer);
    clear(idleTimer);
    killRec();
    textRef.current = "";
    setTranscript("");
    setState("paused");
  }, []);

  /** Lumi has finished: listen again, patiently. */
  const resume = useCallback(() => {
    if (!activeRef.current) return;
    clear(resumeTimer);
    resumeTimer.current = setTimeout(() => {
      if (!activeRef.current) return;
      pausedRef.current = false;
      setState("listening");
      armIdle();
      listen();
    }, RESUME_DELAY_MS);
  }, [armIdle, listen]);

  /** Send what has been heard so far without waiting for the pause. */
  const sendNow = useCallback(() => {
    if (!textRef.current) return;
    clear(endTimer);
    const rec = recRef.current;
    const text = textRef.current.trim();
    textRef.current = "";
    setTranscript("");
    if (!rec || !text) return;
    pausedRef.current = true;
    killRec();
    setState("paused");
    clear(idleTimer);
    onUtteranceRef.current(text);
  }, []);

  const end = useCallback(() => {
    activeRef.current = false;
    pausedRef.current = false;
    clear(resumeTimer);
    clear(idleTimer);
    killRec();
    stopMeter();
    textRef.current = "";
    setTranscript("");
    setState("off");
  }, [stopMeter]);

  const dismiss = useCallback(() => {
    setError(null);
    setNotice(null);
    setState((s) => (s === "error" ? "off" : s));
  }, []);

  useEffect(
    () => () => {
      activeRef.current = false;
      killRec();
      stopMeter();
      clear(resumeTimer);
      clear(idleTimer);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return {
    supported,
    state,
    /** True from the first press until the child ends the conversation. */
    active: state !== "off" && state !== "error",
    transcript,
    level,
    error,
    notice,
    start,
    pause,
    resume,
    sendNow,
    end,
    dismiss,
  };
}
