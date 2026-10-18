/**
 * Turns numbers, maths and units into spoken Finnish before speech synthesis, so Lumi
 * reads "36 ÷ 4" as "kolmekymmentäkuusi jaettuna neljällä" – the way a teacher would
 * say it aloud – instead of leaving the voice to guess. Used by both the browser and the
 * server; the visible chat text is not changed.
 */

type Case = "nom" | "gen" | "part" | "ade" | "ine" | "ela" | "all" | "abl" | "ill" | "tra";

// nominative, inflection stem, partitive, illative, back vowels (a) or front vowels (ä)
const WORDS: Record<number, [string, string, string, string, boolean]> = {
  0: ["nolla", "nolla", "nollaa", "nollaan", true],
  1: ["yksi", "yhde", "yhtä", "yhteen", false],
  2: ["kaksi", "kahde", "kahta", "kahteen", true],
  3: ["kolme", "kolme", "kolmea", "kolmeen", true],
  4: ["neljä", "neljä", "neljää", "neljään", false],
  5: ["viisi", "viide", "viittä", "viiteen", false],
  6: ["kuusi", "kuude", "kuutta", "kuuteen", true],
  7: ["seitsemän", "seitsemä", "seitsemää", "seitsemään", false],
  8: ["kahdeksan", "kahdeksa", "kahdeksaa", "kahdeksaan", true],
  9: ["yhdeksän", "yhdeksä", "yhdeksää", "yhdeksään", false],
  10: ["kymmenen", "kymmene", "kymmentä", "kymmeneen", false],
  100: ["sata", "sada", "sataa", "sataan", true],
  1000: ["tuhat", "tuhanne", "tuhatta", "tuhanteen", true],
  1e6: ["miljoona", "miljoona", "miljoonaa", "miljoonaan", true],
};

const ENDINGS: Partial<Record<Case, [string, string]>> = {
  gen: ["n", "n"],
  tra: ["ksi", "ksi"],
  ade: ["lla", "llä"],
  ine: ["ssa", "ssä"],
  ela: ["sta", "stä"],
  all: ["lle", "lle"],
  abl: ["lta", "ltä"],
};

function word(n: number, c: Case) {
  const [nom, stem, part, ill, back] = WORDS[n];
  if (c === "nom") return nom;
  if (c === "part") return part;
  if (c === "ill") return ill;
  return stem + ENDINGS[c]![back ? 0 : 1];
}

/** 2 → "kaksikymmentä"/"kahdellakymmenellä": in the nominative the multiplier takes the partitive. */
function times(n: number, base: number, c: Case) {
  return word(n, c) + (c === "nom" ? WORDS[base][2] : word(base, c));
}

function below1000(n: number, c: Case) {
  let out = "";
  const h = Math.floor(n / 100);
  if (h === 1) out += word(100, c);
  else if (h > 1) out += times(h, 100, c);
  const r = n % 100;
  if (r === 10) out += word(10, c);
  else if (r > 10 && r < 20) out += word(r - 10, c) + "toista";
  else {
    if (r >= 20) out += times(Math.floor(r / 10), 10, c);
    if (r % 10) out += word(r % 10, c);
  }
  return out;
}

/** An integer as Finnish words in the given case; thousands and millions separated by a space. */
export function cardinal(n: number, c: Case = "nom"): string {
  if (n === 0) return word(0, c);
  if (n >= 1e9) return String(n).split("").map((d) => word(Number(d), "nom")).join(" ");
  const groups: string[] = [];
  const m = Math.floor(n / 1e6);
  const t = Math.floor(n / 1000) % 1000;
  const rest = n % 1000;
  if (m === 1) groups.push(word(1e6, c));
  else if (m > 1) groups.push(below1000(m, c) + (c === "nom" ? WORDS[1e6][2] : word(1e6, c)));
  if (t === 1) groups.push(word(1000, c));
  else if (t > 1) groups.push(below1000(t, c) + (c === "nom" ? WORDS[1000][2] : word(1000, c)));
  if (rest) groups.push(below1000(rest, c));
  return groups.join(" ");
}

