/**
 * The product's own tokens, converted from oneshot-gtm apps/web/src/design/tokens.css.
 * oklch in the app; the hex below is the exact sRGB equivalent, so the film and the
 * dashboard are literally the same palette rather than a lookalike. Warm deep black
 * (hue 60), cream, and two functional accents: amber for money out, green for anything
 * that came back.
 */
export const INK = "#120F0C"; // --ink-bg
export const INK_DEEP = "#0A0705"; // --ink-bg-deep
export const SURFACE = "#1C1714"; // --ink-surface
export const CREAM = "#F5F1EA"; // --ink-cream
export const CREAM_2 = "#DFDAD2"; // --ink-cream-2
export const MUTED = "#8D847D"; // --ink-muted
export const FAINT = "#645C55"; // --ink-faint
export const RULE = "#2E241F"; // --ink-rule
export const SPEND = "#E8A63D"; // --ink-spend — money out
export const SPEND_2 = "#F4C26A";
export const RECEIPT = "#47B777"; // --ink-receipt — replied, delivered, won
export const RECEIPT_2 = "#73CE95";
export const BLOCKED = "#C35045"; // --ink-blocked — refused
export const ACCENT = SPEND;

/** Fontsource family names first, the film's self-hosted names as fallbacks. */
export const MONO = "'IBM Plex Mono', PlexMono, ui-monospace, SFMono-Regular, Menlo, monospace";
export const SANS =
  "'Host Grotesk Variable', HostGrotesk, ui-sans-serif, system-ui, -apple-system, sans-serif";

export const WIDTH = 1920;
export const HEIGHT = 1080;
export const FPS = 30;
export const CODEC = { video: "h264", audio: "aac" } as const;

export const TOKENS = {
  INK,
  INK_DEEP,
  SURFACE,
  CREAM,
  CREAM_2,
  MUTED,
  FAINT,
  RULE,
  SPEND,
  SPEND_2,
  RECEIPT,
  RECEIPT_2,
  BLOCKED,
  ACCENT,
} as const;
