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
      llm: async () => {
        // The launch script, with an opening and close written for the product, as a real
        // model now has to.
        const sc = JSON.parse(fx("oneshot-gtm-launch.script.json"));
        sc.sections[0].text = "Your agent sends the outreach. You approve the queue.";
        sc.sections[0].on_screen = ["Agent sends. You approve."];
        sc.sections.at(-1).text = "Each send comes back with a signed receipt.";
        sc.sections.at(-1).on_screen = ["oneshot-gtm", "Outreach you can audit."];
        return JSON.stringify(sc);
      },
    });
    expect(script.sections.length).toBe(8);
    expect(cost_usd).toBeCloseTo(0.0036, 6);
  });
  it("refuses a v1-shaped script and names the gates", async () => {
    await expect(
      buildScript({ app_url: "https://x", webRead, llm: async () => fx("v1-shaped.script.json") }),
    ).rejects.toThrow(/after 5 attempts.*voiceLint.*dontReadTheCommand.*silenceRespected/s);
  });
  it("prompts carry the shape, the budget and the exemplar", () => {
    expect(systemPrompt()).toMatch(/thirty-second/);
    const u = userPrompt("https://x", "hello", 30);
    expect(u).toMatch(/Word budget: 58 words total, hard limit/);
    expect(u).toMatch(/wedge \(text_card/);
    expect(u).toMatch(/Most founders don't/);
  });
});
