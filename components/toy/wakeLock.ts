"use client";

import { useEffect } from "react";
import { debugError, debugSet } from "../demo/voiceLog";

type Sentinel = { released: boolean; release: () => Promise<void>; addEventListener: (t: "release", l: () => void) => void };
type WakeLockApi = { request: (type: "screen") => Promise<Sentinel> };

/**
 * Keeps the screen on while `enabled` (Screen Wake Lock API). A phone that locks its screen
 * suspends the page – then a tap on the toy could no longer wake Lumi. The browser drops the
 * lock whenever the page is hidden, so it is taken again each time the page is visible.
 */
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof navigator === "undefined") return;
    const api = (navigator as Navigator & { wakeLock?: WakeLockApi }).wakeLock;
    if (!api) {
      debugSet({ wakeLock: "ei tuettu – näyttö voi sammua (vaatii Chrome 84+ tai iOS 16.4+)" });
      return;
    }
    let sentinel: Sentinel | null = null;
    let stopped = false;

    const acquire = async () => {
      if (stopped || document.visibilityState !== "visible" || (sentinel && !sentinel.released)) return;
      try {
        sentinel = await api.request("screen");
        if (stopped) return void sentinel.release();
        debugSet({ wakeLock: "päällä – näyttö pysyy päällä" });
        sentinel.addEventListener("release", () => !stopped && debugSet({ wakeLock: "vapautettu (sivu piilossa) – otetaan uudelleen, kun sivu näkyy" }));
      } catch (e) {
        const name = (e as DOMException)?.name ?? "virhe";
        debugSet({ wakeLock: `ei saatu (${name})` });
        debugError("Wake Lock", name);
      }
    };

    const onVisible = () => document.visibilityState === "visible" && void acquire();
    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisible);
      void sentinel?.release().catch(() => {});
      debugSet({ wakeLock: "pois päältä" });
    };
  }, [enabled]);
}
