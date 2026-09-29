import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildScript, systemPrompt, userPrompt } from "@oneshot-video/script";

const fx = (p: string) =>
  readFileSync(resolve(import.meta.dirname, "../../baseline/fixtures", p), "utf8");
const webRead = async () => ({
  markdown: "# oneshot-gtm\nOpen-source GTM workspace. Pay-per-result, signed receipts.",
  cost_usd: 0.0036,
});

describe("buildScript", () => {
  it("returns a script that passes the pre-recording gates", async () => {
    const { script, cost_usd } = await buildScript({
      app_url: "https://oneshot-gtm.com",
      length_s: 60,
      webRead,
      llm: async () => fx("oneshot-gtm-launch.script.json"),
    });
    expect(script.sections.length).toBe(8);
    expect(cost_usd).toBeCloseTo(0.0036, 6);
  });
  it("refuses a v1-shaped script and names the gates", async () => {
    await expect(
      buildScript({ app_url: "https://x", webRead, llm: async () => fx("v1-shaped.script.json") }),
    ).rejects.toThrow(/after 3 attempts.*voiceLint.*dontReadTheCommand.*silenceRespected/s);
  });
  it("prompts carry the shape, the budget and the exemplar", () => {
    expect(systemPrompt()).toMatch(/thirty-second/);
    const u = userPrompt("https://x", "hello", 30);
    expect(u).toMatch(/Word budget: 58 words total, hard limit/);
    expect(u).toMatch(/wedge \(text_card/);
    expect(u).toMatch(/Most founders don't/);
  });
});
