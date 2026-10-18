"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Bug, Check, Loader2, Play, RefreshCw, Settings as Gear, Square, X } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { SAMPLE_LINE } from "@/lib/lumi/voice";
import type { VoicesResponse, useSpeech } from "./useSpeech";

type Speech = ReturnType<typeof useSpeech>;
const PREVIEW_ID = -1;

/** Plain-language diagnosis for the adult setting Lumi up. */
const TTS_HELP: Record<string, string> = {
  checking: "Tarkistetaan äänipalvelua…",
  missing_key:
    "Palvelin ei näe ELEVENLABS_API_KEY-muuttujaa. Tarkista Vercelissä nimi, että muuttuja on käytössä Production-ympäristössä, ja tee Redeploy.",
  invalid_key: "ElevenLabs hylkäsi avaimen. Tarkista, että avain on kopioitu kokonaan ja että se on voimassa.",
  no_voice_permission:
    "Avaimella ei ole lupaa lukea äänilistaa, joten näytetään valmiit äänet. Salli avaimelle ElevenLabsissa Voices-lukuoikeus, niin omat äänesi näkyvät.",
  voices_unavailable: "Äänilistaa ei saatu haettua juuri nyt, joten näytetään valmiit äänet.",
  server_error: "Lumin palvelimeen ei saatu yhteyttä äänen tarkistamiseksi. Päivitä sivu.",
};

export function SettingsButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-ink-soft ring-1 ring-ink/10 transition hover:ring-lilac-300"
      aria-label="Asetukset"
      title="Asetukset"
    >
      <Gear className="h-4 w-4" />
    </button>
  );
}

