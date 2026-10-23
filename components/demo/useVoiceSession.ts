"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { debugError, debugSet, newTurn, vlog } from "./voiceLog";
import { diagnoseRecognitionError, detectPlatform, makeIssue, preflight, setAudioSession, type MicIssue } from "./micDiagnostics";

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
 *  - if the browser refuses to restart listening without a tap (seen on iPhone/Safari),
 *    the session switches to "tap": the child presses the mic each time they answer.
 */
export type SessionState =
  | "off"
  | "starting" // asking for permission / opening the mic
  | "listening" // mic on, waiting patiently
  | "hearing" // voice detected, words arriving
  | "paused" // Lumi is thinking or speaking – recognition stopped on purpose
  | "tap" // waiting for a press of the mic (the browser only listens after a tap)
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
  onspeechend?: (() => void) | null;
  onsoundstart?: (() => void) | null;
  onaudioend?: (() => void) | null;
};

// End of an utterance. The recogniser only marks a phrase final after it has already
// heard a pause, so little extra waiting is needed then; mid-phrase we wait longer.
const END_AFTER_FINAL_MS = 700;
const END_AFTER_INTERIM_MS = 1500;
// Android Chrome may never mark a result final: once it reports the speech has ended,
// send what was heard after a short pause (it usually ends the session right after).
const END_AFTER_SPEECHEND_MS = 600;
const RESUME_DELAY_MS = 450; // let the speaker's echo die away before listening again
const IDLE_SLEEP_MS = 3 * 60 * 1000; // after 3 quiet minutes the session rests (privacy, battery)

/** Recognition errors that end the session; the exact cause is diagnosed before it is shown. */
const FATAL = new Set(["not-allowed", "service-not-allowed", "audio-capture", "language-not-supported"]);
const START_TIMEOUT_MS = 7000; // recognition asked to start but never did
// The first start may show permission prompts (on iPhone two: microphone + speech
// recognition); give the child and adult time to read and accept them.
const FIRST_START_TIMEOUT_MS = 30_000;
const MAX_NETWORK_ERRORS = 3; // consecutive speech-service failures before giving up

function getRecognition(): (new () => Rec) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const isAndroid = () => /android/i.test(navigator.userAgent);
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/**
 * Joins the recogniser's results into one transcript. Some browsers (Android, Safari) repeat
 * the whole phrase so far in each new result; a result that already contains the text so far
 * replaces it instead of being appended.
 */
export function joinResults(results: RecResult) {
  let text = "";
  for (let i = 0; i < results.length; i++) {
    const part = results[i][0].transcript.replace(/\s+/g, " ").trim();
    if (!part) continue;
    const lower = part.toLowerCase();
    const sofar = text.toLowerCase();
    if (!text || lower.startsWith(sofar)) text = part;
    else if (!sofar.endsWith(lower)) text = `${text} ${part}`;
  }
  return text;
}

