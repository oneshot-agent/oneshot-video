import "@fontsource-variable/host-grotesk";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile, useVideoConfig } from "remotion";
import { MIX } from "@oneshot-agent/video-baseline/music";
import { ENDTAG_TEXT } from "@oneshot-agent/video-baseline/structure";
import { INK } from "@oneshot-agent/video-baseline/tokens";
import type { Scene, Script, Stem } from "@oneshot-video/shared-types";
import {
  CloseLockup,
  CornerMark,
  Field,
  FramedCapture,
  SilentLabels,
  WedgeCard,
  Wordmark,
  sec,
} from "./primitives.tsx";

export type DemoVideoProps = {
  script: Script;
  scenes: Scene[];
  total_seconds: number;
  /** Stems keyed by section id; paths are served from the film's public/ dir via staticFile. */
  stems: Stem[];
  /** The recording, as a staticFile path, and its pixel size. Absent in the fixture. */
  recording?: { src: string; width: number; height: number };
  /** Bed as a staticFile path. Defaults to the packaged score.mp3 copied into public/. */
  bed?: string;
  target: { hostname: string; url: string };
  silent?: boolean;
};

const splitWedge = (text: string): { setup: string[]; turn: string } => {
  const parts = text.split(/(?<=[.?!])\s+/).filter(Boolean);
  const turn = parts.length > 1 ? (parts.pop() as string) : text;
  return { setup: parts.length ? parts : [text], turn };
};

export const DemoVideo: React.FC<DemoVideoProps> = ({
  script,
  scenes,
  stems,
  recording,
  bed = "score.mp3",
  target,
  silent = false,
}) => {
  const { fps } = useVideoConfig();
  const byId = new Map(script.sections.map((s) => [s.id, s]));
  const stemById = new Map(stems.map((s) => [s.id, s]));
  const win = (s: Scene) => ({
    from: sec(s.start_seconds, fps),
    durationInFrames: Math.max(1, sec(s.end_seconds, fps) - sec(s.start_seconds, fps)),
  });
  const [host, tld] = target.hostname.includes(".")
    ? [target.hostname.split(".").slice(0, -1).join("."), target.hostname.split(".").pop()]
    : [target.hostname, undefined];

  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <Field />
      <Audio src={staticFile(bed)} volume={silent ? MIX.silent : MIX.voiced} />
      {scenes.map((scene, i) => {
        const section = byId.get(scene.id);
        const stem = stemById.get(scene.id);
        const isFirst = i === 0;
        const isLast =
          i === scenes.length - 1 ||
          (scenes[scenes.length - 1]?.kind === "endtag" && i === scenes.length - 2);
        return (
          <Sequence key={scene.id} {...win(scene)}>
            {!silent && stem && section ? (
              <Sequence from={sec(section.delivery_cues.pause_before_seconds, fps)}>
                <Audio src={staticFile(stem.path)} />
              </Sequence>
            ) : null}
            {scene.kind === "endtag" ? (
              <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
                <Wordmark
                  left={ENDTAG_TEXT.split("·")[0] ?? "oneshot"}
                  right={ENDTAG_TEXT.split("·")[1]}
                  sub="the launch film"
                  size={54}
                  delay={2}
                />
              </AbsoluteFill>
            ) : scene.kind === "text_card" && isFirst && section ? (
              <WedgeCard {...splitWedge(section.text)} />
            ) : scene.kind === "text_card" && isLast ? (
              <CloseLockup
                left={host}
                right={tld}
                lines={[section?.text ?? target.hostname]}
                url={target.url}
              />
            ) : recording ? (
              <FramedCapture
                src={staticFile(recording.src)}
                srcW={recording.width}
                srcH={recording.height}
                focus={scene.focus}
                caption={scene.caption ?? section?.label ?? scene.id}
                startFrom={scene.start_seconds}
              />
            ) : (
              <>
                <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
                  <span
                    style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: 26,
                      color: "#8D847D",
                      letterSpacing: "0.12em",
                    }}
                  >
                    {(scene.caption ?? section?.label ?? scene.id).toUpperCase()} · RECORDING GOES
                    HERE
                  </span>
                </AbsoluteFill>
                <CornerMark left={host} right={tld} />
              </>
            )}
            {silent && section?.narration_only && section.silentFallback ? (
              <SilentLabels items={[section.silentFallback]} />
            ) : null}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
