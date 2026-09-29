/**
 * The camera, driven by a plan. Given a base URL and a demo plan's steps, run each step's
 * actions against a page and take a still afterwards, so the film shows the objective rather
 * than whatever pages happen to be linked from the landing.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";

export interface WorkflowStep {
  id: string;
  path: string;
  caption: string;
  actions?: WorkflowAction[];
}

export type WorkflowAction =
  | { op: "click"; selector: string }
  | { op: "fill"; selector: string; value: string }
  | { op: "wait"; ms: number }
  | { op: "scroll"; px: number };

export interface WorkflowPage {
  goto(url: string): Promise<void>;
  click(selector: string): Promise<void>;
  fill(selector: string, value: string): Promise<void>;
  wait(ms: number): Promise<void>;
  scroll(px: number): Promise<void>;
  screenshot(path: string): Promise<void>;
  visibleText(): Promise<string>;
}

export interface WorkflowPageResult {
  id: string;
  png: string;
  caption: string;
  url: string;
  text: string[];
}

export interface WorkflowActionResult {
  step: string;
  op: string;
  ok: boolean;
  error?: string;
}

export interface RunWorkflowResult {
  pages: WorkflowPageResult[];
  observed: string[];
  actions: WorkflowActionResult[];
  /** undefined when there was no auth step; false when it ran and `expect` never showed. */
  authOk?: boolean;
}

/** A login run once before the steps, unfilmed; the session carries into every step. */
export interface WorkflowAuth {
  path: string;
  actions: WorkflowAction[];
  /** Text that appears once logged in. */
  expect?: string;
}

export interface RunWorkflowOptions {
  base_url: string;
  steps: WorkflowStep[];
  outDir: string;
  auth?: WorkflowAuth;
  page?: WorkflowPage;
  log?: (l: string) => void;
}

const SETTLE_MS = 800;

/** Join a base URL and a step's path without a double slash, whichever side has the extra one. */
const joinUrl = (base: string, path: string): string => {
  const b = base.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
};

const errMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export async function runWorkflow(opts: RunWorkflowOptions): Promise<RunWorkflowResult> {
  const log = opts.log ?? (() => {});
  mkdirSync(opts.outDir, { recursive: true });
  const owned = !opts.page;
  const handle = opts.page ? undefined : await playwrightPage();
  const page = opts.page ?? (handle as { page: WorkflowPage }).page;
  const pages: WorkflowPageResult[] = [];
  const actions: WorkflowActionResult[] = [];
  const observedSeen = new Set<string>();
  const observed: string[] = [];
  let authOk: boolean | undefined;
  const act = async (stepId: string, action: WorkflowAction) => {
    try {
      if (action.op === "click") await page.click(action.selector);
      else if (action.op === "fill") await page.fill(action.selector, action.value);
      else if (action.op === "wait") await page.wait(action.ms);
      else if (action.op === "scroll") await page.scroll(action.px);
      actions.push({ step: stepId, op: action.op, ok: true });
    } catch (e) {
      const error = errMessage(e);
      log(`action failed ${stepId} ${action.op}: ${error}`);
      actions.push({ step: stepId, op: action.op, ok: false, error });
    }
  };
  try {
    if (opts.auth) {
      const url = joinUrl(opts.base_url, opts.auth.path);
      try {
        await page.goto(url);
        for (const action of opts.auth.actions) await act("auth", action);
        authOk = true;
        if (opts.auth.expect) {
          authOk = false;
          for (let t = 0; t < 20 && !authOk; t++) {
            await page.wait(500);
            authOk = (await page.visibleText()).includes(opts.auth.expect);
          }
        }
        log(`auth ${authOk ? "ok" : `did not reach "${opts.auth.expect}"`}`);
      } catch (e) {
        authOk = false;
        log(`auth failed ${url}: ${errMessage(e)}`);
      }
    }
    for (let i = 0; i < opts.steps.length; i++) {
      const step = opts.steps[i];
      if (!step) continue;
      const url = joinUrl(opts.base_url, step.path);
      // A step on the same path as the last one continues in place: a single-page app's tabs,
      // scrolls and clicks, without a reload that re-runs its queries into a spinner.
      const stay = i > 0 && opts.steps[i - 1]?.path === step.path && pages.length > 0;
      try {
        if (!stay) await page.goto(url);
      } catch (e) {
        const error = errMessage(e);
        log(`goto failed ${step.id} ${url}: ${error}`);
        actions.push({ step: step.id, op: "goto", ok: false, error });
        continue;
      }
      for (const action of step.actions ?? []) await act(step.id, action);
      await page.wait(SETTLE_MS);
      const png = join(opts.outDir, `${String(i + 1).padStart(2, "0")}-${step.id}.png`);
      await page.screenshot(png);
      const raw = await page.visibleText();
      const seen = new Set<string>();
      const text: string[] = [];
      for (const line of raw.split(/\n+/)) {
        const t = line.trim();
        if (!t || seen.has(t)) continue;
        seen.add(t);
        text.push(t);
        if (!observedSeen.has(t)) {
          observedSeen.add(t);
          observed.push(t);
        }
      }
      pages.push({ id: step.id, png, caption: step.caption, url, text });
      log(`step ${step.id} ${url}`);
    }
  } finally {
    if (owned) await handle?.close();
  }
  return { pages, observed, actions, ...(authOk !== undefined ? { authOk } : {}) };
}

/** Chromium at film size. Only this function may import Playwright. */
export async function playwrightPage(): Promise<{
  page: WorkflowPage;
  close: () => Promise<void>;
}> {
  const pw = await import("playwright");
  const browser = await pw.chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  let first = true;
  const workflowPage: WorkflowPage = {
    // The first load of a dev server can take a minute (it compiles on request); after that, give
    // a page up to 8 s to finish fetching its data before the still.
    goto: async (url) => {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: first ? 90_000 : 45_000 });
      first = false;
      await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    },
    click: async (selector) => {
      await page.locator(selector).first().click({ timeout: 5000 });
    },
    fill: async (selector, value) => {
      await page.locator(selector).first().fill(value, { timeout: 5000 });
    },
    wait: async (ms) => {
      await page.waitForTimeout(ms);
    },
    scroll: async (px) => {
      await page.evaluate((y) => window.scrollBy(0, y), px);
    },
    screenshot: async (path) => {
      await page.screenshot({ path, fullPage: false });
    },
    visibleText: async () => {
      return await page
        .locator("body")
        .innerText({ timeout: 3000 })
        .catch(() => "");
    },
  };
  return {
    page: workflowPage,
    close: async () => {
      await context.close();
      await browser.close();
    },
  };
}
