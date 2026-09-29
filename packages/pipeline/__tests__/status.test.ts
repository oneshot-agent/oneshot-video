import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = mkdtempSync(join(tmpdir(), "status-"));
process.env["ONESHOT_VIDEO_ROOT"] = root;
const { progressFrom, readStatus, runDir, updateStatus } = await import("../src/status.ts");

describe("status", () => {
  it("merges updates, times each stage, and leaves no temp files behind", () => {
    updateStatus("a", { stage: "queued" });
    updateStatus("a", { stage: "booting", detail: "starting" });
    updateStatus("a", { cost_usd: 0.5 });
    const st = updateStatus("a", { stage: "shooting" });
    expect(st.cost_usd).toBe(0.5);
    expect(st.detail).toBeUndefined();
    expect(st.steps?.map((s) => [s.stage, Boolean(s.finished)])).toEqual([
      ["queued", true],
      ["booting", true],
      ["shooting", false],
    ]);
    expect(readdirSync(runDir("a")).filter((f) => f.includes(".tmp"))).toEqual([]);
  });

  it("turns explore's log lines into the turn, the detail, the stage flip and the stills", () => {
    let t = 0;
    updateStatus("b", { stage: "booting" });
    const p = progressFrom("b", () => t);
    p.line("harness turn 7 · 20s");
    expect(readStatus("b").harness?.turn).toBe(7);
    expect(readStatus("b").detail).toBe("the agent is on turn 7 of 50");

    writeFileSync(
      join(runDir("b"), "harness-notes.md"),
      "# Notes\n- demo mode: bun run cli -- demo seed\n",
    );
    t += 500;
    p.line("harness turn 8 · 22s");
    expect(readStatus("b").harness?.turn).toBe(7); // throttled: under a second since the last write
    t += 600;
    p.line("$ ls → exit 0");
    expect(readStatus("b").harness?.turn).toBe(8);
    expect(readStatus("b").harness?.notes).toEqual(["demo mode: bun run cli -- demo seed"]);

    mkdirSync(join(runDir("b"), "pages"), { recursive: true });
    writeFileSync(join(runDir("b"), "pages", "01-home.png"), "png");
    p.line("harness ready in 235s · 4 steps · https://x.e2b.app");
    const st = readStatus("b");
    expect(st.stage).toBe("shooting");
    expect(st.stills).toEqual(["pages/01-home.png"]);
  });
});
