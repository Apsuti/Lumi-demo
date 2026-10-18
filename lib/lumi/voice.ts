/** Shared by the browser and the server: how Lumi's text is turned into speech. */

/** Emojis would be read out as their names, and maths symbols need words. */
export function cleanForSpeech(text: string) {
  return text
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "")
    .replace(/[«»”"]/g, "")
    // "…" makes the voice trail off and drag; a plain full stop keeps the rhythm even.
    .replace(/\s*(\.{3}|…)+/g, ".")
    .replace(/×/g, " kertaa ")
    .replace(/÷/g, " jaettuna ")
    .replace(/\s+/g, " ")
    .trim();
}

export const MAX_TTS_CHARS = 900;
