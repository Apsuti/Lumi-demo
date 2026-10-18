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

- **Puheentunnistus** – `components/demo/useVoiceInput.ts` + `Voice.tsx` käyttävät selaimen SpeechRecognition API:a (`fi-FI`, Chrome/Edge/Safari). Mikin tila näkyy aina: *Mikki avautuu* → punainen *MIKKI PÄÄLLÄ – Puhu nyt!* → *Kuulen sinut!* (sanat näkyvät reaaliajassa, äänitasopalkit liikkuvat) → *Kuulin sinut! Tarkista teksti ja paina lähetä.* Mikki sammuu 2,2 s hiljaisuuden jälkeen, Valmis-painikkeesta tai viimeistään 30 s kohdalla. Lumin oma puhe pysäytetään aina ennen kuuntelua. Virheille (esim. estetty mikrofoni, ei kuulunut mitään) on selkeät ohjeet.

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
| `components/LumiCharacter.tsx` | Lumi-hahmo (SVG + Framer Motion) |

Tekniikka: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS 3, Framer Motion 11, `@anthropic-ai/sdk`.
