import { describe, expect, it } from "vitest";
import {
  DemoVideoInputError,
  demoVideoTool,
  handle,
  validateDemoVideoInput,
} from "../src/index.ts";

describe("demoVideo tool", () => {
  it("describes the tool and mentions the silent cut", () => {
    expect(demoVideoTool.name).toBe("demoVideo");
    expect(demoVideoTool.description).toMatch(/silent/i);
    expect(demoVideoTool.inputSchema.required).toEqual(["app_url"]);
  });

  it("rejects a non-URL app_url", () => {
    expect(() => validateDemoVideoInput({ app_url: "not-a-url" })).toThrow(DemoVideoInputError);
    expect(() => validateDemoVideoInput({ app_url: "ftp://x.example" })).toThrow(
      DemoVideoInputError,
    );
  });

  it("rejects a length_s of 5", () => {
    expect(() => validateDemoVideoInput({ app_url: "https://x.example", length_s: 5 })).toThrow(
      DemoVideoInputError,
    );
    expect(() => validateDemoVideoInput({ app_url: "https://x.example", length_s: 61 })).toThrow(
      DemoVideoInputError,
    );
  });

  it("accepts a valid app_url, length_s and hint", () => {
    expect(
      validateDemoVideoInput({
        app_url: "https://x.example",
        length_s: 45,
        hint: "show the pricing page",
      }),
    ).toEqual({ app_url: "https://x.example", length_s: 45, hint: "show the pricing page" });
  });

  it("handle() with an injected run() returns the three fields", async () => {
    const run = async () =>
      ({
        video_url: "/renders/r1-voiced.mp4",
        silent_video_url: "/renders/r1-silent.mp4",
        cost: 0.42,
        script: {},
        scenes: [],
      }) as unknown as Awaited<ReturnType<Parameters<typeof handle>[1]["run"]>>;
    const result = await handle({ app_url: "https://x.example" }, { run });
    expect(result).toEqual({
      video_url: "/renders/r1-voiced.mp4",
      silent_video_url: "/renders/r1-silent.mp4",
      cost: 0.42,
    });
  });

  it("handle() rejects invalid input before calling run()", async () => {
    let called = false;
    const run = async () => {
      called = true;
      return {
        video_url: "x",
        silent_video_url: "x",
        cost: 0,
        script: {},
        scenes: [],
      } as unknown as Awaited<ReturnType<Parameters<typeof handle>[1]["run"]>>;
    };
    await expect(handle({ app_url: "nope" }, { run })).rejects.toThrow(DemoVideoInputError);
    expect(called).toBe(false);
  });
});
