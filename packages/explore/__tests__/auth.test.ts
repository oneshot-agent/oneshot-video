import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validateDemoPlan } from "../src/demo-plan.ts";
import { runWorkflow, type WorkflowPage } from "../src/workflow.ts";

const plan = {
  app: { name: "items", what_it_does: "Tracks items." },
  boot: { install: "-", start: "-", port: 3000, env: {}, demo_mode: null, seeded: [] },
  workflow: [
    { id: "a", path: "/items", caption: "Items.", shows: "items" },
    { id: "b", path: "/items/1", caption: "One item.", shows: "item" },
    { id: "c", path: "/stats", caption: "Stats.", shows: "stats" },
  ],
  blocked: null,
};

describe("auth step", () => {
  it("validates an auth block and rejects a malformed one", () => {
    const auth = {
      path: "/login",
      actions: [
        { op: "fill", selector: 'role=textbox[name="Email"]', value: "demo@example.com" },
        { op: "click", selector: 'role=button[name="Log in"]' },
      ],
      expect: "Items",
    };
    expect(validateDemoPlan({ ...plan, auth }).ok).toBe(true);
    const bad = validateDemoPlan({ ...plan, auth: { path: "login", actions: [] } });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors.join(" ")).toMatch(/auth\.path.*auth\.actions/);
  });

  it("runs the login once, unfilmed, before the steps, and reports whether it got in", async () => {
    const calls: string[] = [];
    let url = "";
    let loggedIn = false;
    const page: WorkflowPage = {
      goto: async (u) => {
        calls.push(`goto ${u}`);
        url = u;
      },
      click: async (s) => {
        calls.push(`click ${s}`);
        if (s.includes("Log in")) loggedIn = true;
      },
      fill: async (s) => {
        calls.push(`fill ${s}`);
      },
      wait: async () => {},
      scroll: async () => {},
      screenshot: async (p) => {
        calls.push(`shot ${p.split("/").pop()}`);
      },
      visibleText: async () => (loggedIn ? `Items\n${url}` : "Log in\nPassword"),
    };
    const r = await runWorkflow({
      base_url: "https://app.test",
      outDir: mkdtempSync(join(tmpdir(), "auth-")),
      page,
      auth: {
        path: "/login",
        actions: [
          { op: "fill", selector: "#email", value: "demo@example.com" },
          { op: "click", selector: 'role=button[name="Log in"]' },
        ],
        expect: "Items",
      },
      steps: plan.workflow.map(({ id, path, caption }) => ({ id, path, caption })),
    });
    expect(r.authOk).toBe(true);
    expect(calls.slice(0, 3)).toEqual([
      "goto https://app.test/login",
      "fill #email",
      'click role=button[name="Log in"]',
    ]);
    expect(calls.filter((c) => c.startsWith("shot"))).toEqual([
      "shot 01-a.png",
      "shot 02-b.png",
      "shot 03-c.png",
    ]);
    expect(r.pages[0]?.text[0]).toBe("Items");
  });
});
