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

- **Lumin ääni (ElevenLabs)** – `app/api/tts/route.ts` muuttaa Lumin vastauksen puheeksi ElevenLabsin virallisella SDK:lla (`@elevenlabs/elevenlabs-js`, oletusmalli `eleven_multilingual_v2`) ja striimaa MP3:n; selain toistaa sen `<audio>`-elementillä (`components/demo/useSpeech.ts`). Lumi puhuu **aina samalla äänellä: Petteri** (`uBwJeWtV6tQa8ixtM7ZQ`, `lib/lumi/tts.ts`); äänenvalintaa ei ole käyttöliittymässä. Asetukset on viritetty lämpimäksi ja rauhalliseksi (stability 0,5, style 0,15, nopeus 0,93). Teksti siivotaan ennen puhetta (emojit pois, × → ”kertaa”). Jos ElevenLabs-avainta ei ole tai pyyntö epäonnistuu, Lumi puhuu laitteen omalla äänellä (SpeechSynthesis), joten puhe ei katkea.

- **Puhekeskustelu** – `components/demo/useVoiceSession.ts` + `Voice.tsx` (Web Speech API, `fi-FI`, Chrome/Edge/Safari). Lapsi painaa mikkiä **kerran**, minkä jälkeen keskustelu jatkuu itsestään:
  - jatkuva tunnistus (`continuous`, Androidilla yksittäiset lausumat), joka käynnistetään hiljaa uudelleen aina kun selain lopettaa sen (hiljaisuus, aikaraja, välilehden vaihto); nopeiden uudelleenkäynnistysten silmukka estetään;
  - lausuman loppu tunnistetaan tauosta (1,6 s valmiin lauseen jälkeen, 2,8 s kesken lauseen), ja viesti lähtee Lumille;
  - kun Lumi miettii tai puhuu, tunnistus on **tauolla** (tunnistin pysäytetään kokonaan, jottei Lumi kuule itseään), ja se jatkuu 0,45 s Lumin puheen jälkeen;
  - hiljaisuus ei katkaise keskustelua – lapsi saa miettiä rauhassa. Vasta 3 minuutin täydellisen hiljaisuuden jälkeen keskustelu ”jää lepäämään” (yksityisyys, akku);
  - tietokoneella mikin äänitaso (`getUserMedia` + AnalyserNode) näkyy rauhallisena hengittävänä pisteenä; mobiilissa käytetään tunnistimen omaa puheen alun tunnistusta;
  - tilat: *MIKKI PÄÄLLÄ – Ajattele rauhassa / Olen täällä, kun haluat jatkaa / Voit vastata milloin tahansa*, *Kuulen sinut* (sanat reaaliajassa), *Lumi miettii / Lumi puhuu – kuuntelu on tauolla*. Keskustelun voi lopettaa mikkipainikkeesta tai ”Lopeta puhekeskustelu”.

- **Kuvat** – lapsi voi ottaa kuvan kameralla (puhelimessa avautuu puhelimen kamera, tietokoneella sivun oma webkamera-näkymä), valita kuvan tiedostona, raahata sen keskusteluun tai liittää leikepöydältä. Kuva pienennetään selaimessa (`components/demo/image.ts`, enint. 1568 px, JPEG) ja lähetetään samalle Claude-mallille kuvalohkona. Järjestelmäohjeen kuvaosio ohjaa Lumia tunnistamaan tehtävän, pyytämään uuden kuvan jos teksti ei erotu, ja ohjaamaan pedagogisesti antamatta vastausta. Pyynnössä on enintään kaksi uusinta kuvaa; palvelin tarkistaa tyypin ja koon (`lib/lumi/server.ts`).

Asetukset (`.env.local`): `ANTHROPIC_API_KEY`, `LUMI_MODEL`, `LUMI_EFFORT` (`low` oletus – nopea keskustelu), `LUMI_RATE_LIMIT`, `ELEVENLABS_API_KEY`, `ELEVENLABS_MODEL`, `ELEVENLABS_SPEED`, `ELEVENLABS_BASE_URL` (ks. `.env.example`).

## Rakenne

| Polku | Sisältö |
| --- | --- |
| `lib/lumi/prompt.ts` | Lumin järjestelmäohje ja vertailuohje |
| `lib/lumi/meta.ts` | Tilarivin tyypit, validointi ja striimattava erottelija |
| `lib/lumi/server.ts` | Anthropic-asiakas, syötteen validointi, rajoitin, virheet |
| `app/api/lumi/route.ts` | Striimaava keskustelureitti (SSE) |
| `components/demo/Demo.tsx` | Keskustelunäkymä, Lumi-hahmo, polku, oivallukset |
| `components/demo/client.ts` | SSE-lukija selaimeen |
| `components/demo/useSpeech.ts`, `app/api/tts/route.ts`, `lib/lumi/tts.ts` | Lumin ääni: ElevenLabs + laitteen ääni varalla |
| `components/demo/useVoiceSession.ts`, `Voice.tsx` | Jatkuva puhekeskustelu ja sen tilanäkymä |
| `components/demo/image.ts`, `ImageAttach.tsx` | Kuvan valmistelu, kamera, tiedosto, raahaus |
| `components/LumiCharacter.tsx` | Lumi-hahmo (SVG + Framer Motion) |

Tekniikka: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS 3, Framer Motion 11, `@anthropic-ai/sdk`.
