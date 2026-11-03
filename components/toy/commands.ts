/**
 * Spoken commands that are handled on the device and never sent to Claude:
 * "heippa" puts Lumi to sleep, "räps" takes a photo. Case and punctuation are ignored,
 * and the word can be part of a longer phrase ("Heippa Lumi!").
 */
export type VoiceCommand = "sleep" | "photo" | null;

export function words(text: string) {
  return text
    .toLowerCase()
    .normalize("NFC")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

export function detectCommand(text: string): VoiceCommand {
  const w = words(text);
  if (w.includes("heippa")) return "sleep";
  if (w.includes("räps")) return "photo";
  return null;
}

/** What the child said around "räps" ("räps, katso tätä tehtävää") is sent along with the photo. */
export function withoutCommand(text: string) {
  return text
    .replace(/räps[!.,]*/giu, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s,.!?]+/, "")
    .trim();
}
