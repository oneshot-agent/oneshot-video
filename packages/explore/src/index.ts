/**
 * explore: from a repo or a URL to a set of page stills and the text on them.
 * A repo is booted in OneShot's E2B sandbox first and torn down after the shots; a URL is shot as
 * it is. Either way the film is cut from stills.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Explored } from "@oneshot-video/shared-types";
import { bootRepo, type BootResult } from "./boot.ts";
import { runHarness, type HarnessResult } from "./harness.ts";
import { shootPages } from "./pages.ts";

export { bootRepo, readRepoFacts, E2B_TEMPLATE, BOOT_CAP_S } from "./boot.ts";
export { recipeFor, parseSetupHint } from "./recipe.ts";
export { shootPages } from "./pages.ts";
export type { BootResult } from "./boot.ts";
export { runHarness, harnessTask, checkPlan, HARNESS_CAP_S } from "./harness.ts";
export type { HarnessPlan, HarnessResult } from "./harness.ts";

export interface ExploreOptions {
  repo_url?: string;
  app_url?: string;
  ref?: string;
  setup_hint?: string;
  env?: Record<string, string>;
  /** Paths to show, from the submitter's hint ("/dashboard, /receipts"). */
  want?: string[];
  /** What the film should show, in the submitter's words. The harness agent's objective. */
  hint?: string;
  /** Skip the harness agent and boot from package.json scripts only. */
  noHarness?: boolean;
  runDir: string;
  log?: (line: string) => void;
}

/** Turn a free-text hint into paths: anything that looks like /a/path. */
export const pathsFromHint = (hint?: string): string[] =>
  (hint?.match(/(^|\s)(\/[a-z0-9/_-]+)/gi) ?? []).map((m) => m.trim()).filter((p) => p.length > 1);

export async function explore(opts: ExploreOptions): Promise<Explored> {
  const log = opts.log ?? (() => {});
  if (!opts.repo_url && !opts.app_url) throw new Error("explore: repo_url or app_url is required");
  let base_url = opts.app_url ?? "";
  let boot: Explored["boot"] = { backend: "none", seconds: 0 };
  let stop: (() => Promise<void>) | undefined;
  let want = opts.want ?? pathsFromHint(opts.setup_hint);
  let harness: Explored["harness"];
  if (opts.repo_url) {
    const bootOpts = {
      repo_url: opts.repo_url,
      ref: opts.ref,
      setup_hint: opts.setup_hint,
      env: opts.env,
      runDir: opts.runDir,
      log,
    };
    const h: HarnessResult =
      opts.noHarness || process.env["ONESHOT_VIDEO_NO_HARNESS"]
        ? { ok: false, reason: "harness disabled" }
        : await runHarness({ ...bootOpts, hint: opts.hint });
    if (h.ok) {
      base_url = h.url;
      boot = {
        backend: "e2b",
        mode: "harness",
        install: h.plan.boot.install,
        start: h.plan.boot.start,
        port: h.port,
        seconds: h.seconds,
      };
      harness = {
        app: h.plan.app,
        workflow: h.plan.workflow.map(({ id, path, caption }) => ({ id, path, caption })),
        demo_mode: h.plan.boot.demo_mode ?? null,
        seeded: h.plan.boot.seeded ?? [],
        turns: h.turns,
      };
      // Until runWorkflow (card #7) lands, the plan's paths are the shot list, in its order.
      want = [...new Set(h.plan.workflow.map((s) => s.path))];
      stop = h.stop;
    } else {
      log(`harness: ${h.reason} → recipe boot${h.box ? " in the same sandbox" : ""}`);
      const r: BootResult = await bootRepo(bootOpts, h.box);
      if (!r.ok) throw new Error(`unsupported: ${r.reason}`);
      base_url = r.booted.url;
      boot = {
        backend: r.booted.backend,
        mode: "recipe",
        install: r.booted.recipe.install,
        start: r.booted.recipe.start,
        port: r.booted.port,
        seconds: r.booted.seconds,
        harness_note: h.reason,
      };
      stop = r.booted.stop;
    }
  }
  try {
    const shots = await shootPages({
      base_url,
      outDir: join(opts.runDir, "pages"),
      want,
      max: harness ? Math.max(4, want.length) : undefined,
      log,
    });
    const explored: Explored = {
      base_url,
      pages: shots.pages,
      observed: shots.observed,
      boot,
      ...(harness ? { harness } : {}),
    };
    writeFileSync(
      join(opts.runDir, "explored.json"),
      JSON.stringify(
        {
          ...explored,
          pages: explored.pages.map((p) => ({ ...p, png: p.png.replace(opts.runDir + "/", "") })),
        },
        null,
        2,
      ),
    );
    return explored;
  } finally {
    await stop?.();
  }
}