/** A number as written ("1 000", "3,5", "0.25") → words. Only the last part is inflected. */
export function numberWords(token: string, c: Case = "nom"): string {
  const t = token.replace(/[\s  ]/g, "");
  const [whole, frac] = t.split(/[,.]/);
  if (frac === undefined) return cardinal(Number(whole), c);
  const zeros = frac.match(/^0*/)![0].length;
  const tail = frac.slice(zeros);
  const fracWords = [
    ...Array<string>(zeros).fill(tail ? "nolla" : ""),
    tail.length > 2 ? tail.split("").map((d, i, a) => word(Number(d), i === a.length - 1 ? c : "nom")).join(" ") : tail ? cardinal(Number(tail), c) : word(0, c),
  ].filter(Boolean);
  return `${cardinal(Number(whole))} pilkku ${fracWords.join(" ")}`;
}

const isOne = (token: string) => /^1$/.test(token.replace(/\s/g, ""));

// Fractions: ordinal stem + "osa" (kahdesosa, kolmasosa, kahdestoistaosa, sadasosa).
const ORD = ["", "yhdes", "kahdes", "kolmas", "neljäs", "viides", "kuudes", "seitsemäs", "kahdeksas", "yhdeksäs"];
function ordinalStem(n: number): string | null {
  if (n >= 2 && n <= 9) return ORD[n];
  if (n === 10) return "kymmenes";
  if (n > 10 && n < 20) return ORD[n - 10] + "toista";
  if (n >= 20 && n < 100) return ORD[Math.floor(n / 10)] + "kymmenes" + (n % 10 ? ORD[n % 10] : "");
  if (n === 100) return "sadas";
  if (n === 1000) return "tuhannes";
  return null;
}

export function fractionWords(num: string, den: string): string {
  const stem = ordinalStem(Number(den));
  if (!stem) return `${numberWords(num)} jaettuna ${numberWords(den, "ade")}`;
  return `${numberWords(num)} ${stem}${isOne(num) ? "osa" : "osaa"}`;
}

// Units after a number: [singular after 1, partitive after other numbers].
const UNITS: [string, string, string][] = [
  ["km/h", "kilometri tunnissa", "kilometriä tunnissa"],
  ["m/s", "metri sekunnissa", "metriä sekunnissa"],
  ["km²", "neliökilometri", "neliökilometriä"],
  ["cm²", "neliösenttimetri", "neliösenttimetriä"],
  ["m²", "neliömetri", "neliömetriä"],
  ["cm³", "kuutiosenttimetri", "kuutiosenttimetriä"],
  ["m³", "kuutiometri", "kuutiometriä"],
  ["km", "kilometri", "kilometriä"],
  ["cm", "senttimetri", "senttimetriä"],
  ["mm", "millimetri", "millimetriä"],
  ["dm", "desimetri", "desimetriä"],
  ["m", "metri", "metriä"],
  ["kg", "kilogramma", "kilogrammaa"],
  ["mg", "milligramma", "milligrammaa"],
  ["g", "gramma", "grammaa"],
  ["ml", "millilitra", "millilitraa"],
  ["cl", "senttilitra", "senttilitraa"],
  ["dl", "desilitra", "desilitraa"],
  ["l", "litra", "litraa"],
  ["min", "minuutti", "minuuttia"],
  ["h", "tunti", "tuntia"],
  ["s", "sekunti", "sekuntia"],
  ["°C", "aste", "astetta"],
  ["°", "aste", "astetta"],
  ["%", "prosentti", "prosenttia"],
  ["kpl", "kappale", "kappaletta"],
  ["snt", "sentti", "senttiä"],
  ["€", "euro", "euroa"],
  ["$", "dollari", "dollaria"],
  ["£", "punta", "puntaa"],
];
const UNIT = new Map(UNITS.map(([u, one, many]) => [u, { one, many }]));
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
const UNIT_RE = UNITS.map(([u]) => esc(u)).join("|");

