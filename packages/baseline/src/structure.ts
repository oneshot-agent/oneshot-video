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
    role: "the inversion: what every tool assumes, and what is actually true",
  },
  {
    id: "beat-1",
    kind: "capture",
    target_s: 6,
    role: "the product doing the first thing the argument needs",
  },
  {
    id: "beat-2",
    kind: "capture",
    target_s: 6,
    role: "the second thing; the feature is evidence, not the point",
  },
  {
    id: "proof",
    kind: "capture",
    target_s: 6,
    role: "the receipt-equivalent: a number, a result, something that came back",
  },
  {
    id: "close",
    kind: "text_card",
    target_s: 4,
    role: "URL as a card. Holds in silence after the narration ends.",
  },
] as const;

/**
 * The film's two holds, from the launch script's directions: the wedge lands its turn "after a
 * full beat of silence", and the close "holds in silence after the narration ends".
 */
export const WEDGE_TURN_HOLD_S = 0.8;
export const CLOSE_HOLD_S = 1.6;
/** Cards carry the argument in few words; the captures carry the runtime. */
export const CARD_WORDS_MAX = 10;
export const ENDTAG_SECONDS = 1.2;
export const ENDTAG_TEXT = "oneshot·video";

/** Share of runtime that must be captured or terminal pixels. The film runs 0.73. */
export const REAL_PIXELS_MIN = 0.6;

export const OPENING_SENTENCE =
  "Opens on an inversion, ends on the receipt. Argument first, features as evidence.";
