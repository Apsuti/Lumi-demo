"use client";

import { useEffect } from "react";

/** Registers the service worker that makes Lumi installable (production only). */
export default function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((e) => console.warn("[Lumi] service worker:", e));
  }, []);
  return null;
}
