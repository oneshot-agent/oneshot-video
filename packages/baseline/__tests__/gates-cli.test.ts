import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const here = import.meta.dirname;
const bin = resolve(here, "../bin/gates.ts");
const fixtures = resolve(here, "../fixtures");

function runGatesCli(args: string[]) {
  return spawnSync("bun", ["run", bin, ...args], { encoding: "utf8" });
}

describe("bun run gates <script.json>", () => {
  it("exits 0 and prints eleven lines for the launch film", () => {
    const r = runGatesCli([
      resolve(fixtures, "oneshot-gtm-launch.script.json"),
      "--scenes",
      resolve(fixtures, "oneshot-gtm-launch.scenes.json"),
    ]);
    expect(r.stderr, r.stderr).toBe("");
    expect(r.status).toBe(0);
    const gateLines = r.stdout
      .trim()
      .split("\n")
      .filter((l) => !l.startsWith(" "));
    expect(gateLines).toHaveLength(11);
  });

  it("exits 1 and marks voiceLint FAIL for the v1-shaped script", () => {
    const r = runGatesCli([resolve(fixtures, "v1-shaped.script.json")]);
    expect(r.status).toBe(1);
    const voiceLintLine = r.stdout.split("\n").find((l) => l.includes("voiceLint"));
    expect(voiceLintLine).toBeDefined();
    expect(voiceLintLine).toMatch(/^FAIL/);
  });

  it("--json prints a GateReport", () => {
    const r = runGatesCli([resolve(fixtures, "v1-shaped.script.json"), "--json"]);
    const report = JSON.parse(r.stdout);
    expect(report.ok).toBe(false);
    expect(report.failed).toContain("voiceLint");
  });

  it("prints usage and exits 2 with no script path", () => {
    const r = runGatesCli([]);
    expect(r.status).toBe(2);
  });
});
