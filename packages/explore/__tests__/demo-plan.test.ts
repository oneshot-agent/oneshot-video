import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validateDemoPlan } from "../src/demo-plan.ts";

const here = import.meta.dirname;
const read = (p: string): unknown =>
  JSON.parse(readFileSync(resolve(here, "../fixtures", p), "utf8"));

describe("validateDemoPlan", () => {
  it("accepts the good fixture (4 steps, one click, one fill)", () => {
    const r = validateDemoPlan(read("demo-plan.good.json"));
    expect(r.ok, r.ok ? "" : r.errors.join("; ")).toBe(true);
    if (r.ok) {
      expect(r.plan.workflow).toHaveLength(4);
      expect(r.plan.workflow.some((s) => s.actions?.some((a) => a.op === "click"))).toBe(true);
      expect(r.plan.workflow.some((s) => s.actions?.some((a) => a.op === "fill"))).toBe(true);
    }
  });

  it("rejects the bad fixture with every expected error", () => {
    const r = validateDemoPlan(read("demo-plan.bad.json"));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toEqual(
        expect.arrayContaining([
          "workflow: must have between 3 and 6 steps (or be empty when blocked)",
          'workflow[1].id: duplicate "landing"',
          "workflow[0].path: must start with /",
          "workflow[1].actions[0].value: required",
          "boot.port: must be an integer between 1 and 65535",
        ]),
      );
    }
  });

  it("accepts a blocked plan with no workflow", () => {
    const r = validateDemoPlan({
      app: { name: "Receipts", what_it_does: "Turns emails into receipts." },
      boot: {
        install: "bun install",
        start: "bun run dev",
        port: 3000,
        env: {},
        demo_mode: null,
        seeded: [],
      },
      workflow: [],
      blocked: "needs a Postgres database the sandbox does not have",
      notes: [],
    });
    expect(r.ok, r.ok ? "" : r.errors.join("; ")).toBe(true);
  });

  it("rejects a caption over 12 words", () => {
    const thirteenWords = "one two three four five six seven eight nine ten eleven twelve thirteen";
    const r = validateDemoPlan({
      app: { name: "Receipts", what_it_does: "Turns emails into receipts." },
      boot: {
        install: "bun install",
        start: "bun run dev",
        port: 3000,
        env: {},
        demo_mode: null,
        seeded: [],
      },
      workflow: [
        { id: "a", path: "/", caption: thirteenWords, shows: "x" },
        { id: "b", path: "/b", caption: "short", shows: "x" },
        { id: "c", path: "/c", caption: "short", shows: "x" },
      ],
      blocked: null,
      notes: [],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContain("workflow[0].caption: must be 12 words or fewer");
    }
  });
});
