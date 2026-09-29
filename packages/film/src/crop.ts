/**
 * The Capture rig's crop maths, pulled out of primitives.tsx so it can be unit-tested without
 * Remotion and reused server-side when OneShot renders the film. Pure functions only — no
 * Remotion imports here, and no spring: this file never needs the oneMotionVocabulary allowlist.
 */

export interface Focus {
  from: [number, number, number];
  to: [number, number, number];
  moveStart: number;
  moveEnd: number;
}

/** Slow settle. Nothing in this video overshoots. */
export const easeOutCubic = (x: number): number => 1 - Math.pow(1 - x, 3);

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

/**
 * Focus box [x, y, w] in source fractions at time `t` seconds. One move per scene: `from` before
 * `moveStart`, `to` at and after `moveEnd`, eased in between and monotonic.
 */
export function focusAt(focus: Focus, t: number): [number, number, number] {
  const { from, to, moveStart, moveEnd } = focus;
  const progress = clamp((t - moveStart) / (moveEnd - moveStart), 0, 1);
  const p = easeOutCubic(progress);
  return [
    from[0] + (to[0] - from[0]) * p,
    from[1] + (to[1] - from[1]) * p,
    from[2] + (to[2] - from[2]) * p,
  ];
}

export interface SolveCropInput {
  srcW: number;
  srcH: number;
  viewW: number;
  viewH: number;
  focus: [number, number, number];
}

export interface CropResult {
  scale: number;
  left: number;
  top: number;
}

/** Solves scale/left/top so the source's focus box fills the view. */
export function solveCrop({ srcW, srcH, viewW, viewH, focus }: SolveCropInput): CropResult {
  const [fx, fy, fw] = focus;
  const scale = viewW / (srcW * fw);
  const left = -(fx * srcW * scale) + viewW / 2;
  const top = -(fy * srcH * scale) + viewH / 2;
  return { scale, left, top };
}