export function SettingsDialog({ open, speech, onClose }: { open: boolean; speech: Speech; onClose: () => void }) {
  // Which voice the current sample belongs to (one sample plays at a time).
  const [previewVoice, setPreviewVoice] = useState<string | null>(null);
  if (typeof document === "undefined") return null;
  const close = () => {
    if (speech.speakingId === PREVIEW_ID) speech.stop();
    onClose();
  };
  const previewing = (id: string) => speech.speakingId === PREVIEW_ID && previewVoice === id;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
        >
          <motion.div
            role="dialog"
            aria-label="Asetukset"
            className="flex max-h-[85svh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-lift sm:rounded-3xl"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pb-2 pt-5">
              <h2 className="font-display text-lg font-extrabold">Asetukset</h2>
              <button onClick={close} className="grid h-9 w-9 place-items-center rounded-full bg-ink/5" aria-label="Sulje">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto px-5 pb-6">
              <label className="mt-2 flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-sky-50/70 px-4 py-3">
                <span>
                  <span className="block text-sm font-bold text-ink">Lue vastaukset ääneen</span>
                  <span className="block text-xs text-ink-mute">Puhekeskustelussa Lumi puhuu aina.</span>
                </span>
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-lilac-500"
                  checked={speech.autoSpeak}
                  onChange={(e) => speech.setAutoSpeak(e.target.checked)}
                />
              </label>

              <h3 className="mt-5 text-[11px] font-bold uppercase tracking-wider text-ink-mute">Lumin ääni</h3>
              {speech.engine !== "elevenlabs" ? (
                <div className="mt-2 rounded-2xl bg-peach-100/70 px-4 py-3 text-sm text-ink-soft">
                  <p>Luonnollinen ääni ei ole käytössä, joten Lumi käyttää laitteen omaa puheääntä.</p>
                  <p className="mt-2 font-semibold text-ink">{TTS_HELP[speech.ttsStatus] ?? TTS_HELP.missing_key}</p>
                </div>
              ) : (
                <ul className="mt-2 space-y-2">
                  {speech.voices.map((v) => {
                    const selected = v.id === speech.voiceId;
                    return (
                      <li key={v.id}>
                        <div
                          className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ring-1 transition ${
                            selected ? "bg-lilac-50 ring-lilac-300" : "bg-white ring-ink/[0.08] hover:ring-lilac-200"
                          }`}
                        >
                          <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => speech.setVoiceId(v.id)} aria-pressed={selected}>
                            <span
                              className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${selected ? "bg-lilac-500 text-white" : "bg-ink/[0.05] text-transparent"}`}
                            >
                              <Check className="h-3.5 w-3.5" strokeWidth={3} />
                            </span>
                            <span className="min-w-0">
                              <span className="flex items-center gap-2 text-sm font-bold text-ink">
                                {v.name}
                                {v.own && <span className="rounded-full bg-lilac-100 px-2 py-0.5 text-[10px] font-extrabold text-lilac-600">Oma ääni</span>}
                                {v.finnish && <span className="rounded-full bg-mint-100 px-2 py-0.5 text-[10px] font-extrabold text-mint-600">Suomi</span>}
                                {v.category && !v.own && <span className="text-[10px] font-semibold text-ink-mute">{v.category}</span>}
                              </span>
                              {v.description && <span className="block truncate text-xs text-ink-mute">{v.description}</span>}
                            </span>
                          </button>
                          <button
                            onClick={() => {
                              if (previewing(v.id)) return speech.stop();
                              setPreviewVoice(v.id);
                              speech.speak(PREVIEW_ID, SAMPLE_LINE, undefined, v.id);
                            }}
                            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-lilac-600 ring-1 ring-lilac-200"
                            aria-label={`Kuuntele ääni ${v.name}`}
                          >
                            {previewing(v.id) ? <Square className="h-3 w-3 fill-current" /> : <Play className="h-3 w-3 fill-current" />}
                            Kuuntele
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {speech.engine === "elevenlabs" && TTS_HELP[speech.ttsStatus] && (
                <p className="mt-3 rounded-2xl bg-peach-100/70 px-4 py-2.5 text-xs text-ink-soft">{TTS_HELP[speech.ttsStatus]}</p>
              )}
              {speech.engine === "elevenlabs" && (
                <p className="mt-3 text-xs leading-relaxed text-ink-mute">
                  Vinkki: luonnollisimman suomen saa ElevenLabsin Voice Librarysta valitulla suomenkielisellä äänellä. Kun lisäät
                  äänen ElevenLabs-tilillesi, se ilmestyy tähän listaan.
                </p>
              )}
              {speech.engine === "elevenlabs" && <VoiceDebug speech={speech} />}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/**
 * TEMPORARY debug view: shows exactly what ElevenLabs returned for the voice list,
 * so a missing voice can be traced to the API or to Lumi. Remove once voices are sorted out.
 */
function VoiceDebug({ speech }: { speech: Speech }) {
  const [data, setData] = useState<VoicesResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const d = await speech.loadVoices(true);
    setData(d);
    setLoading(false);
    if (d?.debug) {
      console.log(`[Lumi debug] ${d.debug.count} ääntä lähteestä ${d.debug.source}`);
      console.table(d.debug.voices.map((v) => ({ name: v.name, voice_id: v.voice_id, category: v.category, labels: JSON.stringify(v.labels) })));
    }
  };

  const shownIds = new Set(speech.voices.map((v) => v.id));
  const dbg = data?.debug;

  return (
    <details className="mt-5 rounded-2xl border border-dashed border-ink/15 px-4 py-3 text-xs" onToggle={(e) => (e.currentTarget.open && !data ? load() : null)}>
      <summary className="flex cursor-pointer list-none items-center gap-2 font-bold text-ink-soft">
        <Bug className="h-3.5 w-3.5" /> Debug: mitä ElevenLabs palauttaa (väliaikainen)
      </summary>
      <div className="mt-3 space-y-3">
        <button onClick={load} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 font-bold text-ink-soft ring-1 ring-ink/10">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Hae äänet uudelleen (ohittaa välimuistin)
        </button>
        {dbg && (
          <>
            <div className="rounded-xl bg-ink/[0.03] px-3 py-2 leading-relaxed">
              <div>
                Lähde: <b>{dbg.source}</b> · sivuja: <b>{dbg.pages ?? "–"}</b> · ääniä API:sta: <b>{dbg.count}</b> · näytetään listassa: <b>{speech.voices.length}</b>
              </div>
              {dbg.error && (
                <div className="mt-1 text-[#C0643A]">
                  Virhe: HTTP {dbg.error.status ?? "?"} – {JSON.stringify(dbg.error.body).slice(0, 300)}
                </div>
              )}
            </div>
            {dbg.voices.length > 0 && (
              <div className="max-h-64 overflow-auto rounded-xl ring-1 ring-ink/10">
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-white">
                    <tr className="text-[10px] uppercase tracking-wider text-ink-mute">
                      <th className="px-2 py-1.5">Nimi</th>
                      <th className="px-2 py-1.5">voice_id</th>
                      <th className="px-2 py-1.5">category</th>
                      <th className="px-2 py-1.5">labels</th>
                      <th className="px-2 py-1.5">Listassa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dbg.voices.map((v) => (
                      <tr key={v.voice_id} className="border-t border-ink/5 align-top">
                        <td className="px-2 py-1.5 font-semibold text-ink">{v.name}</td>
                        <td className="px-2 py-1.5 font-mono text-[10px]">{v.voice_id}</td>
                        <td className="px-2 py-1.5">{v.category ?? "–"}</td>
                        <td className="px-2 py-1.5 font-mono text-[10px]">{JSON.stringify(v.labels)}</td>
                        <td className="px-2 py-1.5">{shownIds.has(v.voice_id) ? "✓" : "✗"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <details>
              <summary className="cursor-pointer font-semibold text-ink-mute">Raaka JSON</summary>
              <pre className="mt-2 max-h-48 overflow-auto rounded-xl bg-ink/[0.03] p-2 text-[10px]">{JSON.stringify(dbg, null, 2)}</pre>
            </details>
          </>
        )}
      </div>
    </details>
  );
}
