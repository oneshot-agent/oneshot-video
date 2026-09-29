#!/usr/bin/env bun
/**
 * oneshot-video <app_url> [--length 30] [--flow flow.json] [--silent-only] [--url-check] [--out dir] [--dry-run]
 * No dependency on a CLI framework: the surface is one positional and six flags.
 */
import {
  BED_PATH,
  MIX,
  MODEL_ID,
  STABILITY,
  VOICE_NAME,
  WORDS_PER_SECOND_MAX,
} from "@oneshot-agent/video-baseline";
import { describePlan, run } from "@oneshot-video/pipeline";

export interface Args {
  app_url?: string;
  length_s: number;
  flow?: string;
  silentOnly: boolean;
  dryRun: boolean;
  help: boolean;
  urlCheck: boolean;
  outDir: string;
}

export function parseArgs(argv: string[]): Args {
  const a: Args = {
    length_s: 30,
    silentOnly: false,
    dryRun: false,
    help: false,
    urlCheck: false,
    outDir: "renders",
  };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x === "--length") a.length_s = Number(argv[++i] ?? 30);
    else if (x === "--flow") a.flow = argv[++i];
    else if (x === "--silent-only") a.silentOnly = true;
    else if (x === "--url-check") a.urlCheck = true;
    else if (x === "--out") a.outDir = argv[++i] ?? "renders";
    else if (x === "--dry-run") a.dryRun = true;
    else if (x === "-h" || x === "--help") a.help = true;
    else if (x && !x.startsWith("-") && !a.app_url) a.app_url = x;
    else throw new Error(`unknown argument: ${x}`);
  }
  return a;
}

export const USAGE = `oneshot-video <app_url> [--length 30] [--flow flow.json] [--silent-only] [--url-check] [--out renders/] [--dry-run]

  A URL in, a 30-second product video out, voiced and silent. The film is fixed.
  --url-check refuses localhost/127.0.0.1/0.0.0.0/*.local and probes the URL before anything paid runs.
  --out sets the render output directory (default renders/).
  --dry-run prints the plan and exits before any paid call.`;

const LOCAL_HOSTNAME_RE = /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i;
const LOCAL_TLD_RE = /\.local$/i;

/** True for hosts that are not reachable from anywhere but this machine. */
export function isLocalHost(hostname: string): boolean {
  return LOCAL_HOSTNAME_RE.test(hostname) || LOCAL_TLD_RE.test(hostname);
}

export const TUNNEL_HINT = [
  "  that host is only reachable from this machine.",
  "  expose it first, e.g.:",
  "",
  "    cloudflared tunnel --url http://localhost:3000",
  "",
  "  a Vercel/Netlify preview URL also works.",
].join("\n");

export interface UrlCheckResult {
  ok: boolean;
  message?: string;
}

/**
 * Refuses localhost-shaped hosts outright, otherwise HEAD-probes the URL
 * (falling back to GET) with a 5s timeout. `fetchImpl` is injectable so
 * tests never hit the network.
 */
export async function checkUrl(
  appUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<UrlCheckResult> {
  let parsed: URL;
  try {
    parsed = new URL(appUrl);
  } catch {
    return { ok: false, message: `--url-check: not a valid URL: ${appUrl}` };
  }
  if (isLocalHost(parsed.hostname)) {
    return {
      ok: false,
      message: `--url-check: ${appUrl} is a local host\n${TUNNEL_HINT}`,
    };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    let res: Response | undefined;
    try {
      res = await fetchImpl(appUrl, { method: "HEAD", signal: controller.signal });
    } catch {
      res = undefined;
    }
    if (!res || res.status >= 400) {
      res = await fetchImpl(appUrl, { method: "GET", signal: controller.signal });
    }
    if (res.status < 200 || res.status >= 400) {
      return { ok: false, message: `--url-check: ${appUrl} answered ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      message: `--url-check: ${appUrl} is unreachable: ${e instanceof Error ? e.message : String(e)}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

export function renderPlan(args: Args): string {
  const plan = describePlan({ app_url: args.app_url ?? "", length_s: args.length_s });
  const lines = [
    `oneshot-video · ${plan.target} · ${plan.length_s}s${args.silentOnly ? " · silent only" : ""}`,
    "",
    ...plan.stages.map((s, i) => `  ${i + 1}. ${s.stage.padEnd(8)} ${s.note}`),
    "",
    `  voice   ${VOICE_NAME} · ${MODEL_ID} · stability ${STABILITY} · ≤ ${WORDS_PER_SECOND_MAX} words/s`,
    `  bed     ${BED_PATH} · ${MIX.voiced} under narration · ${MIX.silent} alone`,
    "",
    "  dry run: nothing was recorded, spoken, paid or rendered.",
  ];
  return lines.join("\n");
}

export async function main(argv: string[], fetchImpl: typeof fetch = fetch): Promise<number> {
  let args: Args;
  try {
    args = parseArgs(argv);
  } catch (e) {
    console.error(String(e instanceof Error ? e.message : e));
    console.error(USAGE);
    return 2;
  }
  if (args.help || !args.app_url) {
    console.log(USAGE);
    return args.help ? 0 : 2;
  }
  if (args.urlCheck) {
    const result = await checkUrl(args.app_url, fetchImpl);
    if (!result.ok) {
      console.error(result.message ?? `--url-check: ${args.app_url} failed`);
      return 3;
    }
  }
  if (args.dryRun) {
    console.log(renderPlan(args));
    return 0;
  }
  try {
    const r = await run({
      app_url: args.app_url,
      length_s: args.length_s,
      silentOnly: args.silentOnly,
      outDir: args.outDir,
    });
    console.log(`${r.video_url}\n${r.silent_video_url}\ncost $${r.cost.toFixed(4)}`);
    return 0;
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    return 1;
  }
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
