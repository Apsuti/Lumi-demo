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
- **Tilarivi** – malli päättää jokaisen vastauksen rivillä `<lumi>{mood, technique, phase, note, celebrate}</lumi>`. Palvelin erottaa sen (`lib/lumi/meta.ts`), ja käyttöliittymä ohjaa sillä Lumin ilmettä, ”Mitä Lumi tekee nyt” -korttia, oivalluslistaa ja juhlahehkua. Lapsi ei näe riviä.
- **Kieltäytymiset** – pyynnöissä on `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`). Jos koko ketju kieltäytyy, Lumi ohjaa lempeästi muuhun aiheeseen.
- **Suojaukset** – viestien pituus- ja määrärajat, IP-kohtainen rajoitin (`LUMI_RATE_LIMIT`), API-avain vain palvelimella.

- **Mikrofonin diagnostiikka** – `components/demo/micDiagnostics.ts`. Ennen kuuntelua tarkistetaan (ilman lupakyselyä) https, Web Speech API -tuki ja sovellusten sisäiset selaimet. Virhetilanteessa syy selvitetään tarkasti mikrofoniluvan tilasta (`navigator.permissions`) ja mikrofonitestistä (`getUserMedia`), ja käyttäjälle näytetään syy, selitys ja laitekohtaiset korjausohjeet (iPhone/Safari, iPhone/Chrome, Android/Chrome, Samsung Internet, tietokone): lupa estetty, selain estää puheentunnistuksen, iPhonen Sanelu pois päältä, mikrofoni toisen sovelluksen käytössä, mikrofonia ei löydy, tunnistus ei käynnisty (7 s), ei yhteyttä puhepalveluun (3 peräkkäistä verkkovirhettä), suomea ei tueta, selain ei tue puheentunnistusta. ”Tarkista mikrofoni” näyttää koko tarkistuslistan. Mikkipainike näkyy aina, jotta tukemattomassakin selaimessa painallus kertoo syyn.
- **Lumin ääni (ElevenLabs)** – Lumi puhuu **aina Petteri-äänellä** (`uBwJeWtV6tQa8ixtM7ZQ`, `lib/lumi/tts.ts`), oletusmallina nopein `eleven_flash_v2_5` (suomi, `language_code: fi`). Asetukset on viritetty rauhalliseksi ja tasatahtiseksi (stability 0,65 – tasainen rytmi ilman monotonisuutta; similarity 0,75; style exaggeration 0 – ei venytettyjä loppuja; nopeus 1,1 – luonnollinen keskustelutahti, ei kiireinen; säädettävissä `ELEVENLABS_SPEED`-muuttujalla välillä 0,7–1,2). Jos ElevenLabs-avainta ei ole tai pyyntö epäonnistuu, Lumi puhuu laitteen omalla äänellä, joten puhe ei katkea.
- **Nopea puheputki** – Lumi alkaa puhua jo ennen kuin vastaus on kirjoitettu loppuun:
  1. *Puheentunnistus*: lausuma lähetetään 0,7 s valmiin lauseen jälkeen (1,5 s kesken lauseen); ”Lumi miettii…” näkyy heti.
  2. *Claude*: vastaus striimataan; Lumin tilarivi kirjoitetaan **vastauksen loppuun**, jotta ensimmäiset sanat tulevat heti (jäsennin hyväksyy sen missä kohtaa tahansa).
  3. *ElevenLabs*: ensimmäinen lause lähtee puheeksi heti (`useSpeech.beginStream`). Loppuvastaus lähetetään **yhtenä pyyntönä** (aiempi teksti `previous_text`-kontekstina), koska jokainen erillinen pyyntö puhutaan kokonaisena lausumana, joka hidastuu ja laskee loppua kohti – vähemmän saumoja = tasainen tempo alusta loppuun. Loppuosa lähtee, kun vastaus valmistuu, tai aiemmin, jos toisto muuten joutuisi odottamaan tai teksti on pitkä (> 300 merkkiä). ”…” muutetaan pisteeksi, jottei ääni jää venyttämään.
  4. *Toisto*: ensimmäinen lause soi suoraan striimistä, loppuosa haetaan puskuriin ja soi saumattomasti perään.
  Selaimen konsoliin tulostuu `[Lumi viive]`-rivit (ensimmäinen teksti ja puheen alku millisekunteina).

- **Puhekeskustelu** – `components/demo/useVoiceSession.ts` + `Voice.tsx` (Web Speech API, `fi-FI`, Chrome/Edge/Safari). Lapsi painaa mikkiä **kerran**, minkä jälkeen keskustelu jatkuu itsestään:
  - jatkuva tunnistus (`continuous`, Androidilla yksittäiset lausumat), joka käynnistetään hiljaa uudelleen aina kun selain lopettaa sen (hiljaisuus, aikaraja, välilehden vaihto); nopeiden uudelleenkäynnistysten silmukka estetään;
  - lausuman loppu tunnistetaan tauosta (0,7 s valmiin lauseen jälkeen, 1,5 s kesken lauseen), ja viesti lähtee Lumille;
  - **Android-yhteensopivuus**: Android Chrome lopettaa tunnistuksen (`onend`) heti lopullisen tuloksen jälkeen, eikä `isFinal` aina tule lainkaan. Viesti lähetetään siksi ensimmäisestä näistä: `isFinal` + tauko, `speechend`/`audioend` (0,6 s), `onend`, tai 1,5 s hiljaisuus pelkkien välitulosten jälkeen. Sama lausuma lähtee vain kerran;
  - **debug-loki**: selaimen konsoliin tulostuvat rivit `[Lumi puhe] +ms` – 1. Voice detected, 2. Transcript received, 3. Transcript finalized (syy), 4. Message send started/skipped, 5. API request sent, 6. API response received. Puhelimella loki näkyy kytkemällä puhelin USB:llä tietokoneeseen ja avaamalla Chromessa `chrome://inspect`;
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
| `components/demo/Demo.tsx` | Keskustelunäkymä, Lumi-hahmo, oivallukset |
| `components/demo/client.ts` | SSE-lukija selaimeen |
| `components/demo/useSpeech.ts`, `app/api/tts/route.ts`, `lib/lumi/tts.ts` | Lumin ääni: ElevenLabs + laitteen ääni varalla |
| `components/demo/useVoiceSession.ts`, `Voice.tsx` | Jatkuva puhekeskustelu ja sen tilanäkymä |
| `components/demo/micDiagnostics.ts` | Mikrofonin ja puheentunnistuksen diagnostiikka |
| `components/demo/image.ts`, `ImageAttach.tsx` | Kuvan valmistelu, kamera, tiedosto, raahaus |
| `components/LumiCharacter.tsx` | Lumi-hahmo (SVG + Framer Motion) |

Tekniikka: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS 3, Framer Motion 11, `@anthropic-ai/sdk`.
