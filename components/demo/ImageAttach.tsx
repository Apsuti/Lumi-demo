"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ImagePlus, Loader2, X } from "lucide-react";
import { useRef } from "react";

/** Picture as a file (developer testing in the normal view). There is no camera: the child cannot show anything. */
export function AttachButtons({ disabled, onFile }: { disabled: boolean; onFile: (f: Blob) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) onFile(f);
  };

  return (
    <>
      <button
        type="button"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-sky-50 text-sky-600 transition hover:bg-sky-100 disabled:opacity-30"
        disabled={disabled}
        onClick={() => fileRef.current?.click()}
        aria-label="Lisää kuva"
        title="Lisää kuva"
      >
        <ImagePlus className="h-5 w-5" />
      </button>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pick} />
    </>
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
