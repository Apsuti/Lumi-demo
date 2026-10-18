"use client";

import { motion, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import {
  BrainCircuit,
  Check,
  Compass,
  HeartHandshake,
  Home,
  Lightbulb,
  Minus,
  MessageCircleQuestion,
  Puzzle,
  Rocket,
  Smile,
  Sparkles,
  UserRound,
  Zap,
} from "lucide-react";
import LumiCharacter from "../LumiCharacter";
import { Reveal, SectionHead } from "./ui";

/* ───────────── Ongelma ───────────── */

const PROBLEMS = [
  {
    icon: Puzzle,
    title: "Oppimisen haasteet",
    text: "Yhä useampi lapsi tarvitsee yksilöllistä tukea, mutta tukea on tarjolla liian vähän ja liian myöhään.",
  },
  {
    icon: Home,
    title: "Läksyristiriidat kotona",
    text: "Kotitehtävät aiheuttavat stressiä. Väsynyt vanhempi ja turhautunut lapsi – tuttu ilta monessa perheessä.",
  },
  {
    icon: UserRound,
    title: "Yksilöllisen tuen puute",
    text: "Luokassa on monta oppijaa ja yksi opettaja. Jokainen lapsi oppii omaan tahtiinsa ja omalla tavallaan.",
  },
  {
    icon: Zap,
    title: "Tekoälyn väärinkäyttö oppimisessa",
    text: "Nykyiset tekoälyt antavat vastauksen sekunnissa. Tehtävä tulee tehdyksi, mutta oma ajattelu jää väliin.",
  },
];

export function Problem() {
  return (
    <section id="ongelma" className="relative py-24 sm:py-32">
      <div className="container-lumi">
        <SectionHead
          eyebrow="Mitä ongelmaa ratkaisemme"
          title={
            <>
              Lapsi oppii parhaiten,
              <br className="hidden sm:block" /> kun hän oivaltaa itse.
            </>
          }
          lead="Silti lähes kaikki tekoälytyökalut on suunniteltu antamaan valmiita vastauksia mahdollisimman nopeasti."
        />
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PROBLEMS.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.08}>
              <div className="card group h-full p-6 transition-all duration-500 hover:-translate-y-1 hover:shadow-lift">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-sky-50 to-lilac-100 text-lilac-600 transition-transform duration-500 group-hover:scale-110">
                  <p.icon className="h-6 w-6" strokeWidth={1.8} />
                </span>
                <h3 className="mt-5 font-display text-lg font-extrabold leading-snug">{p.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{p.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────── Miten Lumi auttaa ───────────── */

const HELPS = [
  { icon: MessageCircleQuestion, title: "Ei anna vastauksia valmiina", text: "Lumi kysyy, vihjaa ja pilkkoo ongelman pieniksi askeliksi." },
  { icon: Compass, title: "Ohjaa ajattelemaan", text: "Lapsi tekee itse jokaisen oivalluksen – Lumi näyttää vain suunnan." },
  { icon: Smile, title: "Rakentaa itseluottamusta", text: "Jokainen polku päättyy tunteeseen: ”Minä pystyn tähän itse.”" },
  { icon: Sparkles, title: "Lisää oppimisen iloa", text: "Uteliaisuus, kokeilu ja onnistuminen – ilman kiirettä tai paineita." },
  { icon: Rocket, title: "Kehittää tulevaisuuden taitoja", text: "Ongelmanratkaisua, luovuutta, lähdekriittisyyttä ja vastuullista tekoälyn käyttöä." },
];

const METHOD = ["Kysyy", "Vihjaa", "Pilkkoo", "Rohkaisee", "Pohtii"];

export function Helps() {
  return (
    <section id="ratkaisu" className="relative overflow-hidden bg-gradient-to-b from-white via-sky-50/60 to-white py-24 sm:py-32">
      <div className="container-lumi grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
        <div className="lg:sticky lg:top-32 lg:self-start">
          <SectionHead
            center={false}
            eyebrow="Miten Lumi auttaa"
            title="Lumi kulkee rinnalla. Lapsi tekee matkan itse."
            lead="Lumi perustuu suomalaisen pedagogiikan ajatukseen: oppija on aktiivinen toimija, joka rakentaa omaa ymmärrystään."
          />
          <Reveal delay={0.15} className="mt-10">
            <div className="card p-5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-ink-mute">Lumin tapa ohjata</div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {METHOD.map((m, i) => (
                  <motion.span
                    key={m}
                    className="inline-flex items-center gap-2"
                    initial={{ opacity: 0, x: -8 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + i * 0.12 }}
                  >
                    <span className="rounded-full bg-gradient-to-br from-sky-50 to-lilac-100 px-3.5 py-1.5 text-sm font-bold text-ink">{m}</span>
                    {i < METHOD.length - 1 && <span className="text-lilac-300">→</span>}
                  </motion.span>
                ))}
              </div>
              <p className="mt-4 text-sm leading-relaxed text-ink-soft">
                Vastaus ei ole koskaan Lumin ensimmäinen siirto. Se on lapsen oma oivallus.
              </p>
            </div>
          </Reveal>
        </div>

        <div className="space-y-3">
          {HELPS.map((h, i) => (
            <Reveal key={h.title} delay={i * 0.06}>
              <div className="card group flex items-start gap-5 p-5 transition-all duration-500 hover:shadow-lift sm:p-6">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-sky-500 to-lilac-500 text-white shadow-lift transition-transform duration-500 group-hover:rotate-[-6deg] group-hover:scale-105">
                  <h.icon className="h-6 w-6" strokeWidth={1.8} />
                </span>
                <div>
                  <h3 className="font-display text-lg font-extrabold">{h.title}</h3>
                  <p className="mt-1 text-[15px] leading-relaxed text-ink-soft">{h.text}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────── Vertailu ───────────── */

const TRADITIONAL = ["Antaa vastauksen", "Tekee ajattelun puolestasi", "Ratkaisee tehtävän nopeasti"];
const LUMI = ["Kysyy kysymyksiä", "Ohjaa ajattelua", "Kehittää ymmärrystä", "Rakentaa itseluottamusta", "Tukee itsenäistä oppimista"];

export function Comparison() {
  return (
    <section id="erilainen" className="relative py-24 sm:py-32">
      <div className="container-lumi">
        <SectionHead
          eyebrow="Mikä tekee Lumista erityisen"
          title="Sama kysymys. Täysin erilainen oppiminen."
          lead="Tavallinen tekoäly optimoi nopeutta. Lumi optimoi lapsen ajattelua."
        />

        <div className="mx-auto mt-14 grid max-w-5xl items-stretch gap-5 md:grid-cols-[0.85fr_1.15fr]">
          <Reveal className="h-full">
            <div className="flex h-full flex-col rounded-4xl border border-ink/[0.06] bg-ink/[0.02] p-7 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-ink/[0.06] text-ink-mute">
                  <Zap className="h-5 w-5" />
                </span>
                <h3 className="font-display text-xl font-extrabold text-ink-soft">Perinteinen tekoäly</h3>
              </div>
              <ul className="mt-7 space-y-3.5">
                {TRADITIONAL.map((t) => (
                  <li key={t} className="flex items-center gap-3 text-[15px] font-medium text-ink-mute">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink/[0.06]">
                      <Minus className="h-3.5 w-3.5" />
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-8">
                <div className="rounded-2xl bg-white px-4 py-3 text-sm text-ink-mute ring-1 ring-ink/[0.05]">
                  <span className="font-semibold">Lapsi:</span> En osaa laskea 36 ÷ 4
                  <br />
                  <span className="font-semibold">Tekoäly:</span> Vastaus on 9.
                </div>
                <p className="mt-3 text-xs font-semibold text-ink-mute">Tulos: tehtävä tehty, mitään ei opittu.</p>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.12} className="h-full">
            <div className="relative h-full rounded-4xl bg-gradient-to-br from-sky-400 via-[#7B8BF5] to-lilac-500 p-[1.5px] shadow-glow">
              <div className="relative flex h-full flex-col overflow-hidden rounded-[calc(2rem-1.5px)] bg-white p-7 sm:p-8">
                <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-lilac-100 blur-2xl" />
                <div className="relative flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <LumiCharacter size={48} float={false} mood="happy" />
                    <h3 className="font-display text-xl font-extrabold">Lumi</h3>
                  </div>
                  <span className="rounded-full bg-mint-100 px-3 py-1 text-xs font-extrabold text-mint-600">Oppimiskaveri</span>
                </div>
                <ul className="relative mt-7 grid gap-3.5 sm:grid-cols-2">
                  {LUMI.map((t, i) => (
                    <motion.li
                      key={t}
                      className="flex items-center gap-3 text-[15px] font-semibold text-ink"
                      initial={{ opacity: 0, x: -6 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.25 + i * 0.08 }}
                    >
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gradient-to-br from-sky-500 to-lilac-500 text-white">
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      </span>
                      {t}
                    </motion.li>
                  ))}
                </ul>
                <div className="relative mt-auto pt-8">
                  <div className="space-y-1.5 rounded-2xl bg-gradient-to-br from-sky-50 to-lilac-50 px-4 py-3 text-sm text-ink-soft">
                    <div>
                      <span className="font-semibold text-ink">Lapsi:</span> En osaa laskea 36 ÷ 4
                    </div>
                    <div>
                      <span className="font-semibold text-lilac-600">Lumi:</span> Mietitään yhdessä. Tuleeko mieleesi kertolasku, jonka tulos on 36?
                    </div>
                    <div>
                      <span className="font-semibold text-ink">Lapsi:</span> 9 × 4! Eli vastaus on 9!
                    </div>
                  </div>
                  <p className="mt-3 text-xs font-bold text-lilac-600">Tulos: lapsi oivalsi itse – ja muistaa sen huomennakin.</p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ───────────── Lumi-hahmo ───────────── */

const MOODS = [
  { mood: "greet" as const, label: "Tervehtii", text: "Ottaa vastaan lämmöllä." },
  { mood: "curious" as const, label: "On utelias", text: "Kallistaa päätään ja kysyy." },
  { mood: "think" as const, label: "Miettii", text: "Antaa aikaa ajatella." },
  { mood: "celebrate" as const, label: "Iloitsee", text: "Juhlistaa lapsen oivallusta." },
];

const SAYS = [
  "Hieno kysymys.",
  "Mitä itse ajattelet?",
  "Kokeillaan yhdessä.",
  "Miten voisimme selvittää sen?",
  "Voisiko tähän olla useampi ratkaisu?",
  "Sinulla taitaa olla jo hyvä ajatus alkamassa.",
];

const TRAITS = ["Ystävällinen", "Utelias", "Turvallinen", "Rauhallinen", "Kannustava", "Kärsivällinen"];

export function Character() {
  return (
    <section id="hahmo" className="relative overflow-hidden bg-gradient-to-b from-white via-lilac-50/50 to-white py-24 sm:py-32">
      <div className="container-lumi">
        <SectionHead
          eyebrow="Tutustu Lumiin"
          title="Pieni valo-olento, joka uskoo sinuun."
          lead="Lumi ei ole robotti, ihminen eikä eläin. Se on oma, ainutlaatuinen oppimiskaverinsa – lempeästi hehkuva, utelias ja aina kärsivällinen."
        />

        <div className="mt-14 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {MOODS.map((m, i) => (
            <Reveal key={m.label} delay={i * 0.08}>
              <MoodTile {...m} />
            </Reveal>
          ))}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Reveal>
            <div className="card h-full p-6 sm:p-8">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-lilac-600">
                <HeartHandshake className="h-4 w-4" /> Lumin ääni
              </div>
              <div className="mt-5 flex flex-wrap gap-2.5">
                {SAYS.map((s, i) => (
                  <motion.span
                    key={s}
                    className="rounded-2xl rounded-bl-md bg-gradient-to-br from-sky-50 to-lilac-50 px-4 py-2.5 text-[15px] font-semibold text-ink ring-1 ring-lilac-100"
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 + i * 0.08 }}
                  >
                    ”{s}”
                  </motion.span>
                ))}
              </div>
              <div className="mt-6 flex items-center gap-3 rounded-2xl border border-dashed border-ink/10 px-4 py-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-mute">Lumi ei sano</span>
                <span className="text-[15px] font-semibold text-ink-mute line-through decoration-ink/30">”Tässä vastaus.”</span>
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="card h-full p-6 sm:p-8">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-lilac-600">
                <BrainCircuit className="h-4 w-4" /> Persoona
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2">
                {TRAITS.map((t) => (
                  <span key={t} className="rounded-xl bg-white px-3 py-2.5 text-sm font-bold text-ink ring-1 ring-ink/[0.06]">
                    {t}
                  </span>
                ))}
              </div>
              <p className="mt-5 text-sm leading-relaxed text-ink-soft">
                Lumi ei koskaan tenttaa eikä arvostele. Se on kaveri, joka istuu vieressä ja sanoo: <span className="font-semibold text-ink">”Kokeillaan yhdessä.”</span>
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function MoodTile({ mood, label, text }: { mood: "greet" | "curious" | "think" | "celebrate"; label: string; text: string }) {
  return (
    <div className="card group relative flex h-full flex-col items-center overflow-hidden px-4 pb-6 pt-8 text-center">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-2/3 bg-gradient-to-b from-sky-50 to-transparent" />
      <LiveMood mood={mood} />
      <div className="relative mt-5 font-display text-base font-extrabold">{label}</div>
      <div className="relative mt-1 text-sm text-ink-soft">{text}</div>
    </div>
  );
}

/** Replays greet / celebrate loops so the tiles feel alive. */
function LiveMood({ mood }: { mood: "greet" | "curious" | "think" | "celebrate" }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.5 });
  const [m, setM] = useState<typeof mood | "idle" | "happy">(mood === "celebrate" || mood === "greet" ? "idle" : mood);
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    if (!inView || (mood !== "celebrate" && mood !== "greet")) return;
    const fire = () => {
      setM(mood);
      setBurst((b) => b + 1);
      setTimeout(() => setM(mood === "celebrate" ? "happy" : "idle"), 2200);
    };
    const first = setTimeout(fire, 400);
    const loop = setInterval(fire, 5200);
    return () => {
      clearTimeout(first);
      clearInterval(loop);
    };
  }, [inView, mood]);

  return (
    <div ref={ref} className="relative">
      <LumiCharacter size={104} mood={m} burstKey={burst} />
    </div>
  );
}

/* ───────────── Kumppaneille ───────────── */

const BENEFITS = [
  { icon: Compass, title: "Tukee itsenäistä oppimista", text: "Lapsi oppii ratkaisemaan – ei vain saamaan ratkaisuja." },
  { icon: BrainCircuit, title: "Kehittää kriittistä ajattelua", text: "Hypoteesit, lähteiden vertailu ja tiedon tarkistaminen." },
  { icon: Lightbulb, title: "Vahvistaa luovuutta", text: "Lumi ei tuota sisältöä lapsen puolesta. Ideat ovat aina lapsen omia." },
  { icon: Sparkles, title: "Lisää oppimismotivaatiota", text: "Onnistumisen kokemukset rakentavat sisäistä motivaatiota." },
  { icon: HeartHandshake, title: "Opettaa vastuullista tekoälyn käyttöä", text: "Lapsi oppii, että tekoäly on ajattelun tuki, ei sen korvike." },
];

const ROADMAP = [
  { k: "Nyt", t: "Verkkodemo", d: "Käyttökokemus ja pedagoginen malli" },
  { k: "Seuraavaksi", t: "Pilotit", d: "Kodit, koulut ja iltapäiväkerhot" },
  { k: "Tulevaisuus", t: "Fyysinen Lumi", d: "Oma oppimiskaveri lapsen pöydälle" },
];

const PRINCIPLES = ["Ei mainoksia", "Ei sosiaalisen median elementtejä", "Ei valmiita vastauksia", "Vanhempi näkee edistymisen"];

export function Partners() {
  return (
    <section id="kumppaneille" className="relative px-3 py-10 sm:px-5 sm:py-16">
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2.5rem] bg-ink px-5 py-20 text-white sm:rounded-[3rem] sm:px-10 sm:py-28">
        <div className="pointer-events-none absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-sky-500/30 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-40 -right-20 h-[500px] w-[500px] rounded-full bg-lilac-500/30 blur-[120px]" />
        <div className="container-lumi relative !px-0">
          <div className="grid items-center gap-10 lg:grid-cols-[1.3fr_0.7fr]">
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-lilac-200">
                Sijoittajille ja kumppaneille
              </span>
              <h2 className="mt-6 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
                Lumi rakentaa uudenlaista suhdetta{" "}
                <span className="bg-gradient-to-r from-sky-300 to-lilac-300 bg-clip-text text-transparent">tekoälyyn.</span>
              </h2>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/70">
                Kokonainen sukupolvi kasvaa tekoälyn kanssa. Lumi varmistaa, että siitä tulee ajattelun vahvistaja – ei sen korvike.
              </p>
            </Reveal>
            <Reveal delay={0.1} className="flex justify-center">
              <LumiCharacter size={220} mood="happy" />
            </Reveal>
          </div>

          <div className="mt-16 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {BENEFITS.map((b, i) => (
              <Reveal key={b.title} delay={i * 0.06}>
                <div className="h-full rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur transition hover:bg-white/[0.07]">
                  <b.icon className="h-6 w-6 text-lilac-300" strokeWidth={1.8} />
                  <h3 className="mt-4 font-display text-base font-extrabold leading-snug">{b.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/60">{b.text}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <div className="mt-14 grid gap-6 lg:grid-cols-2">
            <Reveal>
              <div className="h-full rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                <div className="text-[11px] font-bold uppercase tracking-wider text-lilac-200">Tiekartta</div>
                <ol className="mt-5 space-y-4">
                  {ROADMAP.map((r, i) => (
                    <li key={r.t} className="flex items-start gap-4">
                      <span
                        className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-extrabold ${
                          i === 0 ? "bg-gradient-to-br from-sky-400 to-lilac-400 text-white" : "border border-white/20 text-white/60"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-white/50">{r.k}</div>
                        <div className="font-display text-lg font-extrabold">{r.t}</div>
                        <div className="text-sm text-white/60">{r.d}</div>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="flex h-full flex-col rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                <div className="text-[11px] font-bold uppercase tracking-wider text-lilac-200">Suunnitteluperiaatteet</div>
                <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
                  {PRINCIPLES.map((p) => (
                    <li key={p} className="flex items-center gap-2.5 rounded-2xl bg-white/[0.05] px-4 py-3 text-sm font-semibold">
                      <Check className="h-4 w-4 shrink-0 text-mint-400" strokeWidth={3} /> {p}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto flex flex-col gap-3 pt-8 sm:flex-row">
                  <a href="#demo" className="btn-primary">
                    Kokeile demoa
                  </a>
                  <a href="#erilainen" className="inline-flex items-center justify-center rounded-full border border-white/20 px-6 py-3.5 text-[15px] font-bold text-white transition hover:bg-white/10">
                    Katso vertailu
                  </a>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="py-12">
      <div className="container-lumi flex flex-col items-center justify-between gap-4 text-sm text-ink-mute sm:flex-row">
        <div className="flex items-center gap-2">
          <LumiCharacter size={28} float={false} />
          <span className="font-display text-base font-extrabold text-ink">Lumi</span>
          <span className="ml-2">Tekoälypohjainen oppimiskaveri</span>
        </div>
        <div>Konseptidemo © 2026 · Suunniteltu suomalaisen pedagogiikan hengessä</div>
      </div>
    </footer>
  );
}