// A written number: "1 000 000", "36", "3,5", "0.25".
const NUM = String.raw`\d{1,3}(?:[   ]\d{3})+(?![\d,.]\d)|\d+(?:[,.]\d+)?`;
// After a number, a unit must not continue as a word ("5 m" yes, "5 metsää" no).
const UNIT_END = String.raw`(?![\p{L}\d²³])`;

const CASE_SUFFIX: [RegExp, Case][] = [
  [/^ll[aä]$/, "ade"],
  [/^lle$/, "all"],
  [/^lt[aä]$/, "abl"],
  [/^ss[aä]$/, "ine"],
  [/^st[aä]$/, "ela"],
  [/^ksi$/, "tra"],
  [/^n$/, "gen"],
  [/^\p{L}*n$/u, "ill"],
  [/^\p{L}{1,3}$/u, "part"],
];
function caseOf(suffix: string): Case {
  return CASE_SUFFIX.find(([re]) => re.test(suffix))?.[1] ?? "nom";
}

function money(token: string, unit: { one: string; many: string }) {
  const [whole, cents] = token.replace(/\s/g, "").split(/[,.]/);
  if (cents === undefined || cents.length !== 2 || (unit.one !== "euro" && unit.one !== "dollari")) {
    return `${numberWords(token)} ${isOne(token) ? unit.one : unit.many}`;
  }
  const c = Number(cents);
  const main = Number(whole) ? `${cardinal(Number(whole))} ${Number(whole) === 1 ? unit.one : unit.many}` : "";
  const small = c ? `${cardinal(c)} ${c === 1 ? "sentti" : "senttiä"}` : "";
  return [main, small].filter(Boolean).join(" ") || `nolla ${unit.many}`;
}

