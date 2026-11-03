import type { MetadataRoute } from "next";

/**
 * Installable web app (Android: "Lisää aloitusnäytölle" / "Asenna sovellus"). The NFC tag's
 * address /?nfc=1 is inside `scope`, so an installed Lumi opens it in its own window, and
 * an installed app may play sound without a tap. The icon opens straight into toy mode too.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Lumi – oppimiskaveri",
    short_name: "Lumi",
    description: "Lumi auttaa lapsia löytämään vastaukset itse.",
    lang: "fi",
    start_url: "/?nfc=1",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F4F7FF",
    theme_color: "#F4F7FF",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
