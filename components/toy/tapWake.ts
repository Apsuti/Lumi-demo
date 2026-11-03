"use client";

import { useEffect, useRef } from "react";
import { debugEvent, debugSet } from "../demo/voiceLog";

/**
 * Waking Lumi by tapping the toy. A phone browser cannot read the volume buttons, so the
 * accelerometer (devicemotion) is used: a short jolt above the threshold counts as a tap.
 *
 * TAP_THRESHOLD is the size of the jolt in m/s². Lower = more sensitive. Through the fabric
 * of a plush toy a light tap is usually 4–10 m/s²; for testing it can be overridden with
 * ?tap=5 in the address.
 */
export const TAP_THRESHOLD = 7;
/** One tap at most per this many ms (a tap shakes the phone for a moment). */
export const TAP_DEBOUNCE_MS = 1200;
/** Ignore movement right after falling asleep (e.g. putting the toy down). */
export const SLEEP_GRACE_MS = 2500;

export function tapThreshold() {
  if (typeof window === "undefined") return TAP_THRESHOLD;
  const v = Number(new URLSearchParams(window.location.search).get("tap"));
  return v > 0 ? v : TAP_THRESHOLD;
}

type MotionPermission = "granted" | "denied" | "not-needed" | "unsupported";
let motionPermission: MotionPermission | null = null;

/**
 * iOS 13+ asks for permission to read motion; the request must come from a tap.
 * Call this directly inside a touch/click handler. Elsewhere no permission is needed.
 */
export async function requestMotionPermission(): Promise<MotionPermission> {
  if (typeof window === "undefined" || !("DeviceMotionEvent" in window)) return (motionPermission = "unsupported");
  const DME = window.DeviceMotionEvent as unknown as { requestPermission?: () => Promise<"granted" | "denied"> };
  if (typeof DME.requestPermission !== "function") {
    motionPermission = "not-needed";
  } else if (motionPermission !== "granted") {
    try {
      motionPermission = await DME.requestPermission();
    } catch {
      motionPermission = "denied";
    }
  }
  debugSet({ motion: `${{ granted: "sallittu", denied: "estetty", "not-needed": "ei tarvita lupaa", unsupported: "ei anturia" }[motionPermission]}, kynnys ${tapThreshold()} m/s²` });
  return motionPermission;
}

/** Listens for a tap while `enabled` (only in sleep – the microphone is off then). */
export function useTapWake(enabled: boolean, onTap: (strength: number) => void) {
  const onTapRef = useRef(onTap);
  onTapRef.current = onTap;

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || !("DeviceMotionEvent" in window)) return;
    const threshold = tapThreshold();
    const since = performance.now();
    let last = 0;
    let prev: { x: number; y: number; z: number } | null = null;

    const onMotion = (e: DeviceMotionEvent) => {
      let strength: number;
      const a = e.acceleration; // without gravity, when the device provides it
      if (a && a.x !== null) {
        strength = Math.hypot(a.x ?? 0, a.y ?? 0, a.z ?? 0);
      } else {
        // Only gravity-included values: the jolt is the change between two readings.
        const g = e.accelerationIncludingGravity;
        if (!g || g.x === null) return;
        const cur = { x: g.x ?? 0, y: g.y ?? 0, z: g.z ?? 0 };
        strength = prev ? Math.hypot(cur.x - prev.x, cur.y - prev.y, cur.z - prev.z) : 0;
        prev = cur;
      }
      const now = performance.now();
      if (strength < threshold || now - since < SLEEP_GRACE_MS || now - last < TAP_DEBOUNCE_MS) return;
      last = now;
      debugEvent(`Taputus tunnistettu (${strength.toFixed(1)} m/s², kynnys ${threshold})`);
      onTapRef.current(strength);
    };
    window.addEventListener("devicemotion", onMotion);
    return () => window.removeEventListener("devicemotion", onMotion);
  }, [enabled]);
}
