/** From brands/oneshot.md. The voiceLint gate fails on any of these in narration. */
export const BANNED_WORDS = [
  "maybe",
  "perhaps",
  "possibly",
  "innovative",
  "revolutionary",
  "excited",
  "thrilled",
  "game-changing",
  "game changing",
  "synergy",
  "ecosystem",
  "leverage",
  "pivotal",
  "crucial",
  "delve",
  "landscape",
  "exciting times ahead",
  "seamless",
  "seamlessly",
  "empower",
  "unlock",
] as const;

/** The lift at the CTA the launch film refused. */
export const CTA_LIFT_PHRASES = [
  "get started today",
  "sign up now",
  "check it out",
  "try it now",
  "don't miss",
  "join us",
  "start your free",
  "learn more",
  "what are you waiting for",
] as const;

/** Verbs the brand uses. Not enforced; here so the script prompt can quote them. */
export const PREFERRED_VERBS = [
  "is",
  "are",
  "does",
  "will",
  "never",
  "always",
  "must",
  "breaks",
  "survives",
  "builds",
  "ships",
  "pays",
  "transacts",
] as const;

/**
 * ~12 words a sentence. Above the target is a note; above the max is a failure.
 * The max is the film's own longest sentence — the close, s8, runs 19 words.
 */
export const SENTENCE_WORDS_TARGET = 12;
export const SENTENCE_WORDS_MAX = 19;

export const TONE =
  "Terse, dry, confident. Taleb-aphoristic — ~12 words a sentence, inversions over adjectives, amused rather than earnest. No hype vocabulary.";
