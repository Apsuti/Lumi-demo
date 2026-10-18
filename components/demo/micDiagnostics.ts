"use client";

/**
 * Microphone diagnostics, mainly for phones and tablets: tells the adult *exactly*
 * why speech does not work and how to fix it on this particular device.
 */

export type IssueCode =
  | "insecure" // page not served over HTTPS
  | "in_app_browser" // opened inside Instagram, Facebook, WhatsApp, …
  | "unsupported_browser" // no Web Speech API (e.g. Firefox)
  | "no_media_devices" // browser has no microphone API at all
  | "permission_denied" // the user (or earlier choice) denied microphone access
  | "blocked_by_browser" // permission OK but the browser/OS blocks speech recognition
  | "dictation_off" // iPhone/iPad: Siri & Dictation disabled
  | "no_microphone" // no microphone found
  | "mic_in_use" // another app (call, recorder, video) holds the microphone
  | "start_timeout" // recognition was asked to start but never did
  | "network" // the browser's speech service cannot be reached
  | "language" // Finnish recognition not available
  | "unknown";

export type MicIssue = {
  code: IssueCode;
  title: string;
  detail: string;
  steps: string[];
  /** Raw error name, shown small for whoever helps debug. */
  technical?: string;
};

export type Platform = {
  os: "ios" | "android" | "other";
  browser: "safari" | "chrome" | "firefox" | "samsung" | "edge" | "inapp" | "other";
  label: string;
};

export function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const android = /android/i.test(ua);
  const os = ios ? "ios" : android ? "android" : "other";
  let browser: Platform["browser"] = "other";
  if (/FBAN|FBAV|Instagram|Line\/|WhatsApp|Snapchat|TikTok|MicroMessenger|; wv\)/i.test(ua)) browser = "inapp";
  else if (/SamsungBrowser/i.test(ua)) browser = "samsung";
  else if (/Edg(e|A|iOS)?\//i.test(ua)) browser = "edge";
  else if (/Firefox|FxiOS/i.test(ua)) browser = "firefox";
  else if (/Chrome|CriOS/i.test(ua)) browser = "chrome";
  else if (/Safari/i.test(ua)) browser = "safari";
  const names = { safari: "Safari", chrome: "Chrome", firefox: "Firefox", samsung: "Samsung Internet", edge: "Edge", inapp: "sovelluksen sisäinen selain", other: "tuntematon selain" };
  const osName = { ios: "iPhone/iPad", android: "Android", other: "tietokone" }[os];
  return { os, browser, label: `${names[browser]} · ${osName}` };
}

function hasMediaDevices() {
  return typeof navigator.mediaDevices?.getUserMedia === "function";
}

function hasRecognition() {
  const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
  return Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition);
}

/** Where to allow the microphone on this device. */
function allowMicSteps(p: Platform): string[] {
  if (p.os === "ios") {
    return p.browser === "chrome"
      ? ["Avaa iPhonen Asetukset → Chrome.", "Laita Mikrofoni päälle.", "Palaa tähän ja paina mikkiä uudelleen."]
      : [
          "Napauta osoiterivin vasemmasta reunasta ”aA” (tai ⋯) → Verkkosivuston asetukset.",
          "Valitse Mikrofoni → Salli.",
          "Jos sitä ei löydy: Asetukset → Safari → Mikrofoni → Salli.",
          "Päivitä sivu ja paina mikkiä uudelleen.",
        ];
  }
  if (p.os === "android") {
    return p.browser === "samsung"
      ? ["Napauta osoiterivin lukkokuvaketta → Käyttöoikeudet.", "Salli Mikrofoni.", "Päivitä sivu ja paina mikkiä uudelleen."]
      : [
          "Napauta osoiterivin vasemmalla puolella olevaa kuvaketta (lukko tai säätimet).",
          "Valitse Käyttöoikeudet → Mikrofoni → Salli.",
          "Jos valinta puuttuu: puhelimen Asetukset → Sovellukset → Chrome → Käyttöoikeudet → Mikrofoni → Salli.",
          "Päivitä sivu ja paina mikkiä uudelleen.",
        ];
  }
  return ["Napsauta osoiterivin lukkokuvaketta.", "Salli Mikrofoni tälle sivulle.", "Päivitä sivu ja paina mikkiä uudelleen."];
}

const BEST_BROWSER = (p: Platform) => (p.os === "ios" ? "Safarilla" : "Chromella");

