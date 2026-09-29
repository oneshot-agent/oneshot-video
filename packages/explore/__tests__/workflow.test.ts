import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runWorkflow, type WorkflowPage, type WorkflowStep } from "../src/workflow.ts";

/** A fake WorkflowPage: no browser, no network. Records calls and lets a test script failures. */
function fakePage(opts: {
  failGoto?: (url: string) => boolean;
  failClick?: (selector: string) => boolean;
  textByUrl?: Record<string, string>;
}) {
  const calls: string[] = [];
  let currentUrl = "";
  const page: WorkflowPage = {
    goto: async (url) => {
      calls.push(`goto ${url}`);
      if (opts.failGoto?.(url)) throw new Error(`goto failed: ${url}`);
      currentUrl = url;
    },
    click: async (selector) => {
      calls.push(`click ${selector}`);
      if (opts.failClick?.(selector)) throw new Error(`click failed: ${selector}`);
    },
    fill: async (selector, value) => {
      calls.push(`fill ${selector} ${value}`);
    },
    wait: async (ms) => {
      calls.push(`wait ${ms}`);
    },
    scroll: async (px) => {
      calls.push(`scroll ${px}`);
    },
    screenshot: async (path) => {
      calls.push(`screenshot ${path}`);
    },
    visibleText: async () => opts.textByUrl?.[currentUrl] ?? "",
  };
  return { page, calls };
}

describe("runWorkflow", () => {
  it("names stills in step order", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "wf-"));
    const { page } = fakePage({});
    const steps: WorkflowStep[] = [
      { id: "home", path: "/", caption: "Home" },
      { id: "pricing", path: "/pricing", caption: "Pricing" },
      { id: "docs", path: "/docs", caption: "Docs" },
    ];
    const result = await runWorkflow({ base_url: "https://example.com", steps, outDir, page });
    expect(result.pages.map((p) => p.png.split("/").pop())).toEqual([
      "01-home.png",
      "02-pricing.png",
      "03-docs.png",
    ]);
    expect(result.pages.map((p) => p.id)).toEqual(["home", "pricing", "docs"]);
  });

  it("records a failing click and still runs the next action", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "wf-"));
    const { page, calls } = fakePage({ failClick: (s) => s === "#missing" });
    const steps: WorkflowStep[] = [
      {
        id: "flow",
        path: "/flow",
        caption: "Flow",
        actions: [
          { op: "click", selector: "#missing" },
          { op: "wait", ms: 10 },
          { op: "scroll", px: 200 },
        ],
      },
    ];
    const result = await runWorkflow({ base_url: "https://example.com", steps, outDir, page });
    expect(result.actions).toEqual([
      { step: "flow", op: "click", ok: false, error: "click failed: #missing" },
      { step: "flow", op: "wait", ok: true },
      { step: "flow", op: "scroll", ok: true },
    ]);
    // the failed click didn't stop the rest of the step from running
    expect(calls).toContain("wait 10");
    expect(calls).toContain("scroll 200");
    expect(result.pages).toHaveLength(1);
  });

  it("a failing goto skips only that step", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "wf-"));
    const { page } = fakePage({ failGoto: (url) => url.endsWith("/broken") });
    const steps: WorkflowStep[] = [
      { id: "a", path: "/a", caption: "A" },
      { id: "broken", path: "/broken", caption: "Broken" },
      { id: "b", path: "/b", caption: "B" },
    ];
    const result = await runWorkflow({ base_url: "https://example.com", steps, outDir, page });
    expect(result.pages.map((p) => p.id)).toEqual(["a", "b"]);
    expect(result.actions).toEqual([
      { step: "broken", op: "goto", ok: false, error: "goto failed: https://example.com/broken" },
    ]);
  });

  it("observed is deduplicated and in order across steps", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "wf-"));
    const { page } = fakePage({
      textByUrl: {
        "https://example.com/one": "Welcome\nPricing\nWelcome",
        "https://example.com/two": "Pricing\nDocs",
      },
    });
    const steps: WorkflowStep[] = [
      { id: "one", path: "/one", caption: "One" },
      { id: "two", path: "/two", caption: "Two" },
    ];
    const result = await runWorkflow({ base_url: "https://example.com", steps, outDir, page });
    expect(result.observed).toEqual(["Welcome", "Pricing", "Docs"]);
    expect(result.pages[0]?.text).toEqual(["Welcome", "Pricing"]);
    expect(result.pages[1]?.text).toEqual(["Pricing", "Docs"]);
  });

  it("joins the base URL and path without a double slash", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "wf-"));
    const { page, calls } = fakePage({});
    const steps: WorkflowStep[] = [{ id: "home", path: "/dash", caption: "Dash" }];
    await runWorkflow({ base_url: "https://example.com/", steps, outDir, page });
    expect(calls).toContain("goto https://example.com/dash");
    expect(calls.some((c) => c.includes("//dash"))).toBe(false);
  });

  it("actually writes a still to disk via the fake page's screenshot call", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "wf-"));
    const { writeFileSync } = await import("node:fs");
    const page: WorkflowPage = {
      goto: async () => {},
      click: async () => {},
      fill: async () => {},
      wait: async () => {},
      scroll: async () => {},
      screenshot: async (path) => writeFileSync(path, "png-bytes"),
      visibleText: async () => "",
    };
    const steps: WorkflowStep[] = [{ id: "home", path: "/", caption: "Home" }];
    const result = await runWorkflow({ base_url: "https://example.com", steps, outDir, page });
    expect(readFileSync(result.pages[0]!.png, "utf8")).toBe("png-bytes");
  });
});
