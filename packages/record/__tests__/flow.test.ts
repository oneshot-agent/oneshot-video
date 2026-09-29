import { describe, expect, it } from "vitest";
import { defaultFlow } from "@oneshot-video/record";

describe("defaultFlow", () => {
  it("lands first and clicks something real", () => {
    const f = defaultFlow("https://oneshotagent.com");
    expect(f.steps[0]).toEqual({ op: "goto", url: "https://oneshotagent.com" });
    expect(f.steps.some((s) => s.op === "click")).toBe(true);
  });
});
