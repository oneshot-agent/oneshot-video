#!/usr/bin/env bun
/** Pop the oldest queued submission and run the pipeline on it. One at a time; the laptop is the render farm. */
import { run } from "@oneshot-video/pipeline";
import { nextQueued, writeStatus } from "./queue.ts";

const sub = nextQueued();
if (!sub) {
  console.log("queue empty");
  process.exit(0);
}
console.log(`run ${sub.id} · ${sub.url}${sub.hint ? ` · "${sub.hint}"` : ""}`);
writeStatus({ id: sub.id, stage: "script", updated: new Date().toISOString() });
try {
  const result = await run({ app_url: sub.url, id: sub.id, hint: sub.hint });
  writeStatus({
    id: sub.id,
    stage: "done",
    updated: new Date().toISOString(),
    video: `/videos/${sub.id}/voiced.mp4`,
    silent: `/videos/${sub.id}/silent.mp4`,
    cost_usd: result.cost,
  });
  console.log(`done ${sub.id} · $${result.cost.toFixed(4)}`);
} catch (e) {
  const error = e instanceof Error ? e.message : String(e);
  writeStatus({ id: sub.id, stage: "failed", updated: new Date().toISOString(), error });
  console.error(`failed ${sub.id}: ${error}`);
  process.exit(1);
}
