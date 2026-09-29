import { describe, expect, it } from "vitest";
import { focusAt, solveCrop } from "../src/crop.ts";
import type { Focus } from "../src/crop.ts";

describe("solveCrop", () => {
  it("full-frame focus into a matching view gives scale 1, left 0, top 0", () => {
    const { scale, left, top } = solveCrop({
      srcW: 1920,
      srcH: 1080,
      viewW: 1920,
      viewH: 1080,
      focus: [0.5, 0.5, 1],
    });
    expect(scale).toBeCloseTo(1, 9);
    expect(left).toBeCloseTo(0, 9);
    expect(top).toBeCloseTo(0, 9);
  });

  it("a push to w 0.9 centres correctly", () => {
    const srcW = 1920;
    const srcH = 1080;
    const viewW = 1920;
    const viewH = 1080;
    const focus: [number, number, number] = [0.5, 0.5, 0.9];
    const { scale, left, top } = solveCrop({ srcW, srcH, viewW, viewH, focus });
    expect(scale).toBeCloseTo(viewW / (srcW * 0.9), 9);
    // With the same centre fraction, the visible box should stay centred in the view.
    expect(left).toBeCloseTo(-(0.5 * srcW * scale) + viewW / 2, 9);
    expect(top).toBeCloseTo(-(0.5 * srcH * scale) + viewH / 2, 9);
    // Centred crop of a centred focus: left/top offset should equal half the overhang.
    const overhangX = srcW * scale - viewW;
    const overhangY = srcH * scale - viewH;
    expect(left).toBeCloseTo(-overhangX / 2, 9);
    expect(top).toBeCloseTo(-overhangY / 2, 9);
  });
});

describe("focusAt", () => {
  const focus: Focus = {
    from: [0.2, 0.3, 1],
    to: [0.6, 0.7, 0.8],
    moveStart: 1,
    moveEnd: 3,
  };

  it("returns from before moveStart", () => {
    expect(focusAt(focus, 0)).toEqual(focus.from);
    expect(focusAt(focus, 0.99)).toEqual(focus.from);
  });

  it("returns to at and after moveEnd", () => {
    expect(focusAt(focus, 3)).toEqual(focus.to);
    expect(focusAt(focus, 5)).toEqual(focus.to);
  });

  it("is monotonic between moveStart and moveEnd", () => {
    const samples = Array.from({ length: 21 }, (_, i) => focus.moveStart + (i / 20) * 2);
    const xs = samples.map((t) => focusAt(focus, t)[0]);
    const ys = samples.map((t) => focusAt(focus, t)[1]);
    const ws = samples.map((t) => focusAt(focus, t)[2]);
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i]).toBeGreaterThanOrEqual(xs[i - 1] as number);
      expect(ys[i]).toBeGreaterThanOrEqual(ys[i - 1] as number);
      // w moves from 1 down to 0.8, so it is monotonically non-increasing.
      expect(ws[i]).toBeLessThanOrEqual(ws[i - 1] as number);
    }
  });
});
