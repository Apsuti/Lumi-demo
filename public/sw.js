/*
 * Lumi's service worker. It exists so that the app can be installed; it stores nothing.
 * Only page loads pass through it (with a short offline message). API calls, speech audio
 * and photos go straight to the network and are never cached.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || req.mode !== "navigate") return;
  event.respondWith(
    fetch(req).catch(
      () =>
        new Response(
          '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lumi</title>' +
            '<body style="font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0;background:#F4F7FF;color:#23264F;text-align:center">' +
            "<div><h1>Lumi tarvitsee nettiyhteyden</h1><p>Tarkista Wi-Fi tai mobiilidata ja yritä uudelleen.</p></div>",
          { headers: { "Content-Type": "text/html; charset=utf-8" } },
        ),
    ),
  );
});
