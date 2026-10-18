import { ElevenLabsError } from "@elevenlabs/elevenlabs-js";
import { jsonError, rateLimited } from "@/lib/lumi/server";
import { DEFAULT_VOICE_ID, TTS_MODEL, VOICE_SETTINGS, getTts, hasTts, languageCodeFor, listVoices } from "@/lib/lumi/tts";
import { MAX_TTS_CHARS, PRESET_VOICES, VOICE_ID_RE, cleanForSpeech } from "@/lib/lumi/voice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/tts?text=…&voice=…  → audio/mpeg, streamed so playback starts early.
 * A plain GET lets an <audio> element stream it natively and lets the browser
 * cache replays of the same sentence.
 *
 * GET /api/tts?voices=1  → { configured, defaultVoiceId, voices }
 */
export async function GET(req: Request) {
  const url = new URL(req.url);

  if (url.searchParams.has("voices")) {
    if (!hasTts()) return Response.json({ configured: false, defaultVoiceId: null, voices: [] });
    let voices = PRESET_VOICES;
    try {
      const fromAccount = await listVoices();
      if (fromAccount.length) voices = fromAccount;
    } catch {
      /* fall back to presets */
    }
    return Response.json({ configured: true, defaultVoiceId: DEFAULT_VOICE_ID, model: TTS_MODEL, voices });
  }

  if (!hasTts()) return jsonError(503, "not_configured", "ElevenLabs-avain puuttuu.");
  if (rateLimited(req)) return jsonError(429, "rate_limited", "Pidetään pieni tauko.");

  const text = cleanForSpeech(url.searchParams.get("text") ?? "").slice(0, MAX_TTS_CHARS);
  const voice = url.searchParams.get("voice") || DEFAULT_VOICE_ID;
  if (!text) return jsonError(400, "bad_request", "Tyhjä teksti.");
  if (!VOICE_ID_RE.test(voice)) return jsonError(400, "bad_request", "Virheellinen ääni.");

  try {
    const audio = await getTts().textToSpeech.stream(
      voice,
      {
        text,
        modelId: TTS_MODEL,
        languageCode: languageCodeFor(TTS_MODEL),
        outputFormat: "mp3_44100_128",
        voiceSettings: VOICE_SETTINGS,
      },
      { abortSignal: req.signal },
    );
    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    const status = err instanceof ElevenLabsError ? err.statusCode : undefined;
    if (status === 401) return jsonError(503, "not_configured", "ElevenLabs-avain ei kelpaa.");
    if (status === 404 || status === 400) return jsonError(400, "bad_voice", "Ääntä ei löytynyt.");
    if (status === 429) return jsonError(429, "rate_limited", "Äänipalvelu on ruuhkainen.");
    return jsonError(502, "upstream", "Äänipalvelun virhe.");
  }
}
