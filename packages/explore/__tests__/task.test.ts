import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { AGENT_MD_SECTIONS, buildObjective, buildTask, checkAgentMd } from "../src/task.ts";

describe("buildObjective", () => {
  it("names the owner/repo and uses the hint", () => {
    const objective = buildObjective({
      repo_url: "https://github.com/oneshot-agent/oneshot-gtm",
      hint: "the receipts queue clearing in real time",
    });
    expect(objective).toBe(
      "Prepare oneshot-agent/oneshot-gtm for a thirty-second launch film that shows: the receipts queue clearing in real time. Write /home/user/output/demo-plan.json.",
    );
  });
  it("falls back to the default hint when none is given", () => {
    const objective = buildObjective({ repo_url: "https://github.com/oneshot-agent/oneshot-gtm" });
    expect(objective).toContain("what the app is for, on real-looking data");
  });
});

describe("buildTask", () => {
  it("carries params, defaults port_hint, budgets zero", () => {
    const task = buildTask({ repo_url: "https://github.com/oneshot-agent/oneshot-gtm" });
    expect(task.objective).toContain("oneshot-agent/oneshot-gtm");
    expect(task.budget_usdc).toBe(0);
    expect(task.params.port_hint).toBe(3000);
  });
  it("puts only env names, sorted, into task.json — never values", () => {
    const task = buildTask({
      repo_url: "https://github.com/oneshot-agent/oneshot-gtm",
      env: { B: "x", A: "secret" },
    });
    expect(task.params.env_keys).toEqual(["A", "B"]);
    expect(JSON.stringify(task)).not.toContain("secret");
  });
});

describe("checkAgentMd", () => {
  const wellFormed = AGENT_MD_SECTIONS.map((h) => `${h}\nsome text\n`).join("\n");

  it("passes a playbook with all six sections in order", () => {
    expect(checkAgentMd(wellFormed)).toEqual({ ok: true, missing: [], outOfOrder: false });
  });

  it("flags a missing section", () => {
    const md = AGENT_MD_SECTIONS.filter((h) => h !== "## Start it")
      .map((h) => `${h}\nsome text\n`)
      .join("\n");
    const result = checkAgentMd(md);
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(["## Start it"]);
    expect(result.outOfOrder).toBe(false);
  });

  it("flags a swapped pair as out of order", () => {
    const swapped = wellFormed
      .replace("## Start it", "__TMP__")
      .replace("## Find the workflow", "## Start it")
      .replace("__TMP__", "## Find the workflow");
    const result = checkAgentMd(swapped);
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual([]);
    expect(result.outOfOrder).toBe(true);
  });
});

const agentMdPath = join(import.meta.dirname, "../harness/AGENT.md");
const describeIfHarness = existsSync(agentMdPath) ? describe : describe.skip;

describeIfHarness("packages/explore/harness/AGENT.md", () => {
  it("has all six sections, in order", () => {
    const md = readFileSync(agentMdPath, "utf8");
    expect(checkAgentMd(md)).toEqual({ ok: true, missing: [], outOfOrder: false });
  });
});