export function useVoiceSession(onUtterance: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [state, setState] = useState<SessionState>("off");
  const stateRef = useRef(state);
  stateRef.current = state;
  const [transcript, setTranscript] = useState("");
  const [level, setLevel] = useState(0);
  /** Exact reason the microphone or speech recognition is not working, with fix steps. */
  const [issue, setIssue] = useState<MicIssue | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const activeRef = useRef(false);
  const pausedRef = useRef(false);
  const recRef = useRef<Rec | null>(null);
  const textRef = useRef("");
  const endTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restarts = useRef<number[]>([]);
  const startTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const networkErrors = useRef(0);
  /** True until the first recogniser of this session has actually started. */
  const firstStartRef = useRef(false);
  /** The browser only starts listening from a tap (iPhone): resume by asking for a press. */
  const needsTapRef = useRef(false);
  const captureRetries = useRef(0);
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
      rec.onspeechend = rec.onsoundstart = rec.onaudioend = null;
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

  /** Ends the session and shows exactly what went wrong. */
  const fail = useCallback(
    (found: MicIssue) => {
      activeRef.current = false;
      pausedRef.current = false;
      killRec();
      stopMeter();
      clear(idleTimer);
      clear(resumeTimer);
      clear(startTimer);
      textRef.current = "";
      setTranscript("");
      setIssue(found);
      setState("error");
      console.warn("[Lumi mikki]", found.code, found.technical ?? "");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stopMeter],
  );

  /** Asks for a tap instead of restarting by itself (from now on in this session). */
  const needTap = useCallback((why: string) => {
    if (!needsTapRef.current) {
      needsTapRef.current = true;
      debugSet({ recognitionMode: "napautus – selain ei salli kuuntelun automaattista jatkamista" });
      debugError("Puheentunnistus", `automaattinen uudelleenkäynnistys estetty (${why}) → mikkiä painetaan vastatessa`);
    }
    clear(startTimer);
    killRec();
    debugSet({ recognitionLast: "odottaa mikin painallusta" });
    setState("tap");
  }, []);

  const listen = useCallback((fromTap = false) => {
    const SR = getRecognition();
    if (!SR || !activeRef.current || pausedRef.current || recRef.current) return;
    if (needsTapRef.current && !fromTap) return setState("tap");

    // Guard against a browser that ends sessions instantly: back off instead of spinning.
    const now = Date.now();
    restarts.current = restarts.current.filter((t) => now - t < 10_000);
    restarts.current.push(now);
    if (restarts.current.length > 8) {
      resumeTimer.current = setTimeout(listen, 3000);
      restarts.current = [];
      return;
    }

    // iOS: leave the loudspeaker-only "playback" mode so the microphone can open.
    setAudioSession("auto");
    const rec = new SR();
    rec.lang = "fi-FI";
    rec.continuous = !isAndroid(); // Android repeats words in continuous mode
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    recRef.current = rec;
    textRef.current = "";

    // Each recogniser hands over at most one utterance. This is tracked locally rather than
    // by comparing with recRef, because Android ends the session (onend clears recRef) right
    // after its last result – which previously made the utterance get silently dropped.
    let handedOver = false;
    const commit = (reason: string) => {
      if (handedOver || !activeRef.current || pausedRef.current) return;
      const text = textRef.current.trim();
      if (!text) return;
      handedOver = true;
      clear(endTimer);
      textRef.current = "";
      setTranscript("");
      vlog("3. Transcript finalized", { reason, text });
      // Hand over the utterance and pause until Lumi has answered.
      pausedRef.current = true;
      killRec();
      setState("paused");
      clear(idleTimer);
      onUtteranceRef.current(text);
    };
    const commitAfter = (ms: number, reason: string) => {
      clear(endTimer);
      endTimer.current = setTimeout(() => commit(reason), ms);
    };

    // If the browser accepts start() but never actually starts listening, say so –
    // unless listening already worked and only a restart without a tap is refused.
    const first = firstStartRef.current;
    const limit = first ? FIRST_START_TIMEOUT_MS : START_TIMEOUT_MS;
    clear(startTimer);
    startTimer.current = setTimeout(() => {
      if (recRef.current !== rec || !activeRef.current) return;
      if (!first && !fromTap) return needTap(`onstart puuttui ${limit / 1000} s`);
      fail(makeIssue("start_timeout", detectPlatform(), `onstart puuttui ${limit / 1000} s`));
    }, limit);
    debugSet({ recognitionLast: `start() ${fromTap ? "napautuksesta" : "automaattisesti"}` });

    rec.onstart = () => {
      if (recRef.current !== rec) return;
      clear(startTimer);
      firstStartRef.current = false;
      captureRetries.current = 0;
      debugSet({ recognitionLast: "kuuntelee (onstart)" });
      setState((s) => (s === "hearing" ? s : "listening"));
    };
    const detected = (ev: string) => {
      if (recRef.current !== rec) return;
      if (!textRef.current) newTurn();
      vlog("1. Voice detected", ev);
      setState("hearing");
    };
    rec.onsoundstart = () => recRef.current === rec && vlog("   soundstart");
    rec.onspeechstart = () => detected("speechstart");
    rec.onspeechend = () => {
      vlog("   speechend", { text: textRef.current });
      if (textRef.current) commitAfter(END_AFTER_SPEECHEND_MS, "speechend");
    };
    rec.onaudioend = () => {
      vlog("   audioend", { text: textRef.current });
      if (textRef.current) commitAfter(END_AFTER_SPEECHEND_MS, "audioend");
    };
    rec.onresult = (e) => {
      if (handedOver || pausedRef.current) return;
      const text = joinResults(e.results);
      if (!text) return;
      if (!textRef.current) {
        newTurn();
        if (stateRef.current !== "hearing") vlog("1. Voice detected", "first result");
      }
      const isFinal = e.results[e.results.length - 1].isFinal;
      vlog("2. Transcript received", { text, isFinal, results: e.results.length });
      networkErrors.current = 0;
      textRef.current = text;
      setTranscript(text);
      setState("hearing");
      armIdle();
      // Silence fallback: even if isFinal never arrives, send after a short quiet moment.
      commitAfter(isFinal ? END_AFTER_FINAL_MS : END_AFTER_INTERIM_MS, isFinal ? "isFinal + pause" : "silence (no isFinal)");
    };
    rec.onerror = (e) => {
      if (recRef.current !== rec) return;
      debugSet({ recognitionLast: `virhe: ${e.error}` });
      if (e.error !== "no-speech" && e.error !== "aborted") debugError("Puheentunnistus", e.error);
      // Listening already worked in this session: a refused restart without a tap is not a
      // permission problem – iPhone simply wants a press of the mic.
      if (!first && !fromTap && (e.error === "not-allowed" || e.error === "service-not-allowed")) return needTap(e.error);
      // The mic may still be held for a moment by the previous recogniser or Lumi's voice.
      if (!first && e.error === "audio-capture" && captureRetries.current++ < 2) {
        killRec();
        resumeTimer.current = setTimeout(() => listen(fromTap), 800);
        return;
      }
      if (FATAL.has(e.error)) {
        // Stop at once; work out the precise cause (permission, browser block, busy mic…) meanwhile.
        activeRef.current = false;
        killRec();
        setState("starting");
        diagnoseRecognitionError(e.error).then(fail);
        return;
      }
      if (e.error === "network" && ++networkErrors.current >= MAX_NETWORK_ERRORS) {
        fail(makeIssue("network", detectPlatform(), "SpeechRecognition: network"));
      }
      // no-speech, a single network hiccup, aborted: onend restarts quietly.
    };
    rec.onend = () => {
      if (recRef.current !== rec) return;
      vlog("   onend", { text: textRef.current, handedOver });
      debugSet({ recognitionLast: "päättyi (onend)" });
      recRef.current = null;
      // Android ends the session right after the last result: that is the child's turn.
      if (textRef.current) return commit("onend");
      if (activeRef.current && !pausedRef.current) resumeTimer.current = setTimeout(() => listen(), 250);
    };

    try {
      rec.start();
    } catch (err) {
      recRef.current = null;
      clear(startTimer);
      const name = (err as Error)?.name ?? String(err);
      debugError("Puheentunnistus", `start() heitti ${name}`);
      // Failing on the very first start means recognition cannot run here at all.
      if (first) return fail(makeIssue("start_timeout", detectPlatform(), `start(): ${name}`));
      if (!fromTap && name === "NotAllowedError") return needTap(`start(): ${name}`);
      resumeTimer.current = setTimeout(() => listen(fromTap), 800);
    }
  }, [armIdle, fail, needTap]);

  /** The child presses the mic once to start talking with Lumi. */
  const start = useCallback(() => {
    if (activeRef.current) return;
    // HTTPS, Web Speech API, in-app browsers: known before any permission prompt.
    const blocker = preflight();
    if (blocker) return fail(blocker);
    activeRef.current = true;
    pausedRef.current = false;
    restarts.current = [];
    networkErrors.current = 0;
    firstStartRef.current = true;
    needsTapRef.current = false;
    captureRetries.current = 0;
    debugSet({ recognitionMode: "jatkuva – kuuntelu jatkuu itsestään Lumin jälkeen" });
    setIssue(null);
    setNotice(null);
    setState("starting");
    armIdle();
    startMeter();
    listen(true);
  }, [armIdle, fail, listen, startMeter]);

  /** In "tap" mode: the child pressed the mic to answer. Runs inside the tap, as iPhone requires. */
  const tapToTalk = useCallback(() => {
    if (!activeRef.current) return;
    clear(resumeTimer);
    pausedRef.current = false;
    setState("starting");
    armIdle();
    listen(true);
  }, [armIdle, listen]);

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
      armIdle();
      if (needsTapRef.current) return setState("tap");
      setState("listening");
      listen();
    }, RESUME_DELAY_MS);
  }, [armIdle, listen]);

  /** Send what has been heard so far without waiting for the pause. */
  const sendNow = useCallback(() => {
    if (!textRef.current) return;
    clear(endTimer);
    const text = textRef.current.trim();
    textRef.current = "";
    setTranscript("");
    if (!text) return;
    vlog("3. Transcript finalized", { reason: "Valmis-painike", text });
    pausedRef.current = true;
    killRec();
    setState("paused");
    clear(idleTimer);
    onUtteranceRef.current(text);
  }, []);

  /** Ends the spoken conversation; an optional calm note tells the child how to come back. */
  const end = useCallback((note?: string) => {
    activeRef.current = false;
    pausedRef.current = false;
    clear(resumeTimer);
    clear(idleTimer);
    killRec();
    stopMeter();
    textRef.current = "";
    setTranscript("");
    setState("off");
    if (typeof note === "string") setNotice(note);
  }, [stopMeter]);

  const dismiss = useCallback(() => {
    setIssue(null);
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
    issue,
    notice,
    start,
    tapToTalk,
    pause,
    resume,
    sendNow,
    end,
    dismiss,
  };
}
