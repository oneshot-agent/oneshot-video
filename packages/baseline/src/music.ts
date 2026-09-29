/**
 * The bed. `score.mp3` is the file the launch film used (72 s, generated 19 Aug 2026, ours).
 * Its generation prompt was never saved; the measured profile is what we keep.
 */
/** Absolute path on disk. Built without node:url so a browser bundle can import this module. */
export const BED_PATH = decodeURIComponent(
  new URL("../assets/score.mp3", import.meta.url).pathname,
);
export const BED_SHA256 = "f0c10c3ef249eb579c84dc25b8e7b023f2f9ce9141dd3425fb81bd5022d0d255";
export const BED_DURATION_S = 72;

/** Mix levels the launch film used. */
export const MIX = { voiced: 0.4, silent: 0.85 } as const;
/** Trim with a fade for shorter videos; loop for longer ones. */
export const BED_FADE_S = 1.5;

/**
 * The style, as a device rather than a name. Music models refuse named works, and naming
 * the film would be describing the wrong thing anyway. Every new bed is checked by ear
 * against score.mp3 before it ships.
 */
export const MUSIC_STYLE = {
  bpm: 82,
  drone: "A",
  lufs: -14.7,
  shape:
    "swell: quiet start (−31 dB), peaks around the middle and two-thirds points, eases back at the end",
  spectrum:
    "energy at 120–200 Hz, falling steeply above 1 kHz (−30 dB at 800 Hz, −50 dB at 3 kHz); no bright top end",
  balance: "tonal, not drum-led: about 10× more tonal than percussive energy",
  device:
    "overlapping ascending phrases handed between registers, so the tension seems to rise forever and never resolves",
} as const;

export const STYLE_PROMPT =
  "tense cinematic underscore, relentless ticking clock pulse at 82 bpm, overlapping ascending string and synth phrases that seem to rise forever like a Shepard tone illusion, low sustained drone in A, dark, no melody, no resolution, no drum kit, instrumental";

export const BRAND_DIRECTION = "sparse and tense. It underscores, it doesn't drive.";
