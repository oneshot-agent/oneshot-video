import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultFlow } from "@oneshot-video/record";
import { describeFlow, loadFlow } from "@oneshot-video/record/flow";

describe("defaultFlow", () => {
  it("lands first and clicks something real", () => {
    const f = defaultFlow("https://oneshotagent.com");
    expect(f.steps[0]).toEqual({ op: "goto", url: "https://oneshotagent.com" });
    expect(f.steps.some((s) => s.op === "click")).toBe(true);
  });
});

describe("loadFlow", () => {
  it("loads the landing example", () => {
    const flow = loadFlow(new URL("../examples/flows/landing.json", import.meta.url).pathname);
    expect(flow.steps[0]).toEqual({ op: "goto", url: "https://oneshotagent.com" });
    expect(flow.steps.some((s) => s.op === "click")).toBe(true);
    for (const step of flow.steps) {
      expect(["goto", "wait", "click", "fill", "scroll"]).toContain(step.op);
    }
  });

  it("loads the dashboard example", () => {
    const flow = loadFlow(new URL("../examples/flows/dashboard.json", import.meta.url).pathname);
    expect(flow.steps[0]).toMatchObject({ op: "goto" });
    expect(flow.steps.some((s) => s.op === "click")).toBe(true);
    expect(flow.steps.some((s) => s.op === "wait")).toBe(true);
    expect(flow.steps.some((s) => s.op === "scroll")).toBe(true);
  });

  it("throws naming the step index and field for a missing goto url", () => {
    const dir = tmpdir();
    const path = join(dir, `flow-missing-url-${Date.now()}.json`);
    writeFileSync(path, JSON.stringify({ steps: [{ op: "goto" }] }));
    expect(() => loadFlow(path)).toThrow(/step 0/);
    expect(() => loadFlow(path)).toThrow(/"url"/);
  });

  it("throws naming the step index and field for a non-positive wait ms", () => {
    const dir = tmpdir();
    const path = join(dir, `flow-bad-wait-${Date.now()}.json`);
    writeFileSync(
      path,
      JSON.stringify({
        steps: [
          { op: "goto", url: "https://x.test" },
          { op: "wait", ms: 0 },
        ],
      }),
    );
    expect(() => loadFlow(path)).toThrow(/step 1/);
    expect(() => loadFlow(path)).toThrow(/"ms"/);
  });

  it("throws naming the step index and field for a click missing a selector", () => {
    const dir = tmpdir();
    const path = join(dir, `flow-bad-click-${Date.now()}.json`);
    writeFileSync(path, JSON.stringify({ steps: [{ op: "click" }] }));
    expect(() => loadFlow(path)).toThrow(/step 0/);
    expect(() => loadFlow(path)).toThrow(/"selector"/);
  });

  it("throws naming the step index and field for a fill missing a selector", () => {
    const dir = tmpdir();
    const path = join(dir, `flow-bad-fill-${Date.now()}.json`);
    writeFileSync(path, JSON.stringify({ steps: [{ op: "fill", value: "x" }] }));
    expect(() => loadFlow(path)).toThrow(/step 0/);
    expect(() => loadFlow(path)).toThrow(/"selector"/);
  });

  it("throws naming the step index and field for a scroll missing dy", () => {
    const dir = tmpdir();
    const path = join(dir, `flow-bad-scroll-${Date.now()}.json`);
    writeFileSync(path, JSON.stringify({ steps: [{ op: "scroll" }] }));
    expect(() => loadFlow(path)).toThrow(/step 0/);
    expect(() => loadFlow(path)).toThrow(/"dy"/);
  });
});

describe("describeFlow", () => {
  it("lists one line per step", () => {
    const flow = loadFlow(new URL("../examples/flows/landing.json", import.meta.url).pathname);
    const description = describeFlow(flow);
    const lines = description.split("\n");
    expect(lines).toHaveLength(flow.steps.length);
    expect(lines[0]).toContain("goto");
  });
});
