import type { Scene, Script } from "@oneshot-video/shared-types";
import type { DemoVideoProps } from "./DemoVideo.tsx";
import filmScript from "../../baseline/fixtures/oneshot-gtm-launch.script.json";
import filmScenes from "../../baseline/fixtures/oneshot-gtm-launch.scenes.json";

/** The launch film's real script and scene plan, no recording, so the look is checkable in the studio today. */
export const fixtureProps: DemoVideoProps = {
  script: filmScript as Script,
  scenes: filmScenes as Scene[],
  total_seconds: 59.74,
  stems: [],
  target: { hostname: "oneshot-gtm.com", url: "github.com/oneshot-agent/oneshot-gtm" },
  silent: true,
};
