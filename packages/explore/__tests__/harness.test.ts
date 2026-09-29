import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validateDemoPlan } from "../src/demo-plan.ts";
import { repairPlan } from "../src/harness.ts";

// The shape the agent wrote on oneshot-gtm, with the defects a model tends to leave in it.
const agentPlan = {
  app: { name: "oneshot-gtm", what_it_does: "Finds leads and drafts replies." },
  boot: { install: "bun install", start: "bun run apps/server/src/bin.ts", port: "3000" },
  workflow: [
    { id: "home", path: "/", caption: "Dashboard: 445 dollars spent, nineteen replies this week" },
    {
      id: "queue",
      path: "/queue",
      caption:
        "Five prospects pending approval: Ida from Cutter, Tom from Halyard, Gabriel from Ridgeline, and more",
      shows: "The target queue",
    },
    { id: "receipts", path: "/receipts", caption: "66,468 signed receipts.", shows: "Receipts" },
  ],
};

describe("harness", () => {
  it("repairs the small defects so a usable agent plan validates", () => {
    expect(validateDemoPlan(agentPlan).ok).toBe(false);
    const r = validateDemoPlan(repairPlan(agentPlan));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.boot.port).toBe(3000);
    expect(r.plan.workflow[1]?.caption.split(/\s+/).length).toBeLessThanOrEqual(12);
    expect(r.plan.workflow[0]?.shows).toBe(agentPlan.workflow[0]?.caption);
    expect(r.plan.blocked).toBeNull();
  });

  it("leaves structural defects for the validator to reject", () => {
    const broken = { ...agentPlan, workflow: [{ id: "a", path: "x", caption: "c" }] };
    expect(validateDemoPlan(repairPlan(broken)).ok).toBe(false);
  });

  it("the playbook tells the agent to start a server that outlives it", () => {
    const md = readFileSync(join(import.meta.dirname, "..", "harness", "AGENT.md"), "utf8");
    expect(md).toContain("setsid nohup");
    expect(md).toMatch(/no `tool_used`/);
    expect(md).toMatch(/50 turns/);
  });
});
