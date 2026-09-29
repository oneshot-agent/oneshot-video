/**
 * One easing vocabulary for the whole piece. Nothing in this video overshoots.
 * These are plain numbers so a server can import them; the film wraps them in
 * Remotion's `spring()`. The `oneMotionVocabulary` gate fails any file outside
 * this one that spells out its own damping.
 */
export const SETTLE = { damping: 200, mass: 0.9, durationInFrames: 26 } as const;

/** Fade-ins are 12–14 frames. Type lands with a 14 px settle, never a bounce. */
export const FADE_FRAMES = 12;
export const FADE_FRAMES_TYPE = 14;
export const TYPE_SETTLE_PX = 14;

/** Terminal: characters per second while a command types. */
export const CPS_DEFAULT = 30;

/**
 * A command starts typing when the voice reaches its line, never before. The failure
 * mode this avoids is burning every command in the first 40% and freezing for the rest.
 */
export const TERMINAL_RULE =
  "a command starts typing when the voice reaches its line, never before";

/** Camera moves on captured UI: one move per scene, then it stops. Never constant motion. */
export const CAPTURE_RULE = "one move per scene, then it stops";
export const CAPTURE_EASING = "easeOutCubic" as const;
