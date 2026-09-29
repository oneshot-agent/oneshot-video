import type { TtsRequest } from "@oneshot-video/shared-types";

/** ElevenLabs settings, read from the history of the launch film's stems. */
export const VOICE_ID = "EXAVITQu4vr4xnSDxMaL"; // Sarah — "Mature, Reassuring, Confident"
export const VOICE_NAME = "Sarah";
export const MODEL_ID = "eleven_v3";
export const STABILITY = 0.5;
export const STYLE_EXAGGERATION = 0;
export const OUTPUT_FORMAT = "mp3_44100_128";

/** The request every narrate call must send. The flatEnergy gate compares against this. */
export const TTS_REQUEST: TtsRequest = {
  voice_id: VOICE_ID,
  model_id: MODEL_ID,
  stability: STABILITY,
  style: STYLE_EXAGGERATION,
  output_format: OUTPUT_FORMAT,
};

/** Narration sits at about this integrated loudness before mixing. */
export const NARRATION_LUFS = -18.4;

/**
 * Measured from the launch film: 111 words over 57.19 s, including its silences.
 * eleven_v3 reads ~27% longer than multilingual_v2 on the same text; budget for that.
 */
export const WORDS_PER_SECOND_MAX = 1.95;
export const V3_LENGTH_FACTOR = 1.27;
/** The share of runtime the film gives to silence. A word budget is length × pace × (1 − this). */
export const SILENCE_SHARE = 0.2;

/**
 * The film's own cues go as low as 0.3 s; the stated policy says 0.4 for full stops. The artifact
 * wins. The last section is exempt: the close holds in silence by construction (the hold is the
 * scene, not a cue), and the film cues it at 0.
 */
export const PAUSE_AFTER_MIN = 0.3;
export const PAUSE_BEFORE_FULL_STOP = 0.4;

/** Copied from the launch script's voice_performance block. */
export const PERFORMANCE_INTENT =
  "A developer stating facts to other developers. Dry, unhurried, faintly amused. Never sells, never explains twice. The read should sound written rather than generated, and it should sound like it would still be true if nobody watched.";
export const ENERGY_CURVE =
  "Flat and low throughout. No lift at the CTA. The only variation is the pause length before the lines that carry the argument.";
export const PAUSE_POLICY =
  "Full stops get real silence, 0.4s minimum. Never speak over a beat where the viewer is reading UI text or terminal output. Silence is allowed and preferred over filler.";
export const PROVIDER_NOTE =
  "Stability high, style exaggeration near zero. Any warmth or upward inflection at line ends is wrong for this brand. Reject takes that sound like an explainer voice.";
export const PACING_PROFILE = "technical";

export const wordBudget = (lengthSeconds: number): number =>
  Math.floor(lengthSeconds * WORDS_PER_SECOND_MAX * (1 - SILENCE_SHARE));
