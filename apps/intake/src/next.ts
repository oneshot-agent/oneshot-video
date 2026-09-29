#!/usr/bin/env bun
/**
 * Pop the oldest queued submission and run the pipeline on it. One at a time; the laptop is the
 * render farm. `--loop` keeps draining, checking every 10 s, so a submission from the form or the
 * MCP tool starts without anyone at the keyboard.
 */
import { run } from "@oneshot-video/pipeline";
import { nextQueued, writeStatus, type Submission } from "./queue.ts";
import { statusUrl } from "./server.ts";

async function runOne(sub: Submission): Promise<boolean> {
  const repo = sub.kind === "repo";
  console.log(
    `run ${sub.id} · ${sub.url}${sub.hint ? ` · "${sub.hint}"` : ""} · ${statusUrl(sub.id)}`,
  );
  writeStatus({ id: sub.id, stage: repo ? "booting" : "shooting", detail: "starting" });
  try {
    const result = await run({
      ...(repo ? { repo_url: sub.url } : { app_url: sub.url }),
      id: sub.id,
      hint: sub.hint,
    });
    writeStatus({
      id: sub.id,
      stage: "done",
      video: `/videos/${sub.id}/voiced.mp4`,
      silent: `/videos/${sub.id}/silent.mp4`,
      cost_usd: result.cost,
    });
    console.log(`done ${sub.id} · $${result.cost.toFixed(4)}`);
    return true;
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    writeStatus({ id: sub.id, stage: "failed", error });
    console.error(`failed ${sub.id}: ${error}`);
    return false;
  }
}

if (import.meta.main) {
  const loop = process.argv.includes("--loop");
  for (;;) {
    const sub = nextQueued();
    if (sub) {
      const ok = await runOne(sub);
      if (!loop) process.exit(ok ? 0 : 1);
    } else if (loop) {
      await new Promise((r) => setTimeout(r, 10_000));
    } else {
      console.log("queue empty");
      break;
    }
  }
}