export function makeIssue(code: IssueCode, p: Platform, technical?: string): MicIssue {
  const issues: Record<IssueCode, Omit<MicIssue, "code" | "technical">> = {
    insecure: {
      title: "Sivu ei ole suojatussa yhteydessä",
      detail: "Selaimet antavat mikrofonin käyttöön vain https-osoitteessa.",
      steps: ["Avaa Lumi osoitteella, joka alkaa https://."],
    },
    in_app_browser: {
      title: "Sivu on auki sovelluksen sisäisessä selaimessa",
      detail: "Esimerkiksi Instagramin, Facebookin tai WhatsAppin sisäinen selain ei salli puheentunnistusta.",
      steps: [`Avaa valikko (⋯ tai ⋮) ja valitse ”Avaa selaimessa”.`, `Käytä ${BEST_BROWSER(p)} ja paina mikkiä uudelleen.`],
    },
    unsupported_browser: {
      title: "Tämä selain ei tue puheentunnistusta",
      detail:
        p.browser === "firefox"
          ? "Firefox ei sisällä puheentunnistusta (Web Speech API)."
          : `${p.label} ei tarjoa puheentunnistusta (Web Speech API).`,
      steps: [`Avaa Lumi ${BEST_BROWSER(p)}.`, "Voit myös kirjoittaa viestit – Lumi vastaa silti ääneen."],
    },
    no_media_devices: {
      title: "Selain ei pääse mikrofoniin",
      detail: "Tämä selain ei tarjoa mikrofonia verkkosivuille.",
      steps: [`Päivitä selain uusimpaan versioon tai avaa Lumi ${BEST_BROWSER(p)}.`],
    },
    permission_denied: {
      title: "Mikrofonilupaa ei ole annettu",
      detail: "Selain on estänyt mikrofonin tältä sivulta. Usein syy on aiemmin valittu ”Estä” tai ”Älä salli”.",
      steps: allowMicSteps(p),
    },
    blocked_by_browser: {
      title: "Selain estää puheentunnistuksen",
      detail: "Mikrofoni on sallittu, mutta selain tai laite ei anna käyttää puheentunnistusta.",
      steps:
        p.os === "ios"
          ? ["Tarkista Asetukset → Näyttöaika → Sisältö- ja tietosuojarajoitukset → Puheentunnistus: Salli.", "Päivitä sivu ja kokeile uudelleen."]
          : [
              "Tarkista, ettei selaimen tietosuojatila tai laajennus estä puheentunnistusta (esim. Brave-suojaukset).",
              `Kokeile ${BEST_BROWSER(p)} tavallisessa (ei yksityisessä) ikkunassa.`,
            ],
    },
    dictation_off: {
      title: "Sanelu on poissa päältä",
      detail: "iPhonessa ja iPadissa verkkosivujen puheentunnistus vaatii, että Sanelu on käytössä.",
      steps: ["Avaa Asetukset → Yleiset → Näppäimistö.", "Laita Ota sanelu käyttöön päälle.", "Palaa tähän, päivitä sivu ja paina mikkiä uudelleen."],
    },
    no_microphone: {
      title: "Mikrofonia ei löytynyt",
      detail: "Laitteesta ei löytynyt toimivaa mikrofonia.",
      steps: ["Tarkista, että kuulokkeiden tai ulkoisen mikrofonin johto on kunnolla kiinni.", "Kokeile ilman kuulokkeita."],
    },
    mic_in_use: {
      title: "Mikrofoni on toisen sovelluksen käytössä",
      detail: "Esimerkiksi puhelu, videopuhelu, sanelin tai toinen selainvälilehti käyttää mikrofonia juuri nyt.",
      steps: ["Lopeta puhelu tai sulje mikrofonia käyttävä sovellus.", "Sulje muut välilehdet, joissa mikrofoni on käytössä.", "Paina mikkiä uudelleen."],
    },
    start_timeout: {
      title: "Puheentunnistus ei käynnistynyt",
      detail: "Selain hyväksyi pyynnön, mutta kuuntelu ei alkanut.",
      steps: ["Päivitä sivu.", "Sulje muut sovellukset, jotka voivat käyttää mikrofonia.", `Jos ongelma jatkuu, avaa Lumi ${BEST_BROWSER(p)}.`],
    },
    network: {
      title: "Puheentunnistuspalveluun ei saada yhteyttä",
      detail: "Selaimen puheentunnistus tarvitsee nettiyhteyden, eikä palvelu vastaa.",
      steps: ["Tarkista nettiyhteys (Wi-Fi tai mobiilidata).", "Paina mikkiä uudelleen."],
    },
    language: {
      title: "Suomen kielen tunnistus ei ole saatavilla",
      detail: "Tämä selain ei osaa tunnistaa suomea.",
      steps: [`Avaa Lumi ${BEST_BROWSER(p)}.`],
    },
    unknown: {
      title: "Puheentunnistus ei toiminut",
      detail: "Selain ilmoitti tuntemattomasta virheestä.",
      steps: ["Päivitä sivu ja kokeile uudelleen.", `Jos ongelma jatkuu, avaa Lumi ${BEST_BROWSER(p)}.`],
    },
  };
  return { code, technical, ...issues[code] };
}

