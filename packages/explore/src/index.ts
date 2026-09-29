/**
 * explore: from a repo or a URL to a set of page stills and the text on them.
 * A repo is booted in a sandbox first (Unikraft Cloud, else OneShot's E2B template) and torn down
 * after the shots; a URL is shot as it is. Either way the film is cut from stills.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Explored } from "@oneshot-video/shared-types";
import { bootRepo, type BootResult } from "./boot.ts";
import { shootPages } from "./pages.ts";

export { bootRepo, readRepoFacts, E2B_TEMPLATE, BOOT_CAP_S } from "./boot.ts";
export { recipeFor, parseSetupHint } from "./recipe.ts";
export { shootPages } from "./pages.ts";
export type { BootResult } from "./boot.ts";

export interface ExploreOptions {
  repo_url?: string;
  app_url?: string;
  ref?: string;
  setup_hint?: string;
  env?: Record<string, string>;
  /** Paths to show, from the submitter's hint ("/dashboard, /receipts"). */
  want?: string[];
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
  if (opts.repo_url) {
    const r: BootResult = await bootRepo({
      repo_url: opts.repo_url,
      ref: opts.ref,
      setup_hint: opts.setup_hint,
      env: opts.env,
      runDir: opts.runDir,
      log,
    });
    if (!r.ok) throw new Error(`unsupported: ${r.reason}`);
    base_url = r.booted.url;
    boot = {
      backend: r.booted.backend,
      install: r.booted.recipe.install,
      start: r.booted.recipe.start,
      port: r.booted.port,
      seconds: r.booted.seconds,
    };
    stop = r.booted.stop;
  }
  try {
    const shots = await shootPages({
      base_url,
      outDir: join(opts.runDir, "pages"),
      want: opts.want ?? pathsFromHint(opts.setup_hint),
      log,
    });
    const explored: Explored = { base_url, pages: shots.pages, observed: shots.observed, boot };
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