export function speakMath(input: string): string {
  let s = input.replace(/[  ]/g, " ");
  if (!/[\d+=<>×÷−≤≥≠≈√²³%€$£·∙⋅]/.test(s)) return s;

  // Clock times: "klo 8.30" → "kello kahdeksan kolmekymmentä".
  s = s.replace(/\b(klo|kello) (\d{1,2})[.:](\d{2})\b/g, (_, _k, h, m) =>
    `kello ${cardinal(Number(h))}${Number(m) ? ` ${cardinal(Number(m))}` : ""}`,
  );

  // Inflected numbers: "7:llä" → "seitsemällä", "3:n" → "kolmen".
  s = s.replace(new RegExp(`(${NUM}):(\\p{L}+)`, "gu"), (_, n, suf) => numberWords(n, caseOf(suf)));

  // Normalise operators so the rules below see one symbol per meaning.
  s = s
    .replace(/(\d)\s*[xX*·∙⋅]\s*(?=\d)/g, "$1 × ")
    .replace(/(?<=[\d)²³]|\b[a-zA-Z])\s+[-–]\s+(?=[\d(√]|[a-zA-Z]\b)/g, " − ") // spaced minus
    .replace(/(^|[\s(=+×÷])-(?=\d)/g, "$1−") // negative number
    .replace(/(\d)\s+[:/]\s+(?=\d)/g, "$1 ÷ ");

  // Currency written first: "€5" → "5 €".
  s = s.replace(new RegExp(`([€$£])\\s?(${NUM})`, "g"), "$2 $1");

  // Fractions: "2 1/2" → "kaksi ja yksi kahdesosa", "3/4 l" → "kolme neljäsosaa litraa".
  const fracUnit = (u?: string) => (u ? ` ${UNIT.get(u)!.many}` : "");
  s = s.replace(
    new RegExp(`(?<![\\d,./])(\\d+) (\\d+)/(\\d+)(?![\\d/])(?:\\s?(${UNIT_RE})${UNIT_END})?`, "gu"),
    (_, w, a, b, u) => `${cardinal(Number(w))} ja ${fractionWords(a, b)}${fracUnit(u)}`,
  );
  s = s.replace(
    new RegExp(`(?<![\\d,./])(\\d+)/(\\d+)(?![\\d/])(?:\\s?(${UNIT_RE})${UNIT_END})?`, "gu"),
    (_, a, b, u) => `${fractionWords(a, b)}${fracUnit(u)}`,
  );

  // Division takes the adessive: "÷ 4" → "jaettuna neljällä".
  s = s.replace(new RegExp(`÷\\s*(−?)(${NUM})(?!\\s?(?:${UNIT_RE})${UNIT_END})`, "gu"), (_, neg, n) =>
    ` jaettuna ${neg ? "miinus " : ""}${numberWords(n, "ade")}`,
  );

  // Ranges written without spaces: "3–5" → "kolmesta viiteen".
  s = s.replace(/(?<![\d,.])(\d+)[-–](\d+)(?![\d,.]*\d)/g, (_, a, b) => `${cardinal(Number(a), "ela")} ${cardinal(Number(b), "ill")}`);

  // Number + unit/percent/currency: "10 km" → "kymmenen kilometriä", "1 %" → "yksi prosentti".
  s = s.replace(new RegExp(`(${NUM})\\s?(${UNIT_RE})${UNIT_END}`, "gu"), (_, n, u) => {
    const unit = UNIT.get(u)!;
    if (u === "€" || u === "$" || u === "£") return money(n, unit);
    return `${numberWords(n)} ${isOne(n) ? unit.one : unit.many}`;
  });

  // Number glued to a word: "8-vuotias" → "kahdeksanvuotias".
  s = s.replace(/(?<![\d,.])(\d+)-(?=\p{L})/gu, (_, n) => cardinal(Number(n)));

  // Powers and roots.
  s = s
    .replace(/\^2\b|²/g, " toiseen")
    .replace(/\^3\b|³/g, " kolmanteen")
    .replace(/\^(\d+)/g, (_, n) => ` potenssiin ${cardinal(Number(n))}`)
    .replace(/√\s*/g, "neliöjuuri ");

  // Operators and comparisons.
  s = s
    .replace(/\s*≤\s*/g, " on pienempi tai yhtä suuri kuin ")
    .replace(/\s*≥\s*/g, " on suurempi tai yhtä suuri kuin ")
    .replace(/\s*≠\s*/g, " ei ole yhtä suuri kuin ")
    .replace(/\s*≈\s*/g, " on noin ")
    .replace(/\s*<\s*/g, " on pienempi kuin ")
    .replace(/\s*>\s*/g, " on suurempi kuin ")
    .replace(/\s*=\s*/g, " on yhtä suuri kuin ")
    .replace(/\s*\+\s*/g, " plus ")
    .replace(/\s*−\s*/g, " miinus ")
    .replace(/\s*×\s*/g, " kertaa ")
    .replace(/\s*÷\s*/g, " jaettuna ");

  // A blank to fill in: "3 + ? = 7", "□ + 4 = 9", "= ?".
  s = s
    .replace(/\b(plus|miinus|kertaa|jaettuna|kuin)\s*(?:\?|□|_+)(?=\s*$|\s)/g, (_, op) => `${op} mikä luku?`)
    .replace(/(?:□|_{2,})\s*(?=plus|miinus|kertaa|jaettuna|on\b)/g, "mikä luku ")
    .replace(/(^|\s)\?\s*(?=plus|miinus|kertaa|jaettuna|on\b)/g, "$1mikä luku ");

  // Any remaining number, and lone symbols.
  s = s.replace(new RegExp(NUM, "g"), (n) => numberWords(n));
  s = s
    .replace(/\s*%/g, " prosenttia")
    .replace(/\s*€/g, " euroa")
    .replace(/\s*°C?/g, " astetta");

  return s
    .replace(/\s+([,.!?:;])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/(^|[.!?]\s)(\p{Ll})/gu, (_, before, letter) => before + letter.toUpperCase()); // "5 omenaa." starts a sentence
}
