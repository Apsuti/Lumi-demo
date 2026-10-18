import { ElevenLabsError } from "@elevenlabs/elevenlabs-js";
import { jsonError, rateLimited } from "@/lib/lumi/server";
import { DEFAULT_VOICE_ID, TTS_MODEL, VOICE_SETTINGS, VoiceListError, getTts, hasTts, languageCodeFor, listVoices } from "@/lib/lumi/tts";
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
    // `reason` tells the tester exactly why the natural voice is or is not available.
    const debug = url.searchParams.has("debug");
    if (!hasTts()) return Response.json({ configured: false, reason: "missing_key", defaultVoiceId: null, voices: [] });
    try {
      const listing = await listVoices(debug);
      return Response.json({
        configured: true,
        reason: "ok",
        source: listing.source,
        defaultVoiceId: DEFAULT_VOICE_ID,
        model: TTS_MODEL,
        voices: listing.voices.length ? listing.voices : PRESET_VOICES,
        ...(debug && { debug: { source: listing.source, pages: listing.pages, count: listing.raw.length, voices: listing.raw } }),
      });
    } catch (err) {
      const status = err instanceof VoiceListError ? err.status : undefined;
      const body = err instanceof VoiceListError ? err.body : undefined;
      console.warn("[lumi/tts] voice list failed:", status, JSON.stringify(body ?? String(err)));
      // A scoped key may lack the "voices read" permission (401/403 "missing_permissions");
      // speech still works with the preset voices then.
      const missingPermission = /permission/i.test(JSON.stringify(body ?? ""));
      if (status === 401 && !missingPermission) {
        return Response.json({ configured: false, reason: "invalid_key", defaultVoiceId: null, voices: [] });
      }
      return Response.json({
        configured: true,
        reason: missingPermission || status === 403 ? "no_voice_permission" : "voices_unavailable",
        source: "presets",
        defaultVoiceId: DEFAULT_VOICE_ID,
        model: TTS_MODEL,
        voices: PRESET_VOICES,
        ...(debug && { debug: { source: "presets", error: { status: status ?? null, body: body ?? String(err) }, count: 0, voices: [] } }),
      });
    }
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
