"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Camera, ImagePlus, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { captureFrame } from "./image";

/** Phones open the real camera app through the file input; laptops get an in-page webcam view. */
function prefersNativeCamera() {
  return window.matchMedia("(pointer: coarse)").matches;
}

export function AttachButtons({ disabled, onFile }: { disabled: boolean; onFile: (f: Blob) => void }) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [webcam, setWebcam] = useState(false);

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) onFile(f);
  };

  const btn =
    "grid h-11 w-11 shrink-0 place-items-center rounded-full bg-sky-50 text-sky-600 transition hover:bg-sky-100 disabled:opacity-30";

  return (
    <>
      <button
        type="button"
        className={btn}
        disabled={disabled}
        onClick={() => (prefersNativeCamera() || !navigator.mediaDevices?.getUserMedia ? cameraRef.current?.click() : setWebcam(true))}
        aria-label="Ota kuva kameralla"
        title="Ota kuva kameralla"
      >
        <Camera className="h-5 w-5" />
      </button>
      <button type="button" className={btn} disabled={disabled} onClick={() => fileRef.current?.click()} aria-label="Lisää kuva" title="Lisää kuva">
        <ImagePlus className="h-5 w-5" />
      </button>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} />
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pick} />
      {/* Portal: the chat card's backdrop blur would otherwise trap a fixed overlay inside it. */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {webcam && (
              <WebcamDialog
                onClose={() => setWebcam(false)}
                onCapture={(b) => {
                  setWebcam(false);
                  onFile(b);
                }}
                onFallback={() => {
                  setWebcam(false);
                  cameraRef.current?.click();
                }}
              />
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}

function WebcamDialog({ onClose, onCapture, onFallback }: { onClose: () => void; onCapture: (b: Blob) => void; onFallback: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch(() => setError(true));
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-center bg-ink/60 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-lift"
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Ota kuva"
      >
        <div className="flex items-center justify-between px-5 py-3">
          <span className="font-display text-base font-extrabold">Ota kuva tehtävästä</span>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-ink/5" aria-label="Sulje">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="relative aspect-video bg-ink">
          {error ? (
            <div className="grid h-full place-items-center p-6 text-center text-sm text-white/80">
              <div>
                Kameraa ei saatu auki. Salli kameran käyttö selaimen osoiterivin lukkokuvakkeesta, tai valitse kuva tiedostona.
                <button onClick={onFallback} className="mx-auto mt-4 block rounded-full bg-white px-4 py-2 text-sm font-bold text-ink">
                  Valitse kuva
                </button>
              </div>
            </div>
          ) : (
            <>
              <video ref={videoRef} autoPlay playsInline muted onLoadedData={() => setReady(true)} className="h-full w-full object-contain" />
              {!ready && <Loader2 className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 animate-spin text-white/70" />}
            </>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <p className="text-sm text-ink-soft">Pidä tehtävä kuvassa suorassa ja hyvässä valossa.</p>
          <button
            disabled={!ready}
            onClick={async () => videoRef.current && onCapture(await captureFrame(videoRef.current))}
            className="btn-primary shrink-0 !px-5 !py-3 disabled:opacity-40"
          >
            <Camera className="h-4 w-4" /> Ota kuva
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/** Thumbnail of the picture waiting to be sent. */
export function AttachmentPreview({ src, busy, onRemove }: { src: string | null; busy: boolean; onRemove: () => void }) {
  return (
    <AnimatePresence>
      {(src || busy) && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          className="mx-4 mt-3 flex items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50/80 p-2 pr-3 sm:mx-6"
        >
          <div className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-white ring-1 ring-ink/10">
            {src ? <img src={src} alt="Lähetettävä kuva" className="h-full w-full object-cover" /> : <Loader2 className="h-5 w-5 animate-spin text-sky-500" />}
          </div>
          <div className="min-w-0 flex-1 text-sm">
            <div className="font-bold text-ink">{src ? "Kuva on valmis" : "Valmistellaan kuvaa…"}</div>
            <div className="text-ink-soft">{src ? "Kerro halutessasi, mitä kuvasta mietit – tai lähetä se heti." : "Hetki vain."}</div>
          </div>
          {src && (
            <button onClick={onRemove} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-ink-mute ring-1 ring-ink/10" aria-label="Poista kuva">
              <X className="h-4 w-4" />
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Covers the chat while a picture is dragged over it. */
export function DropOverlay({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="pointer-events-none absolute inset-2 z-30 grid place-items-center rounded-[1.75rem] border-[3px] border-dashed border-sky-400 bg-sky-50/90 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="text-center">
            <ImagePlus className="mx-auto h-12 w-12 text-sky-500" />
            <div className="mt-3 font-display text-xl font-extrabold text-ink">Pudota kuva tähän</div>
            <div className="mt-1 text-sm text-ink-soft">Lumi katsoo tehtävää kanssasi.</div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
