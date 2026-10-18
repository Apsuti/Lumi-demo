"use client";

/**
 * Debug log for the speech pipeline, visible in the browser console (on Android via
 * chrome://inspect). Every line shows the step and the time since the current turn began.
 *
 *   1. Voice detected  2. Transcript received  3. Transcript finalized
 *   4. Message send started  5. API request sent  6. API response received
 */
let turnStart = typeof performance !== "undefined" ? performance.now() : 0;

export function newTurn() {
  turnStart = performance.now();
}

export function vlog(step: string, ...data: unknown[]) {
  const t = Math.round(performance.now() - turnStart);
  console.info(`%c[Lumi puhe] +${t} ms ${step}`, "color:#7253D6;font-weight:bold", ...data);
}
