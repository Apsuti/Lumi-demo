/** Shared by the browser and the server: how Lumi's text is turned into speech. */

/** Emojis would be read out as their names, and maths symbols need words. */
export function cleanForSpeech(text: string) {
  return text
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "")
    .replace(/[«»”"]/g, "")
    .replace(/×/g, " kertaa ")
    .replace(/÷/g, " jaettuna ")
    .replace(/\s+/g, " ")
    .trim();
}

export const MAX_TTS_CHARS = 900;

/** Voice ids are short alphanumeric strings; anything else is rejected before reaching ElevenLabs. */
export const VOICE_ID_RE = /^[A-Za-z0-9]{8,40}$/;

export type VoiceOption = {
  id: string;
  name: string;
  description: string;
  /** ElevenLabs has verified this voice for Finnish. */
  finnish: boolean;
  /** ElevenLabs category: premade, cloned, generated, professional (null for built-in fallbacks). */
  category?: string | null;
  /** The account owner's own voice (cloned, professional or generated). */
  own?: boolean;
};

/**
 * Fallback choices when the account's voice list can't be fetched. These are
 * ElevenLabs' built-in voices; a native Finnish voice from the Voice Library
 * (added to the account) will sound more natural.
 */
export const PRESET_VOICES: VoiceOption[] = [
  { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", description: "Lämmin ja ystävällinen", finnish: false },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", description: "Pehmeä ja rauhallinen", finnish: false },
  { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice", description: "Selkeä ja reipas", finnish: false },
  { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie", description: "Rento ja luonteva", finnish: false },
];

export const SAMPLE_LINE = "Hei! Minä olen Lumi. Mietitään yhdessä – sinä keksit, minä kyselen.";
