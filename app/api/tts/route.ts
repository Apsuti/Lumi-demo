import { ElevenLabsError } from "@elevenlabs/elevenlabs-js";
import { jsonError, rateLimited } from "@/lib/lumi/server";
import { LUMI_VOICE_ID, TTS_MODEL, VOICE_SETTINGS, getTts, hasTts, languageCodeFor } from "@/lib/lumi/tts";
import { MAX_TTS_CHARS, cleanForSpeech } from "@/lib/lumi/voice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/tts?text=…  → audio/mpeg in Lumi's voice (Petteri), streamed so playback
 * starts early. A plain GET lets an <audio> element stream it natively and lets the
 * browser cache replays of the same sentence.
 *
 * GET /api/tts?status=1  → { configured } – whether the natural voice is available.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.has("status")) return Response.json({ configured: hasTts() });

  if (!hasTts()) return jsonError(503, "not_configured", "ElevenLabs-avain puuttuu.");
  if (rateLimited(req)) return jsonError(429, "rate_limited", "Pidetään pieni tauko.");

  const text = cleanForSpeech(url.searchParams.get("text") ?? "").slice(0, MAX_TTS_CHARS);
  if (!text) return jsonError(400, "bad_request", "Tyhjä teksti.");

  try {
    const audio = await getTts().textToSpeech.stream(
      LUMI_VOICE_ID,
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
    console.warn("[lumi/tts] speech failed:", status, err instanceof ElevenLabsError ? JSON.stringify(err.body) : err);
    if (status === 401) return jsonError(503, "not_configured", "ElevenLabs-avain ei kelpaa.");
    if (status === 429) return jsonError(429, "rate_limited", "Äänipalvelu on ruuhkainen.");
    return jsonError(502, "upstream", "Äänipalvelun virhe.");
  }
}
