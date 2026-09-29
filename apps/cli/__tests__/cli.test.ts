import { describe, expect, it } from "vitest";
import { main, parseArgs, renderPlan } from "../src/main.ts";

describe("cli", () => {
  it("parses the surface", () => {
    expect(parseArgs(["https://x", "--length", "20", "--silent-only", "--dry-run"])).toEqual({
      app_url: "https://x",
      length_s: 20,
      silentOnly: true,
      dryRun: true,
      help: false,
    });
    expect(() => parseArgs(["--nope"])).toThrow(/unknown argument/);
  });
  it("dry run prints seven stages and touches nothing", () => {
    const out = renderPlan(parseArgs(["https://oneshotagent.com", "--dry-run"]));
    expect(out).toMatch(/1\. boot/);
    expect(out).toMatch(/7\. render/);
    expect(out).toMatch(/Sarah/);
    expect(out).toMatch(/nothing was recorded/);
  });
  it("exits 2 without a url and 0 with --dry-run", async () => {
    expect(await main([])).toBe(2);
    expect(await main(["https://x", "--dry-run"])).toBe(0);
  });
});
