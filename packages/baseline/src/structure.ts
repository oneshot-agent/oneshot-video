import type { SceneKind } from "@oneshot-video/shared-types";

/**
 * The 30-second shape, compressed from the launch film's eight scenes.
 * Argument first, features as evidence, ends on the receipt-equivalent.
 * Text cards only at open and close; everything between is recorded pixels.
 */
export interface Beat {
  id: string;
  kind: SceneKind;
  /** Target seconds; the real window is measured from the stem, never from this. */
  target_s: number;
  role: string;
}

export const SHAPE_30S: readonly Beat[] = [
  {
    id: "wedge",
    kind: "text_card",
    target_s: 5,
    role: "the hook: the one thing this product changes, said to the people who would use it. Pick the angle from the product (a moment, a before and after, a number, a person), not a formula",
  },
  {
    id: "beat-1",
    kind: "capture",
    target_s: 6,
    role: "the product doing the first thing the hook promised",
  },
  {
    id: "beat-2",
    kind: "capture",
    target_s: 6,
    role: "the second thing it does; show, do not list features",
  },
  {
    id: "proof",
    kind: "capture",
    target_s: 6,
    role: "the result: a number, an outcome, something the product gave back",
  },
  {
    id: "close",
    kind: "text_card",
    target_s: 4,
    role: "the product's name and what it is for, in its own terms; the URL is drawn on the card. Holds in silence after the narration ends",
  },
] as const;

/**
 * The film's two holds, from the launch script's directions: the wedge lands its turn "after a
 * full beat of silence", and the close "holds in silence after the narration ends".
 */
export const WEDGE_TURN_HOLD_S = 0.8;
export const CLOSE_HOLD_S = 1.6;
/** Cards carry the argument in few words; the captures carry the runtime. */
export const CARD_WORDS_MAX = 8;
/**
 * A capture beat holds on the UI for at least this long. The film's shortest captured beat runs
 * 5.4 s and its voice never covers the whole window: silence over UI is preferred to filler.
 */
export const CAPTURE_BEAT_MIN_S = 6;
export const ENDTAG_SECONDS = 1.2;
export const ENDTAG_TEXT = "oneshot·video";

/** Share of runtime that must be captured or terminal pixels. The film runs 0.73. */
export const REAL_PIXELS_MIN = 0.6;

export const OPENING_SENTENCE =
  "A launch film for this product: open on what it changes for the people who use it, let the captures prove it, end on its name and its promise. Every film is different because every product is.";
