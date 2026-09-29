/**
 * Drive the app's main flow and record it. Local Playwright today; OneShot's browser agent in
 * the compute tier later (#881). The URL has to be reachable from here — localhost on someone
 * else's laptop is not; a cloudflared or ngrok tunnel is.
 */
import { spawnSync } from "node:child_process";
import { FPS, HEIGHT, WIDTH } from "@oneshot-agent/video-baseline";
import type { Recording } from "@oneshot-video/shared-types";

export type FlowStep =
  | { op: "goto"; url: string }
  | { op: "wait"; ms: number }
  | { op: "click"; selector: string }
  | { op: "fill"; selector: string; value: string }
  | { op: "scroll"; dy: number };

export interface Flow {
  steps: FlowStep[];
}

/**
 * Land, let it settle, read down the page in three moves, open the first real link, settle
 * again. About 25 s of footage: three capture beats of six seconds or more, plus slack for the cut.
 */
export function defaultFlow(url: string): Flow {
  return {
    steps: [
      { op: "goto", url },
      { op: "wait", ms: 2600 },
      { op: "scroll", dy: 520 },
      { op: "wait", ms: 2400 },
      { op: "scroll", dy: 640 },
      { op: "wait", ms: 2400 },
      { op: "scroll", dy: 760 },
      { op: "wait", ms: 2200 },
      {
        op: "click",
        selector:
          "main a[href^='/']:not([href='/']), nav a[href^='/']:not([href='/']), a[href^='/']:not([href='/']) >> nth=0",
      },
      { op: "wait", ms: 3200 },
      { op: "scroll", dy: 480 },
      { op: "wait", ms: 2600 },
      { op: "scroll", dy: 520 },
      { op: "wait", ms: 2400 },
    ],
  };
}

export interface RecordOptions {
  app_url: string;
  flow?: Flow;
  outDir: string;
}

export async function record(opts: RecordOptions): Promise<Recording> {
  let pw: typeof import("playwright");
  try {
    pw = await import("playwright");
  } catch {
    throw new Error(
      "record: playwright is not installed. `bun add playwright && bunx playwright install chromium`, or pass a recording to the pipeline.",
    );
  }
  const flow = opts.flow ?? defaultFlow(opts.app_url);
  const browser = await pw.chromium.launch();
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    recordVideo: { dir: opts.outDir, size: { width: WIDTH, height: HEIGHT } },
  });
  const page = await context.newPage();
  const observed = new Set<string>();
  page.on("framenavigated", (f) => observed.add(f.url()));
  /** Visible text after each step, one line per entry, so the noTaughtErrors gate can check what the viewer actually saw. */
  const snapshotText = async () => {
    const text = await page
      .locator("body")
      .innerText({ timeout: 2000 })
      .catch(() => "");
    for (const line of text.split(/\n+/)) {
      const t = line.replace(/\s+/g, " ").trim();
      if (t.length >= 2 && t.length <= 240) observed.add(t);
    }
  };
  const t0 = Date.now();
  for (const step of flow.steps) {
    if (step.op === "goto") await page.goto(step.url, { waitUntil: "networkidle" });
    else if (step.op === "wait") await page.waitForTimeout(step.ms);
    else if (step.op === "click")
      await page
        .locator(step.selector)
        .first()
        .click({ timeout: 5000 })
        .catch(() => undefined);
    else if (step.op === "fill") await page.locator(step.selector).first().fill(step.value);
    else if (step.op === "scroll") await page.mouse.wheel(0, step.dy);
    if (step.op !== "wait") await snapshotText();
  }
  await snapshotText();
  const video = page.video();
  await context.close();
  await browser.close();
  const webm = (await video?.path()) ?? "";
  const mp4 = webm.replace(/\.webm$/, ".mp4");
  const ff = spawnSync(
    "ffmpeg",
    ["-y", "-i", webm, "-r", String(FPS), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", mp4],
    { encoding: "utf8" },
  );
  if (ff.status !== 0) throw new Error(`ffmpeg: ${ff.stderr.slice(-400)}`);
  return {
    path: mp4,
    width: WIDTH,
    height: HEIGHT,
    fps: FPS,
    duration_s: (Date.now() - t0) / 1000,
    observed: [...observed],
  };
}
