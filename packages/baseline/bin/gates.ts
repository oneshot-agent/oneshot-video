#!/usr/bin/env bun
/**
 * bun run gates <script.json> [--stems stems.json] [--scenes scenes.json] [--bed path]
 *   [--observed a,b] [--json]
 *
 * Runs the eleven taste gates against a script.json (and whatever else was supplied)
 * and prints one line per gate. Exits 1 if any gate failed.
 */
import { readFileSync } from "node:fs";
import type { Scene, Script, Stem } from "@oneshot-video/shared-types";
import { type GateReport, runGates } from "../src/gates.ts";

export interface CliArgs {
  scriptPath?: string;
  stemsPath?: string;
  scenesPath?: string;
  bedPath?: string;
  observed?: string[];
  json: boolean;
  help: boolean;
}

export const USAGE = `bun run gates <script.json> [--stems stems.json] [--scenes scenes.json] [--bed path] [--observed a,b] [--json]

  Runs the eleven taste gates on a script (and whatever else was supplied).
  Prints one line per gate; exits 1 if any gate failed. --json prints the GateReport.`;

export function parseArgs(argv: string[]): CliArgs {
  const a: CliArgs = { json: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x === "--stems") a.stemsPath = argv[++i];
    else if (x === "--scenes") a.scenesPath = argv[++i];
    else if (x === "--bed") a.bedPath = argv[++i];
    else if (x === "--observed")
      a.observed = (argv[++i] ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    else if (x === "--json") a.json = true;
    else if (x === "-h" || x === "--help") a.help = true;
    else if (x && !x.startsWith("-") && !a.scriptPath) a.scriptPath = x;
    else throw new Error(`unknown argument: ${x}`);
  }
  return a;
}

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;

/** One line per gate: name, ok/FAIL, reason, notes indented on their own lines. */
export function renderTable(report: GateReport): string {
  const lines: string[] = [];
  for (const [name, result] of Object.entries(report.results)) {
    lines.push(`${result.ok ? "ok  " : "FAIL"}  ${name.padEnd(20)} ${result.reason}`);
    for (const note of result.notes ?? []) lines.push(`        ${note}`);
  }
  return lines.join("\n");
}

export function main(argv: string[]): number {
  let args: CliArgs;
  try {
    args = parseArgs(argv);
  } catch (e) {
    console.error(String(e instanceof Error ? e.message : e));
    console.error(USAGE);
    return 2;
  }
  if (args.help || !args.scriptPath) {
    console.log(USAGE);
    return args.help ? 0 : 2;
  }
  const script = readJson<Script>(args.scriptPath);
  const stems = args.stemsPath ? readJson<Stem[]>(args.stemsPath) : undefined;
  const scenes = args.scenesPath ? readJson<Scene[]>(args.scenesPath) : undefined;
  const report = runGates({
    script,
    stems,
    scenes,
    bedPath: args.bedPath,
    observed: args.observed,
  });
  if (args.json) console.log(JSON.stringify(report, null, 2));
  else console.log(renderTable(report));
  return report.ok ? 0 : 1;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
