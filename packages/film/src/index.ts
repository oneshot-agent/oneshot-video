import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root.tsx";

registerRoot(RemotionRoot);

export { DemoVideo } from "./DemoVideo.tsx";
export type { DemoVideoProps } from "./DemoVideo.tsx";
export { fixtureProps } from "./fixture-props.ts";
export * from "./primitives.tsx";
