import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

/** Lumi always speaks with the same voice: "Petteri" on ElevenLabs. */
export const LUMI_VOICE_ID = "uBwJeWtV6tQa8ixtM7ZQ";

/**
 * eleven_flash_v2_5 is ElevenLabs' lowest-latency model and speaks Finnish – chosen so
 * Lumi starts talking almost immediately. For slightly richer prosody at the cost of
 * speed, set ELEVENLABS_MODEL=eleven_multilingual_v2.
 */
export const TTS_MODEL = process.env.ELEVENLABS_MODEL || "eleven_flash_v2_5";

/**
 * Calm, conversational delivery at an even pace from the first word to the last.
 * - stability 0.65: steadier rhythm and tempo (0.5 let the pace drift and drag at phrase
 *   ends); still lively enough not to sound flat or robotic.
 * - similarityBoost 0.75: keeps Petteri's voice; higher would also copy recording artefacts.
 * - style 0: style exaggeration amplifies the speaker's dramatic pauses and stretched
 *   endings and makes delivery less stable (ElevenLabs recommends 0).
 * - speed 1.1: natural conversational pace, not hurried; ElevenLabs allows 0.7–1.2.
 */
export const VOICE_SETTINGS = {
  stability: 0.65,
  similarityBoost: 0.75,
  style: 0,
  useSpeakerBoost: true,
  speed: Math.min(1.2, Math.max(0.7, Number(process.env.ELEVENLABS_SPEED) || 1.1)),
};

export function hasTts() {
  return Boolean(process.env.ELEVENLABS_API_KEY?.trim());
}

let client: ElevenLabsClient | null = null;
export function getTts() {
  // ELEVENLABS_BASE_URL is optional, e.g. for EU data residency.
  client ??= new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY?.trim(), baseUrl: process.env.ELEVENLABS_BASE_URL || undefined });
  return client;
}

/** multilingual_v2 detects the language itself and rejects language_code; newer models accept it. */
export function languageCodeFor(model: string) {
  return model === "eleven_multilingual_v2" ? undefined : "fi";
}
