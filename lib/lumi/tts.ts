import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

/** Lumi always speaks with the same voice: "Petteri" on ElevenLabs. */
export const LUMI_VOICE_ID = "uBwJeWtV6tQa8ixtM7ZQ";

/**
 * eleven_multilingual_v2 gives the most natural Finnish prosody. For lower latency,
 * set ELEVENLABS_MODEL=eleven_flash_v2_5 (or try eleven_v3 for more expression).
 */
export const TTS_MODEL = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";

/**
 * Warm, calm, child-friendly delivery: enough variation to avoid a flat robotic
 * tone, no theatrical style exaggeration, slightly slower than default.
 */
export const VOICE_SETTINGS = {
  stability: 0.5,
  similarityBoost: 0.75,
  style: 0.15,
  useSpeakerBoost: true,
  speed: Number(process.env.ELEVENLABS_SPEED || 0.93),
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
