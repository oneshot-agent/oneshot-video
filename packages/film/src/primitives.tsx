/**
 * Atelier primitives, ported from the launch film's OneShotLaunch.tsx.
 * Every number that is taste comes from @oneshot-agent/video-baseline; the
 * oneMotionVocabulary gate fails this file if it spells out a spring of its own.
 */
import React from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  CAPTURE_EASING,
  CPS_DEFAULT,
  FADE_FRAMES,
  FADE_FRAMES_TYPE,
  SETTLE,
  TYPE_SETTLE_PX,
} from "@oneshot-agent/video-baseline/motion";
import {
  ACCENT,
  CREAM,
  CREAM_2,
  FAINT,
  INK,
  INK_DEEP,
  MONO,
  MUTED,
  RULE,
  SANS,
  SPEND,
  SPEND_2,
  SURFACE,
} from "@oneshot-agent/video-baseline/tokens";
import { type Focus, focusAt, solveCrop } from "./crop.ts";

export const sec = (s: number, fps: number) => Math.round(s * fps);

/** Slow settle. Nothing in this video overshoots. */
export const settle = (frame: number, delay: number, fps: number) =>
  spring({
    frame: frame - delay,
    fps,
    config: { damping: SETTLE.damping, mass: SETTLE.mass },
    durationInFrames: SETTLE.durationInFrames,
  });

export const fadeIn = (frame: number, delay: number, len = FADE_FRAMES) =>
  interpolate(frame - delay, [0, len], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

void CAPTURE_EASING;

/** Type lands with a settle, never a bounce. */
export const Line: React.FC<{
  children: React.ReactNode;
  delay: number;
  size: number;
  color?: string;
  weight?: number;
  font?: string;
  tracking?: string;
}> = ({
  children,
  delay,
  size,
  color = CREAM,
  weight = 400,
  font = SANS,
  tracking = "-0.02em",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = settle(frame, delay, fps);
  return (
    <div
      style={{
        fontFamily: font,
        fontSize: size,
        fontWeight: weight,
        color,
        letterSpacing: tracking,
        lineHeight: 1.14,
        opacity: fadeIn(frame, delay, FADE_FRAMES_TYPE),
        transform: `translateY(${interpolate(s, [0, 1], [TYPE_SETTLE_PX, 0])}px)`,
      }}
    >
      {children}
    </div>
  );
};

/**
 * The wordmark. There is no logo glyph — the mark IS the name in Host Grotesk with an amber
 * middot, so inventing a symbol would be inventing brand. For a target app this is its hostname.
 */
export const Wordmark: React.FC<{
  left: string;
  right?: string;
  sub?: string;
  size?: number;
  delay?: number;
}> = ({ left, right, sub, size = 19, delay = 0 }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ opacity: fadeIn(frame, delay, FADE_FRAMES_TYPE) }}>
      <div
        style={{
          fontFamily: SANS,
          fontSize: size,
          color: CREAM,
          letterSpacing: "-0.01em",
          lineHeight: 1.1,
          fontWeight: 500,
        }}
      >
        {left}
        {right ? (
          <>
            <span style={{ color: SPEND_2 }}>·</span>
            {right}
          </>
        ) : null}
      </div>
      {sub ? (
        <div
          style={{
            marginTop: size * 0.16,
            fontFamily: SANS,
            fontSize: size * 0.32,
            textTransform: "uppercase",
            letterSpacing: "0.14em",
            color: FAINT,
          }}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
};

/** Small persistent mark. Graphic scenes only, never over captured UI. */
export const CornerMark: React.FC<{ left: string; right?: string }> = ({ left, right }) => (
  <AbsoluteFill style={{ padding: "58px 74px", pointerEvents: "none" }}>
    <div style={{ opacity: 0.5 }}>
      <Wordmark left={left} right={right} size={26} delay={6} />
    </div>
  </AbsoluteFill>
);

/** The background is never flat: a warm off-centre glow plus a fine rule grid. */
export const Field: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const drift = interpolate(frame, [0, Math.max(1, durationInFrames)], [0, 40]);
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(1200px 800px at ${18 + drift * 0.4}% 28%, rgba(232,166,61,0.10), rgba(0,0,0,0) 62%)`,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${RULE} 1px, transparent 1px), linear-gradient(90deg, ${RULE} 1px, transparent 1px)`,
          backgroundSize: "120px 120px",
          opacity: 0.3,
          maskImage: "radial-gradient(1400px 900px at 30% 40%, #000 0%, transparent 78%)",
          WebkitMaskImage: "radial-gradient(1400px 900px at 30% 40%, #000 0%, transparent 78%)",
        }}
      />
      <AbsoluteFill style={{ boxShadow: "inset 0 0 400px rgba(0,0,0,0.65)" }} />
    </AbsoluteFill>
  );
};

