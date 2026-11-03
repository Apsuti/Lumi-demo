"use client";

import { appleWebKit } from "../demo/micDiagnostics";
import { debugError, debugEvent } from "../demo/voiceLog";

/**
 * The microphone stream Lumi opens itself (getUserMedia), separate from the speech
 * recogniser's own capture. Opened first so the permission is settled before recognition
 * starts. On iPhone it is kept open while Lumi is awake: iOS Safari lets a page play audio
 * without a tap while it is using the microphone. Elsewhere it is closed at once, because
 * Android's speech recogniser needs the microphone for itself.
 */
let held: MediaStream | null = null;

export type MicResult = { ok: true } | { ok: false; error: string };

export async function openMic(): Promise<MicResult> {
  if (!navigator.mediaDevices?.getUserMedia) return { ok: false, error: "getUserMedia puuttuu" };
  try {
    if (!held || held.getAudioTracks().every((t) => t.readyState === "ended")) {
      held = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    }
    if (!appleWebKit()) releaseMic();
    else debugEvent("Mikki auki (pidetään päällä, jotta iOS sallii Lumin äänen)");
    return { ok: true };
  } catch (e) {
    const error = (e as DOMException)?.name ?? "virhe";
    debugError("Mikki", `getUserMedia: ${error}`);
    return { ok: false, error };
  }
}

/** Stops every track of the stream Lumi holds, so the microphone is really off. */
export function releaseMic() {
  if (!held) return;
  held.getTracks().forEach((t) => t.stop());
  held = null;
  debugEvent("Mikin raidat pysäytetty");
}

export const micHeld = () => held !== null;
