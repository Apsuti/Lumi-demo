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
 * Warm, calm, child-friendly delivery: enough variation to avoid a flat robotic
 * tone, no theatrical style exaggeration. Speed 1.1 (~18 % faster than the earlier 0.93)
 * is a natural conversational pace without sounding hurried; ElevenLabs allows 0.7–1.2.
 */
export const VOICE_SETTINGS = {
  stability: 0.5,
  similarityBoost: 0.75,
  style: 0.15,
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
