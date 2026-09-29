import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkPlan, harnessTask } from "../src/harness.ts";

const plan = {
  app: { name: "oneshot-gtm", what_it_does: "Finds leads and drafts replies." },
  boot: { start: "bun run dev", port: 3000 },
  workflow: [
    { id: "landing", path: "/", caption: "The queue." },
    { id: "reply", path: "/replies", caption: "A reply, drafted." },
    { id: "receipt", path: "/receipts", caption: "A signed receipt." },
  ],
  blocked: null,
};

describe("harness", () => {
  it("task.json names env keys, never their values", () => {
    const task = harnessTask({
      repo_url: "https://github.com/oneshot-agent/oneshot-gtm",
      hint: "a signed receipt",
      env: { B: "x", A: "secret-value" },
      runDir: "/tmp/x",
    });
    expect(task.objective).toContain("oneshot-agent/oneshot-gtm");
    expect(task.objective).toContain("a signed receipt");
    expect(task.budget_usdc).toBe(0);
    expect(task.params.env_keys).toEqual(["A", "B"]);
    expect(JSON.stringify(task)).not.toContain("secret-value");
  });

  it("accepts a well-formed plan and a blocked one with no steps", () => {
    expect(checkPlan(plan).ok).toBe(true);
    expect(checkPlan({ ...plan, workflow: [], blocked: "needs a hosted Postgres" }).ok).toBe(true);
  });

  it("rejects a plan the camera cannot act on", () => {
    const r = checkPlan({ ...plan, boot: { port: "3000" }, workflow: [{ id: "a", path: "x" }] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toMatch(/boot\.port.*workflow\[0\]\.path/);
  });

  it("the playbook tells the agent to start a server that outlives it", () => {
    const md = readFileSync(join(import.meta.dirname, "..", "harness", "AGENT.md"), "utf8");
    expect(md).toContain("setsid nohup");
    expect(md).toMatch(/no `tool_used`/);
  });
});
