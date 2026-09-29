import { describe, expect, it } from "vitest";
import {
  DemoVideoInputError,
  demoVideoTool,
  handle,
  handleStatus,
  validateDemoVideoInput,
} from "../src/index.ts";

type Deps = Parameters<typeof handle>[1];
const queued: { url: string; kind?: string }[] = [];
const enqueue: Deps["enqueue"] = (s) => {
  queued.push(s);
  return { ...s, id: "r1", ts: "" };
};
const statusUrl = (id: string) => `https://oneshot-video.ngrok.app/r/${id}`;

describe("demoVideo tool", () => {
  it("describes the tool and mentions the silent cut", () => {
    expect(demoVideoTool.name).toBe("demoVideo");
    expect(demoVideoTool.description).toMatch(/silent/i);
    expect(demoVideoTool.description).toMatch(/status_url/);
    expect(Object.keys(demoVideoTool.inputSchema.properties)).toContain("repo_url");
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

  it("needs exactly one of app_url or repo_url, and repo_url must be GitHub", () => {
    expect(() => validateDemoVideoInput({})).toThrow(/exactly one/);
    expect(() =>
      validateDemoVideoInput({ app_url: "https://a.b", repo_url: "https://github.com/a/b" }),
    ).toThrow(/exactly one/);
    expect(() => validateDemoVideoInput({ repo_url: "https://gitlab.com/a/b" })).toThrow(/github/);
    expect(validateDemoVideoInput({ repo_url: "https://github.com/a/b" })).toEqual({
      repo_url: "https://github.com/a/b",
    });
  });

  it("handle() queues the run and returns the status URL without calling run()", async () => {
    let called = false;
    const run = async () => {
      called = true;
      throw new Error("must not run");
    };
    const r = await handle(
      { repo_url: "https://github.com/oneshot-agent/oneshot-gtm", hint: "the receipts" },
      { run, enqueue, statusUrl },
    );
    expect(called).toBe(false);
    expect(r).toEqual({
      id: "r1",
      status: "queued",
      status_url: "https://oneshot-video.ngrok.app/r/r1",
      status_json_url: "https://oneshot-video.ngrok.app/r/r1.json",
      eta_s: 480,
    });
    expect(queued.at(-1)).toMatchObject({ kind: "repo", hint: "the receipts" });
  });

  it("handleStatus() adds absolute video URLs at done", () => {
    const st = handleStatus(
      { id: "r1" },
      {
        readStatus: (id) => ({
          id,
          stage: "done",
          updated: "",
          video: "/videos/r1/voiced.mp4",
          silent: "/videos/r1/silent.mp4",
        }),
        statusUrl,
      },
    );
    expect(st.video_url).toBe("https://oneshot-video.ngrok.app/videos/r1/voiced.mp4");
    expect(() => handleStatus({ id: "../etc" }, { readStatus: () => st, statusUrl })).toThrow();
  });

  it("handle() with wait: true runs and returns the three fields", async () => {
    const run = async () =>
      ({
        video_url: "/renders/r1-voiced.mp4",
        silent_video_url: "/renders/r1-silent.mp4",
        cost: 0.42,
        script: {},
        scenes: [],
      }) as unknown as Awaited<ReturnType<Parameters<typeof handle>[1]["run"]>>;
    const result = await handle(
      { app_url: "https://x.example", wait: true },
      { run, enqueue, statusUrl },
    );
    expect(result).toEqual({
      id: "r1",
      status_url: "https://oneshot-video.ngrok.app/r/r1",
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
    await expect(handle({ app_url: "nope" }, { run, enqueue, statusUrl })).rejects.toThrow(
      DemoVideoInputError,
    );
    expect(called).toBe(false);
  });
});
