# Lumi – tekoälypohjainen oppimiskaveri (demo)

> Tavallinen tekoäly antaa vastauksia. Lumi auttaa löytämään ne itse.

Testiversio Lumista oikeiden lasten kanssa kokeiltavaksi: tekoälykeskustelu, puhe ja puheentunnistus. Ei markkinointisivuja.

## Käynnistys

```bash
npm install
cp .env.example .env.local     # lisää ANTHROPIC_API_KEY
npm run dev                    # http://localhost:3000
```

- `/` – Lumi-sovellus (testiversio lapsille; `/demo` ohjaa samaan)

Ilman avainta sivusto toimii, mutta demo näyttää ohjeen avaimen lisäämisestä.

## Miten tekoäly toimii

Jokainen Lumin vastaus luodaan kielimallilla (oletuksena Anthropic `claude-opus-5-5`). Valmiita dialogipuita ei ole.

```
Selain ──POST /api/lumi { messages }──▶ Next.js-reitti ──stream──▶ Claude
   ▲                                       │
   └──── SSE: meta / delta / done ◀────────┘  (tilarivi erotetaan, teksti striimataan)
```

- **Pedagoginen ohjauskerros** – `lib/lumi/prompt.ts`. Järjestelmäohje pakottaa mallin: ei vastausta heti, kysymykset, porrastetut vihjeet, ongelman pilkkominen, luovuuden ja tiedonhaun tukeminen, suora vastaus vasta useiden yritysten jälkeen. Lisäksi lapsiturvallisuus (henkilötiedot, huolet → turvallinen aikuinen / 116 111).
- **Tilarivi** – malli aloittaa jokaisen vastauksen rivillä `<lumi>{mood, technique, phase, note, celebrate}</lumi>`. Palvelin erottaa sen (`lib/lumi/meta.ts`), ja käyttöliittymä ohjaa sillä Lumin ilmettä, ajattelun polkua, ”Mitä Lumi tekee nyt” -korttia, oivalluslistaa ja juhlahehkua. Lapsi ei näe riviä.
- **Kieltäytymiset** – pyynnöissä on `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`). Jos koko ketju kieltäytyy, Lumi ohjaa lempeästi muuhun aiheeseen.
- **Suojaukset** – viestien pituus- ja määrärajat, IP-kohtainen rajoitin (`LUMI_RATE_LIMIT`), API-avain vain palvelimella.

- **Puhe** – `components/demo/useSpeech.ts` käyttää selaimen SpeechSynthesis API:a (`fi-FI`). Jokaisessa Lumin vastauksessa on kaiutinpainike, ja ”Puhe päällä / pois” -kytkimellä Lumi lukee vastaukset automaattisesti (valinta muistetaan selaimessa). Teksti luetaan lause kerrallaan ilman emojeja. Puheen aikana Lumi-hahmon ympärillä aaltoilee valo ja suu liikkuu. Äänen laatu riippuu laitteen suomenkielisestä puheäänestä.

- **Puhekeskustelu** – `components/demo/useVoiceInput.ts` + `Voice.tsx` käyttävät selaimen SpeechRecognition API:a (`fi-FI`, Chrome/Edge/Safari). Lapsi painaa mikkiä kerran: puhe näkyy reaaliajassa, viesti lähtee itsestään, kun lapsi lopettaa puhumisen (1,5 s hiljaisuus valmiin lauseen jälkeen, 2,6 s kesken lauseen), Lumi vastaa ääneen ja mikki avautuu taas itsestään. Paneeli kertoo aina vuoron: *MIKKI PÄÄLLÄ – Puhu nyt! / Kuulen sinut!*, *Lumi miettii…*, *Lumi puhuu – kuuntele*. Lumin puheen voi keskeyttää (*Puhu heti*). Keskustelutila päättyy, jos lapsi kirjoittaa, painaa ✕ tai on hiljaa n. 9 s. Androidilla käytetään yksittäisiä lausumia, koska jatkuva tila toistaa siellä sanoja.

- **Kuvat** – lapsi voi ottaa kuvan kameralla (puhelimessa avautuu puhelimen kamera, tietokoneella sivun oma webkamera-näkymä), valita kuvan tiedostona, raahata sen keskusteluun tai liittää leikepöydältä. Kuva pienennetään selaimessa (`components/demo/image.ts`, enint. 1568 px, JPEG) ja lähetetään samalle Claude-mallille kuvalohkona. Järjestelmäohjeen kuvaosio ohjaa Lumia tunnistamaan tehtävän, pyytämään uuden kuvan jos teksti ei erotu, ja ohjaamaan pedagogisesti antamatta vastausta. Pyynnössä on enintään kaksi uusinta kuvaa; palvelin tarkistaa tyypin ja koon (`lib/lumi/server.ts`).

Asetukset (`.env.local`): `ANTHROPIC_API_KEY`, `LUMI_MODEL`, `LUMI_EFFORT` (`low` oletus – nopea keskustelu), `LUMI_RATE_LIMIT`.

## Rakenne

| Polku | Sisältö |
| --- | --- |
| `lib/lumi/prompt.ts` | Lumin järjestelmäohje ja vertailuohje |
| `lib/lumi/meta.ts` | Tilarivin tyypit, validointi ja striimattava erottelija |
| `lib/lumi/server.ts` | Anthropic-asiakas, syötteen validointi, rajoitin, virheet |
| `app/api/lumi/route.ts` | Striimaava keskustelureitti (SSE) |
| `components/demo/Demo.tsx` | Keskustelunäkymä, Lumi-hahmo, polku, oivallukset |
| `components/demo/client.ts` | SSE-lukija selaimeen |
| `components/demo/useSpeech.ts` | Ääneen lukeminen (SpeechSynthesis, fi-FI) |
| `components/demo/useVoiceInput.ts`, `Voice.tsx` | Puheentunnistus ja mikin tilanäkymä |
| `components/demo/image.ts`, `ImageAttach.tsx` | Kuvan valmistelu, kamera, tiedosto, raahaus |
| `components/LumiCharacter.tsx` | Lumi-hahmo (SVG + Framer Motion) |

Tekniikka: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS 3, Framer Motion 11, `@anthropic-ai/sdk`.
