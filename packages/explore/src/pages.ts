/**
 * The camera, outside the box. Given a base URL, choose a handful of pages, screenshot each at
 * film size and keep the visible text, so the gates can check what the viewer saw.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { FPS, HEIGHT, WIDTH } from "@oneshot-agent/video-baseline";
import type { PageShot } from "@oneshot-video/shared-types";
import { dismissOverlays } from "./overlays.ts";

const SKIP =
  /(logout|signout|sign-out|login|signin|sign-in|register|mailto:|tel:|\.(pdf|zip|png|jpg|svg)$|#)/i;

export interface PagesOptions {
  base_url: string;
  outDir: string;
  /** Paths the submitter asked for, e.g. "/dashboard, /receipts". Taken first. */
  want?: string[];
  max?: number;
  settleMs?: number;
  log?: (line: string) => void;
}

export interface PagesResult {
  pages: PageShot[];
  observed: string[];
}

export async function shootPages(opts: PagesOptions): Promise<PagesResult> {
  const pw = await import("playwright");
  const log = opts.log ?? (() => {});
  const max = opts.max ?? 4;
  mkdirSync(opts.outDir, { recursive: true });
  const browser = await pw.chromium.launch();
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const base = new URL(opts.base_url);
  const observed = new Set<string>();
  const pages: PageShot[] = [];
  const snapshot = async () => {
    const text = await page
      .locator("body")
      .innerText({ timeout: 3000 })
      .catch(() => "");
    for (const line of text.split(/\n+/)) {
      const t = line.replace(/\s+/g, " ").trim();
      if (t.length >= 2 && t.length <= 240) observed.add(t);
    }
  };
  const shoot = async (url: string, i: number) => {
    await page
      .goto(url, { waitUntil: "networkidle", timeout: 45_000 })
      .catch(() => page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 }));
    await page.waitForTimeout(opts.settleMs ?? 1800);
    await dismissOverlays(page);
    observed.add(page.url());
    await snapshot();
    const png = join(opts.outDir, `page-${i}.png`);
    await page.screenshot({ path: png, fullPage: false });
    const shot: PageShot = {
      url: page.url(),
      path: new URL(page.url()).pathname,
      title: await page.title(),
      png,
      width: WIDTH,
      height: HEIGHT,
    };
    pages.push(shot);
    log(`shot ${i} ${shot.path} "${shot.title.slice(0, 60)}"`);
    return shot;
  };
  await shoot(base.toString(), 1);
  // Candidate pages: what the submitter asked for, then same-origin links from the landing in document order.
  const wanted = (opts.want ?? []).map((p) =>
    p.startsWith("http") ? p : new URL(p, base).toString(),
  );
  const links = await page
    .locator("a[href]")
    .evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).href));
  const sameOrigin = links.filter((h) => {
    try {
      return new URL(h).origin === base.origin;
    } catch {
      return false;
    }
  });
  const seen = new Set([base.toString(), base.toString().replace(/\/$/, "")]);
  const candidates = [...wanted, ...sameOrigin].filter((h) => {
    const clean = h.replace(/[#?].*$/, "").replace(/\/$/, "");
    if (!clean || seen.has(clean) || SKIP.test(h)) return false;
    seen.add(clean);
    return true;
  });
  for (const url of candidates) {
    if (pages.length >= max) break;
    await shoot(url, pages.length + 1).catch((e) =>
      log(`skip ${url}: ${String(e.message).slice(0, 80)}`),
    );
  }
  await context.close();
  await browser.close();
  void FPS;
  return { pages, observed: [...observed] };
}
