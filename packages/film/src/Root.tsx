import React from "react";
import { Composition } from "remotion";
import { FPS, HEIGHT, WIDTH } from "@oneshot-agent/video-baseline/tokens";
import { DemoVideo, type DemoVideoProps } from "./DemoVideo.tsx";
import { fixtureProps } from "./fixture-props.ts";

const durationFrames = (p: DemoVideoProps) => Math.max(1, Math.round(p.total_seconds * FPS));

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="DemoVideo"
      component={DemoVideo}
      width={WIDTH}
      height={HEIGHT}
      fps={FPS}
      durationInFrames={durationFrames(fixtureProps)}
      // The fixture is the silent cut's; a run's props do not set `silent`, so this default is
      // what decides whether the voiced cut carries the voice.
      defaultProps={{ ...fixtureProps, silent: false }}
      calculateMetadata={({ props }) => ({ durationInFrames: durationFrames(props) })}
    />
    <Composition
      id="DemoVideoSilent"
      component={DemoVideo}
      width={WIDTH}
      height={HEIGHT}
      fps={FPS}
      durationInFrames={durationFrames(fixtureProps)}
      defaultProps={{ ...fixtureProps, silent: true }}
      calculateMetadata={({ props }) => ({ durationInFrames: durationFrames(props) })}
    />
  </>
);
