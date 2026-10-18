import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { PRESET_VOICES, type VoiceOption } from "./voice";

/**
 * eleven_multilingual_v2 gives the most natural Finnish prosody. For lower latency,
 * set ELEVENLABS_MODEL=eleven_flash_v2_5 (or try eleven_v3 for more expression).
 */
export const TTS_MODEL = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";

/** The voice used until the tester picks another one in Lumi's settings. */
export const DEFAULT_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || PRESET_VOICES[0].id;

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
  return Boolean(process.env.ELEVENLABS_API_KEY);
}

let client: ElevenLabsClient | null = null;
export function getTts() {
  // ELEVENLABS_BASE_URL is optional, e.g. for EU data residency.
  client ??= new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY, baseUrl: process.env.ELEVENLABS_BASE_URL || undefined });
  return client;
}

/** multilingual_v2 detects the language itself and rejects language_code; newer models accept it. */
export function languageCodeFor(model: string) {
  return model === "eleven_multilingual_v2" ? undefined : "fi";
}

let voiceCache: { at: number; voices: VoiceOption[] } | null = null;

/** The account's voices (premade + any added from the Voice Library), Finnish-verified first. */
export async function listVoices(): Promise<VoiceOption[]> {
  if (voiceCache && Date.now() - voiceCache.at < 10 * 60 * 1000) return voiceCache.voices;
  const res = await getTts().voices.search({ pageSize: 100 });
  const voices = res.voices
    .map((v): VoiceOption => {
      const labels = v.labels ?? {};
      const finnish = (v.verifiedLanguages ?? []).some((l) => l.language?.toLowerCase().startsWith("fi")) || /finn|suom/i.test(JSON.stringify(labels));
      const description = [labels.description, labels.age, labels.accent, labels.gender].filter(Boolean).join(" · ");
      return { id: v.voiceId, name: v.name ?? "Nimetön ääni", description: description || v.description?.slice(0, 60) || "", finnish };
    })
    .sort((a, b) => Number(b.finnish) - Number(a.finnish) || a.name.localeCompare(b.name));
  voiceCache = { at: Date.now(), voices };
  return voices;
}
