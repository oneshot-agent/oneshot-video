/**
 * explore: from a repo or a URL to a set of page stills and the text on them.
 * A repo is booted in OneShot's E2B sandbox first and torn down after the shots; a URL is shot as
 * it is. Either way the film is cut from stills.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { join } from "node:path";
import { HEIGHT, WIDTH } from "@oneshot-agent/video-baseline";
import type { Explored } from "@oneshot-video/shared-types";
import { bootRepo, type BootResult, type Box } from "./boot.ts";
import { runHarness, type HarnessResult } from "./harness.ts";
import { shootPages } from "./pages.ts";
import {
  runWorkflow,
  type RunWorkflowResult,
  type WorkflowAuth,
  type WorkflowStep,
} from "./workflow.ts";

export { bootRepo, readRepoFacts, E2B_TEMPLATE, BOOT_CAP_S } from "./boot.ts";
export { recipeFor, parseSetupHint } from "./recipe.ts";
export { shootPages } from "./pages.ts";
export type { BootResult } from "./boot.ts";
export { runHarness, repairPlan, HARNESS_CAP_S } from "./harness.ts";
export { validateDemoPlan } from "./demo-plan.ts";
export type { DemoPlan } from "./demo-plan.ts";
export { buildTask, buildObjective, checkAgentMd } from "./task.ts";
export { runWorkflow, playwrightPage } from "./workflow.ts";
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
  const want = opts.want ?? pathsFromHint(opts.setup_hint);
  let harness: Explored["harness"];
  let steps: WorkflowStep[] | undefined;
  let auth: WorkflowAuth | undefined;
  let inBox: { box: Box; plan: unknown } | undefined;
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
      // validateDemoPlan has checked each action carries the fields its op needs.
      steps = h.plan.workflow.map(({ id, path, caption, actions }) => ({
        id,
        path,
        caption,
        actions: actions as WorkflowStep["actions"],
      }));
      if (h.plan.auth)
        auth = {
          path: h.plan.auth.path,
          actions: h.plan.auth.actions as WorkflowAuth["actions"],
          expect: h.plan.auth.expect,
        };
      stop = h.stop;
      inBox = { box: h.box, plan: h.plan };
    } else {
      if (h.blocked) {
        await h.box?.sbx.kill().catch(() => {});
        throw new Error(
          `the agent could not boot this repo: ${h.reason.replace(/^blocked: /, "")}`,
        );
      }
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
      // No agent plan on this path, so the camera gets a plain one: the landing, the hint's
      // paths, and scrolls down the landing in place, shot inside the box like a harness plan.
      if (r.booted.box) {
        const paths = ["/", ...want.filter((p) => p !== "/")].slice(0, 4);
        const planSteps: WorkflowStep[] = paths.map((path, i) => ({
          id: i === 0 ? "landing" : `page-${i}`,
          path,
          caption: path,
        }));
        for (let k = 1; planSteps.length < 3; k++)
          planSteps.push({
            id: `scroll-${k}`,
            path: planSteps.at(-1)?.path ?? "/",
            caption: "scroll",
            actions: [
              { op: "scroll", px: 900 },
              { op: "wait", ms: 800 },
            ],
          });
        steps = planSteps;
        inBox = {
          box: r.booted.box,
          plan: {
            app: { name: opts.repo_url, what_it_does: "booted from its package.json scripts" },
            boot: {
              install: r.booted.recipe.install,
              start: r.booted.recipe.start,
              port: r.booted.port,
              env: {},
              demo_mode: null,
              seeded: [],
            },
            workflow: planSteps.map((s) => ({ ...s, shows: s.caption })),
            blocked: null,
          },
        };
      }
    }
  }
  try {
    const outDir = join(opts.runDir, "pages");
    // A harness plan is shot as a workflow (visit, click, fill, wait, scroll, still); anything
    // else walks the landing's links.
    // The camera runs inside the box first: it reaches the app on localhost, as the agent's own
    // check did, so a frontend that calls localhost, a Host check or a dev server too slow for the
    // tunnel films the same as it checked. The camera outside is the fallback.
    const boxed = inBox ? await shootInBox(inBox.box, inBox.plan, outDir, log) : undefined;
    if (boxed) log(`shot ${boxed.pages.length} stills inside the box`);
    const shots = steps
      ? await (
          boxed ? Promise.resolve(boxed) : runWorkflow({ base_url, steps, auth, outDir, log })
        ).then((w) => {
          writeFileSync(
            join(opts.runDir, "workflow-actions.json"),
            JSON.stringify(w.actions, null, 2),
          );
          return {
            observed: w.observed,
            pages: w.pages.map((p) => ({
              url: p.url,
              path: steps?.find((s) => s.id === p.id)?.path ?? "/",
              title: p.caption,
              png: p.png,
              width: WIDTH,
              height: HEIGHT,
              text: p.text,
            })),
          };
        })
      : await shootPages({ base_url, outDir, want, log });
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

/**
 * Run the plan through check-workflow in the box (the template's copy of runWorkflow, same
 * Chromium, film size) and download the stills. Undefined when it could not shoot at least one.
 */
async function shootInBox(
  box: Box,
  plan: unknown,
  outDir: string,
  log: (line: string) => void,
): Promise<RunWorkflowResult | undefined> {
  const dir = "/home/user/output/camera";
  try {
    await box.sbx.files.write("/home/user/output/camera-plan.json", JSON.stringify(plan));
    const r = await box.run(
      `mkdir -p ${dir} && CHECK_OUT=${dir} check-workflow /home/user/output/camera-plan.json --json ${dir}/result.json | tail -12`,
      300_000,
      false,
    );
    log(`in-box camera: ${r.stdout.trim().split("\n").at(-1) ?? ""}`);
    const result = JSON.parse(await box.sbx.files.read(`${dir}/result.json`)) as RunWorkflowResult;
    if (!result.pages.length) return undefined;
    mkdirSync(outDir, { recursive: true });
    for (const p of result.pages) {
      const bytes = await box.sbx.files.read(p.png, { format: "bytes" });
      const local = join(outDir, basename(p.png));
      writeFileSync(local, bytes);
      p.png = local;
    }
    return result;
  } catch (e) {
    log(`in-box camera failed (${String(e).slice(0, 160)}); shooting from outside`);
    return undefined;
  }
}