export type Step =
  | { kind: "cmd"; text: string; at: number; cps?: number }
  | { kind: "out"; text: string; at: number; color?: string }
  | { kind: "gap"; at: number };

/**
 * Terminal — hand-authored. Types char-by-char, holds, then reveals output. A command starts
 * typing when the voice reaches its line, never before.
 */
export const Terminal: React.FC<{ title: string; steps: Step[]; scale?: number }> = ({
  title,
  steps,
  scale = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const appear = settle(frame, 0, fps);
  const rendered: React.ReactNode[] = [];
  steps.forEach((s, i) => {
    if (s.kind === "gap" || t < s.at) return;
    if (s.kind === "cmd") {
      const chars = Math.floor((t - s.at) * (s.cps ?? CPS_DEFAULT));
      const shown = s.text.slice(0, Math.max(0, chars));
      const typing = chars < s.text.length;
      rendered.push(
        <div
          key={`cmd-${s.at}-${s.text}`}
          style={{ display: "flex", gap: 14, marginTop: i === 0 ? 0 : 16 }}
        >
          <span style={{ color: ACCENT }}>$</span>
          <span style={{ color: CREAM }}>
            {shown}
            {typing && Math.floor(t * 2.2) % 2 === 0 ? (
              <span style={{ background: CREAM, color: INK }}>&nbsp;</span>
            ) : null}
          </span>
        </div>,
      );
    } else {
      rendered.push(
        <div
          key={`out-${s.at}-${s.text}`}
          style={{
            color: s.color ?? MUTED,
            marginTop: 8,
            opacity: interpolate(t - s.at, [0, 0.18], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            whiteSpace: "pre",
          }}
        >
          {s.text}
        </div>,
      );
    }
  });
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div
        style={{
          width: 1500,
          transform: `scale(${scale * interpolate(appear, [0, 1], [0.985, 1])})`,
          opacity: fadeIn(frame, 0, 10),
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: `1px solid ${FAINT}`,
            paddingBottom: 14,
            marginBottom: 30,
          }}
        >
          <span style={{ fontFamily: MONO, fontSize: 19, color: MUTED, letterSpacing: "0.12em" }}>
            {title.toUpperCase()}
          </span>
          <span style={{ fontFamily: MONO, fontSize: 19, color: FAINT }}>bash</span>
        </div>
        <div style={{ fontFamily: MONO, fontSize: 27, lineHeight: 1.55 }}>{rendered}</div>
      </div>
    </AbsoluteFill>
  );
};

/** Focus type re-exported for callers that only import from primitives.tsx. */
export type { Focus } from "./crop.ts";

/**
 * Capture rig — the recording with a designed camera move. One move per scene, then it stops.
 * Focus boxes are [x, y, w] in source fractions; the crop maths solve for the view box.
 */
export const Capture: React.FC<{
  src: string;
  srcW: number;
  srcH: number;
  focus?: Focus;
  viewW?: number;
  viewH?: number;
  /** seconds into the recording where this scene's footage starts */
  startFrom?: number;
}> = ({ src, srcW, srcH, focus, viewW, viewH, startFrom = 0 }) => {
  const frame = useCurrentFrame();
  const { fps, width: vw, height: vh } = useVideoConfig();
  const width = viewW ?? vw;
  const height = viewH ?? vh;
  const t = frame / fps;
  const f: Focus = focus ?? { from: [0.5, 0.5, 1], to: [0.5, 0.5, 1], moveStart: 0, moveEnd: 1 };
  const focusBox = focusAt(f, t);
  const { scale, left, top } = solveCrop({
    srcW,
    srcH,
    viewW: width,
    viewH: height,
    focus: focusBox,
  });
  return (
    <AbsoluteFill style={{ backgroundColor: INK, overflow: "hidden" }}>
      <OffthreadVideo
        src={src}
        startFrom={Math.round(startFrom * fps)}
        muted
        style={{ position: "absolute", width: srcW * scale, height: srcH * scale, left, top }}
      />
      <AbsoluteFill
        style={{
          opacity: fadeIn(frame, 0, 8),
          boxShadow: "inset 0 0 260px rgba(0,0,0,0.55)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};

/**
 * Captured UI, presented rather than pasted: the recording sits inside a drawn app frame with a
 * mono caption rail. A bare screenshot with a slow push reads as the least designed thing in a piece.
 */
export const FramedCapture: React.FC<{
  src: string;
  srcW: number;
  srcH: number;
  focus?: Focus;
  caption: string;
  startFrom?: number;
}> = ({ src, srcW, srcH, focus, caption, startFrom }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inn = settle(frame, 0, fps);
  const FX = 150,
    FY = 152,
    FW = 1620,
    FH = 796;
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div
        style={{
          position: "absolute",
          left: FX,
          top: FY,
          width: FW,
          height: FH,
          borderRadius: 12,
          border: `1px solid ${RULE}`,
          background: INK_DEEP,
          overflow: "hidden",
          transform: `scale(${interpolate(inn, [0, 1], [0.965, 1])})`,
          opacity: fadeIn(frame, 0, 8),
          boxShadow: "0 40px 90px rgba(0,0,0,0.55)",
        }}
      >
        <Capture
          src={src}
          srcW={srcW}
          srcH={srcH}
          focus={focus}
          viewW={FW}
          viewH={FH}
          startFrom={startFrom}
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: FX,
          top: FY + FH + 34,
          display: "flex",
          alignItems: "center",
          gap: 18,
          opacity: fadeIn(frame, 10, 12),
        }}
      >
        <div style={{ width: 34, height: 2, background: SPEND }} />
        <span style={{ fontFamily: MONO, fontSize: 26, color: CREAM_2, letterSpacing: "0.12em" }}>
          {caption.toUpperCase()}
        </span>
      </div>
    </AbsoluteFill>
  );
};

/** Closing lockup: the URL as a card, not a line of text. Holds in silence. */
export const CloseLockup: React.FC<{
  left: string;
  right?: string;
  lines: [string, string?];
  url: string;
  command?: string;
}> = ({ left, right, lines, url, command }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: "0 190px" }}>
      <div style={{ marginBottom: 54 }}>
        <Wordmark left={left} right={right} size={68} delay={6} />
      </div>
      <Line delay={sec(1.2, fps)} size={52} weight={500}>
        {lines[0]}
      </Line>
      {lines[1] ? (
        <>
          <div style={{ height: 14 }} />
          <Line delay={sec(2.0, fps)} size={52} weight={500} color={MUTED}>
            {lines[1]}
          </Line>
        </>
      ) : null}
      <div style={{ height: 58 }} />
      <div
        style={{
          border: `1px solid ${RULE}`,
          background: SURFACE,
          borderRadius: 8,
          padding: "26px 40px",
          alignSelf: "flex-start",
          opacity: fadeIn(frame, 80, 14),
          transform: `translateY(${interpolate(settle(frame, 80, fps), [0, 1], [16, 0])}px)`,
        }}
      >
        <div style={{ fontFamily: MONO, fontSize: 30, color: CREAM }}>{url}</div>
        {command ? (
          <div style={{ fontFamily: MONO, fontSize: 26, color: MUTED, marginTop: 12 }}>
            {command}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

/** The wedge: an inversion, set in clean sans; the last sentence gets the accent and its own beat. */
export const WedgeCard: React.FC<{ setup: string[]; turn: string }> = ({ setup, turn }) => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: "0 190px" }}>
      <div style={{ maxWidth: 1360 }}>
        {setup.map((l) => (
          <Line key={l} delay={sec(0.5, fps)} size={66} weight={450}>
            {l}
          </Line>
        ))}
        <div style={{ height: 46 }} />
        <Line delay={sec(3.2, fps)} size={72} weight={550} color={ACCENT}>
          {turn}
        </Line>
      </div>
    </AbsoluteFill>
  );
};

/** Silent-cut only: carries what the voice carried. Bottom-right, mono, last line in the accent. */
export const SilentLabels: React.FC<{ items: string[] }> = ({ items }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "flex-end", padding: 90 }}>
      <div style={{ textAlign: "right" }}>
        {items.map((it, i) => (
          <div
            key={it}
            style={{
              fontFamily: MONO,
              fontSize: 30,
              color: i === items.length - 1 ? ACCENT : CREAM,
              letterSpacing: "0.04em",
              marginTop: 14,
              opacity: fadeIn(frame, i * 30, 12),
            }}
          >
            {it}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