/** Checks that need no permission prompt – run before the mic is opened. */
export function preflight(p = detectPlatform()): MicIssue | null {
  if (!window.isSecureContext) return makeIssue("insecure", p);
  if (!hasRecognition()) return makeIssue(p.browser === "inapp" ? "in_app_browser" : "unsupported_browser", p);
  if (!hasMediaDevices()) return makeIssue("no_media_devices", p);
  return null;
}

export async function permissionState(): Promise<PermissionState | "unknown"> {
  try {
    const s = await navigator.permissions.query({ name: "microphone" as PermissionName });
    return s.state;
  } catch {
    return "unknown"; // older Safari/Firefox
  }
}

/** Opens and immediately closes the microphone to learn the real reason it is unavailable. */
export async function probeMicrophone(p = detectPlatform()): Promise<MicIssue | null> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return null;
  } catch (e) {
    const name = (e as DOMException)?.name ?? "Error";
    if (name === "NotAllowedError" || name === "PermissionDeniedError") return makeIssue("permission_denied", p, name);
    if (name === "SecurityError") return makeIssue("blocked_by_browser", p, name);
    if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError") return makeIssue("no_microphone", p, name);
    if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError") return makeIssue("mic_in_use", p, name);
    return makeIssue("unknown", p, name);
  }
}

/**
 * Turns a SpeechRecognition error into an exact cause. "not-allowed" is ambiguous
 * (denied permission vs. a browser/OS block), so it is disambiguated with the
 * permission state and a real microphone probe.
 */
export async function diagnoseRecognitionError(error: string): Promise<MicIssue> {
  const p = detectPlatform();
  const tech = `SpeechRecognition: ${error}`;
  if (error === "audio-capture") return (await probeMicrophone(p)) ?? { ...makeIssue("mic_in_use", p), technical: tech };
  if (error === "network") return makeIssue("network", p, tech);
  if (error === "language-not-supported") return makeIssue("language", p, tech);
  if (error === "not-allowed" || error === "service-not-allowed") {
    if ((await permissionState()) === "denied") return makeIssue("permission_denied", p, tech);
    const mic = await probeMicrophone(p);
    if (mic) return { ...mic, technical: `${tech} · getUserMedia: ${mic.technical}` };
    // The microphone itself works, so speech recognition is what is blocked.
    if (p.os === "ios") return makeIssue("dictation_off", p, tech);
    return makeIssue("blocked_by_browser", p, tech);
  }
  return makeIssue("unknown", p, tech);
}

export type Check = { label: string; ok: boolean | null; value: string };

/** Full checklist for the "Tarkista mikrofoni" view. */
export async function runChecks(): Promise<Check[]> {
  const p = detectPlatform();
  const perm = await permissionState();
  const checks: Check[] = [
    { label: "Selain", ok: p.browser !== "inapp" && p.browser !== "firefox" ? true : false, value: p.label },
    { label: "Suojattu yhteys (https)", ok: window.isSecureContext, value: window.isSecureContext ? "Kyllä" : "Ei" },
    { label: "Puheentunnistus (Web Speech API)", ok: hasRecognition(), value: hasRecognition() ? "Tuettu" : "Ei tuettu" },
    { label: "Mikrofonirajapinta", ok: hasMediaDevices(), value: hasMediaDevices() ? "Saatavilla" : "Puuttuu" },
    {
      label: "Mikrofonilupa",
      ok: perm === "granted" ? true : perm === "denied" ? false : null,
      value: { granted: "Sallittu", denied: "Estetty", prompt: "Ei vielä kysytty", unknown: "Selain ei kerro" }[perm],
    },
  ];
  if (hasMediaDevices() && perm !== "denied") {
    const mic = await probeMicrophone(p);
    checks.push({ label: "Mikrofonin testi", ok: !mic, value: mic ? `${mic.title} (${mic.technical})` : "Mikrofoni toimii" });
  }
  return checks;
}
