/** Shared by the browser and the server: how Lumi's text is turned into speech. */
import { speakMath } from "./spokenMath";

/** Emojis would be read out as their names; numbers, maths and units become spoken Finnish. */
export function cleanForSpeech(text: string) {
  const plain = text
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "")
    .replace(/[«»”"]/g, "")
    // "…" makes the voice trail off and drag; a plain full stop keeps the rhythm even.
    .replace(/\s*(\.{3}|…)+/g, ".");
  return speakMath(plain).replace(/\s+/g, " ").trim();
}

export const MAX_TTS_CHARS = 900;
