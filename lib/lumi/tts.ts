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

/** One voice exactly as ElevenLabs returned it (for the debug view). */
export type RawVoice = { name: string; voice_id: string; category: string | null; labels: Record<string, string> };

export type VoiceListing = {
  voices: VoiceOption[];
  raw: RawVoice[];
  source: "v2/voices" | "v1/voices";
  pages: number;
};

const OWN_CATEGORIES = new Set(["cloned", "professional", "generated"]);

/** Voice fields as the REST API sends them (snake_case); every field treated as optional. */
type ApiVoice = {
  voice_id?: string;
  name?: string | null;
  category?: string | null;
  labels?: Record<string, string> | null;
  description?: string | null;
  verified_languages?: { language?: string | null }[] | null;
};

function toOption(v: ApiVoice): VoiceOption {
  const labels = v.labels ?? {};
  const finnish =
    (v.verified_languages ?? []).some((l) => l.language?.toLowerCase().startsWith("fi")) || /finn|suom/i.test(JSON.stringify(labels));
  const description = [labels.description, labels.age, labels.accent, labels.gender].filter(Boolean).join(" · ");
  return {
    id: v.voice_id!,
    name: v.name || "Nimetön ääni",
    description: description || v.description?.slice(0, 60) || "",
    finnish,
    category: v.category ?? null,
    own: OWN_CATEGORIES.has(v.category ?? ""),
  };
}

/** Own voices first, then Finnish-verified, then the rest – nothing is filtered out. */
function sortVoices(voices: VoiceOption[]) {
  return voices.sort((a, b) => Number(b.own) - Number(a.own) || Number(b.finnish) - Number(a.finnish) || a.name.localeCompare(b.name));
}

export class VoiceListError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`ElevenLabs voices request failed with HTTP ${status}`);
  }
}

/**
 * The voice list is read with a plain, lenient request instead of the SDK: the SDK
 * rejects the whole response if a single voice is missing a field it expects, which
 * would silently hide every voice (including the account owner's own).
 */
async function getVoicesJson(path: string): Promise<{ voices?: ApiVoice[]; has_more?: boolean; next_page_token?: string | null }> {
  const base = (process.env.ELEVENLABS_BASE_URL || "https://api.elevenlabs.io").replace(/\/$/, "");
  const res = await fetch(`${base}${path}`, {
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY?.trim() ?? "" },
    cache: "no-store",
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* keep raw text */
  }
  if (!res.ok) throw new VoiceListError(res.status, body);
  return body as { voices?: ApiVoice[]; has_more?: boolean; next_page_token?: string | null };
}

let voiceCache: { at: number; listing: VoiceListing } | null = null;
const CACHE_MS = 60 * 1000; // short, so a newly added voice shows up within a minute

/**
 * Every voice on the account (all categories, all pages). Tries the v2 search endpoint
 * first and falls back to the older v1 list if it fails.
 */
export async function listVoices(fresh = false): Promise<VoiceListing> {
  if (!fresh && voiceCache && Date.now() - voiceCache.at < CACHE_MS) return voiceCache.listing;
  let all: ApiVoice[] = [];
  let source: VoiceListing["source"] = "v2/voices";
  let pages = 0;
  try {
    let token: string | null | undefined;
    do {
      const q = new URLSearchParams({ page_size: "100" });
      if (token) q.set("next_page_token", token);
      const page = await getVoicesJson(`/v2/voices?${q}`);
      all.push(...(page.voices ?? []));
      token = page.has_more ? page.next_page_token : null;
      pages++;
    } while (token && pages < 10);
  } catch (err) {
    console.warn("[lumi/tts] v2/voices failed, trying v1/voices:", err instanceof VoiceListError ? `${err.status} ${JSON.stringify(err.body)}` : err);
    all = (await getVoicesJson("/v1/voices")).voices ?? [];
    source = "v1/voices";
    pages = 1;
  }
  all = all.filter((v) => typeof v.voice_id === "string");
  const listing: VoiceListing = {
    voices: sortVoices(all.map(toOption)),
    raw: all.map((v) => ({ name: v.name ?? "", voice_id: v.voice_id!, category: v.category ?? null, labels: v.labels ?? {} })),
    source,
    pages,
  };
  console.log(
    `[lumi/tts] ${listing.raw.length} voices from ${listing.source}:\n` +
      listing.raw.map((v) => `  ${v.name} | ${v.voice_id} | ${v.category} | ${JSON.stringify(v.labels)}`).join("\n"),
  );
  voiceCache = { at: Date.now(), listing };
  return listing;
}
