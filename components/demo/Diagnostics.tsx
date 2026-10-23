"use client";

import { Check, CircleHelp, Copy, Loader2, Mic, Volume2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { audioSessionType, detectPlatform, permissionState, probeMicrophone } from "./micDiagnostics";
import type { SessionState } from "./useVoiceSession";
import { useDebugState } from "./voiceLog";

type Row = { label: string; value: string; ok?: boolean | null };

const PERMISSION = { granted: "Sallittu", denied: "Estetty", prompt: "Ei vielä kysytty", unknown: "Selain ei kerro (iOS < 16)" };
const SESSION: Record<SessionState, string> = {
  off: "pois päältä",
  starting: "käynnistyy",
  listening: "kuuntelee",
  hearing: "kuulee puhetta",
  paused: "tauolla (Lumi miettii tai puhuu)",
  tap: "odottaa mikin painallusta",
  error: "virhe",
};

/**
 * "Laitetiedot": everything needed to see why the microphone or Lumi's voice does not
 * work on a particular phone – readable on the phone itself, and copyable as a report.
 */
export function DiagnosticsPanel({
  open,
  onClose,
  sessionState,
  engine,
  browserVoiceName,
  onTestVoice,
}: {
  open: boolean;
  onClose: () => void;
  sessionState: SessionState;
  engine: "elevenlabs" | "browser" | "none";
  browserVoiceName: string | null;
  onTestVoice: () => void;
}) {
  const debug = useDebugState();
  const [perm, setPerm] = useState<PermissionState | "unknown">("unknown");
  const [micTest, setMicTest] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    permissionState().then(setPerm);
    // Follow permission changes live (e.g. the child taps "Allow").
    let status: PermissionStatus | null = null;
    navigator.permissions
      ?.query({ name: "microphone" as PermissionName })
      .then((s) => {
        status = s;
        s.onchange = () => setPerm(s.state);
      })
      .catch(() => {});
    return () => {
      if (status) status.onchange = null;
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const p = detectPlatform();
  const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
  const srName = w.SpeechRecognition ? "SpeechRecognition" : w.webkitSpeechRecognition ? "webkitSpeechRecognition" : null;
  const gum = typeof navigator.mediaDevices?.getUserMedia === "function";
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia("(display-mode: standalone)").matches;

  const sections: { title: string; rows: Row[] }[] = [
    {
      title: "Laite",
      rows: [
        { label: "Laite", value: p.device },
        { label: "Käyttöjärjestelmä", value: p.osLabel },
        { label: "Selain", value: p.browserLabel, ok: p.browser === "inapp" || p.browser === "firefox" ? false : true },
        { label: "Suojattu yhteys (https)", value: window.isSecureContext ? "Kyllä" : "Ei", ok: window.isSecureContext },
        { label: "Avattu kotivalikosta (web-sovellus)", value: standalone ? "Kyllä" : "Ei" },
      ],
    },
    {
      title: "Mikrofoni ja puheentunnistus",
      rows: [
        { label: "SpeechRecognition", value: srName ? `Tuettu (${srName})` : "Ei tuettu", ok: Boolean(srName) },
        { label: "getUserMedia (mikrofonirajapinta)", value: gum ? "Saatavilla" : "Puuttuu", ok: gum },
        { label: "Mikrofonilupa", value: PERMISSION[perm], ok: perm === "granted" ? true : perm === "denied" ? false : null },
        ...(micTest ? [{ label: "Mikrofonin testi", value: micTest, ok: micTest === "Mikrofoni toimii" }] : []),
        { label: "Puhekeskustelu", value: SESSION[sessionState], ok: sessionState === "error" ? false : null },
        { label: "Kuuntelutapa", value: debug.recognitionMode },
        { label: "Tunnistimen viimeisin tila", value: debug.recognitionLast },
      ],
    },
    {
      title: "Ääni",
      rows: [
        {
          label: "Äänen toisto (autoplay-lupa)",
          value: { pending: "Ei vielä avattu – napauta mitä tahansa", unlocked: "Sallittu", blocked: "Estetty – napauta näyttöä" }[debug.audioUnlock],
          ok: debug.audioUnlock === "unlocked" ? true : debug.audioUnlock === "blocked" ? false : null,
        },
        { label: "AudioContext", value: debug.audioContext, ok: debug.audioContext.startsWith("running") ? true : null },
        { label: "iOS-äänisessio", value: audioSessionType() },
        {
          label: "ElevenLabs TTS",
          value: debug.ttsConfigured === null ? "Tarkistetaan…" : debug.ttsConfigured ? "Käytössä (Petteri)" : "Ei käytössä – avain puuttuu",
          ok: debug.ttsConfigured,
        },
        { label: "ElevenLabs viimeisin pyyntö", value: debug.ttsLast, ok: debug.ttsLast.startsWith("OK") ? true : debug.ttsLast.startsWith("virhe") ? false : null },
        { label: "Viimeksi puhunut ääni", value: debug.voiceUsed },
        { label: "Selaimen suomenkielinen varaääni", value: browserVoiceName ?? (engine === "none" ? "Ei puhesynteesiä" : "Ei löytynyt"), ok: browserVoiceName ? true : null },
      ],
    },
  ];

  const testMic = async () => {
    setTesting(true);
    const issue = await probeMicrophone(p);
    setMicTest(issue ? `${issue.title} (${issue.technical})` : "Mikrofoni toimii");
    setPerm(await permissionState());
    setTesting(false);
  };

  const report = () =>
    [
      `Lumi – laitetiedot ${new Date().toLocaleString("fi-FI")}`,
      `UA: ${navigator.userAgent}`,
      ...sections.flatMap((s) => [``, `# ${s.title}`, ...s.rows.map((r) => `${r.label}: ${r.value}`)]),
      ``,
      `# Viimeisin virhe`,
      debug.lastError,
      ``,
      `# Tapahtumaloki`,
      ...debug.events,
    ].join("\n");

  const copy = async () => {
    const text = report();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Older iOS: fall back to a selected textarea.
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 sm:items-center" onClick={onClose}>
      <div
        className="flex max-h-[92svh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-lift sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Laitetiedot"
      >
        <div className="flex items-center justify-between border-b border-ink/[0.06] px-5 py-3.5">
          <div>
            <div className="font-display text-base font-extrabold">Laitetiedot</div>
            <div className="text-xs text-ink-mute">Mikrofonin ja äänen vianetsintä</div>
          </div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-ink/5" aria-label="Sulje">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 text-sm">
          <div className="flex flex-wrap gap-2">
            <button onClick={onTestVoice} className="inline-flex items-center gap-1.5 rounded-full bg-lilac-500 px-4 py-2 text-sm font-bold text-white">
              <Volume2 className="h-4 w-4" /> Testaa ääni
            </button>
            <button
              onClick={testMic}
              disabled={testing || (sessionState !== "off" && sessionState !== "error")}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold text-ink-soft ring-1 ring-ink/10 disabled:opacity-40"
              title={sessionState !== "off" && sessionState !== "error" ? "Lopeta puhekeskustelu ensin" : undefined}
            >
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />} Testaa mikrofoni
            </button>
            <button onClick={copy} className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold text-ink-soft ring-1 ring-ink/10">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Kopioitu" : "Kopioi raportti"}
            </button>
          </div>

          {sections.map((s) => (
            <section key={s.title}>
              <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-mute">{s.title}</h3>
              <ul className="space-y-1 rounded-2xl bg-ink/[0.03] p-3">
                {s.rows.map((r) => (
                  <li key={r.label} className="flex items-start gap-2 text-xs">
                    <StatusDot ok={r.ok} />
                    <span className="shrink-0 font-semibold text-ink">{r.label}:</span>
                    <span className="min-w-0 break-words text-ink-soft">{r.value}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <section>
            <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-mute">Viimeisin virhe</h3>
            <p className="rounded-2xl bg-peach-100/60 p-3 font-mono text-[11px] text-ink">{debug.lastError}</p>
          </section>

          <section>
            <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-mute">Tapahtumaloki</h3>
            <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-ink/[0.04] p-3 font-mono text-[10px] leading-relaxed text-ink-soft">
              {debug.events.length ? debug.events.slice().reverse().join("\n") : "Ei vielä tapahtumia. Kokeile mikkiä tai ääntä."}
            </pre>
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function StatusDot({ ok }: { ok?: boolean | null }) {
  if (ok === undefined) return <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-ink/15" />;
  return (
    <span className={`mt-px grid h-4 w-4 shrink-0 place-items-center rounded-full text-white ${ok === true ? "bg-mint-400" : ok === false ? "bg-[#E07A4F]" : "bg-ink-mute/50"}`}>
      {ok === true ? <Check className="h-2.5 w-2.5" strokeWidth={4} /> : ok === false ? <X className="h-2.5 w-2.5" strokeWidth={4} /> : <CircleHelp className="h-2.5 w-2.5" />}
    </span>
  );
}
