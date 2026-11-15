/**
 * Spoken commands that are handled on the device and never sent to Claude:
 * "heippa" puts Lumi to sleep. Case and punctuation are ignored, and the word can be
 * part of a longer phrase ("Heippa Lumi!").
 */
export type VoiceCommand = "sleep" | null;

export function words(text: string) {
  return text
    .toLowerCase()
    .normalize("NFC")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

export function detectCommand(text: string): VoiceCommand {
  return words(text).includes("heippa") ? "sleep" : null;
}
