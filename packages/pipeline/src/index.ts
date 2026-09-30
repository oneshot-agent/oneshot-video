/**
 * Stages in order, an events.jsonl per run, gates before render, the #881 result contract.
 * A repo is booted in a sandbox and its pages are shot from outside; a URL is shot as it is.
 * The film is cut from those stills with the launch film's camera moves. The old continuous
 * recording stays as an option (`video: true`) for a deployed URL.
 */
import { progressFrom, ROOT, runDir, updateStatus, type StatusStage } from "./status.ts";
import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import {
  BED_PATH,
  CAPTURE_BEAT_MIN_S,
  CLOSE_HOLD_S,
  ENDTAG_SECONDS,
  TTS_REQUEST,
  WEDGE_TURN_HOLD_S,
  runGates,
  type GateReport,
} from "@oneshot-agent/video-baseline";
import type {
  Explored,
  PageShot,
  Recording,
  RenderResult,
  Scene,
  Script,
  Section,
  StageEvent,
  Stem,
} from "@oneshot-video/shared-types";

export const STAGES = ["boot", "script", "shoot", "narrate", "plan", "gates", "render"] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_NOTES: Record<Stage, string> = {
  boot: "a repo is cloned, installed and started in OneShot's E2B sandbox; a URL skips this",
  script:
    "OneShot webRead(repo or app) → OpenRouter → script.json, then voiceLint / wordsWithinBudget / dontReadTheCommand / silenceRespected",
  shoot:
    "pages chosen from the hint and the landing's links, screenshot at 1920×1080 from outside the box; visible text kept for noTaughtErrors",
  narrate: "ElevenLabs eleven_v3, Sarah, one stem per section; ffprobe measures each stem",
  plan: "scene windows rebuilt from measured stems; a still per capture beat; text cards open and close",
  gates: "every gate in @oneshot-agent/video-baseline; a failure stops the run before render",
  render: "Remotion DemoVideo + DemoVideoSilent; bed at 0.40 under narration, 0.85 alone",
};

export { ROOT, runDir, readStatus, updateStatus, STATUS_STAGES } from "./status.ts";
export type { Status, StatusStage } from "./status.ts";
export const FILM_DIR = resolve(ROOT, "packages/film");

export class EventLog {
  constructor(public readonly path: string) {
    mkdirSync(dirname(path), { recursive: true });
  }
  write(e: Omit<StageEvent, "ts">): StageEvent {
    const full: StageEvent = { ts: new Date().toISOString(), ...e };
    appendFileSync(this.path, JSON.stringify(full) + "\n");
    return full;
  }
}

/** Move the run's status record to a stage; extra fields merge into it. */
export function writeStatus(
  id: string,
  stage: StatusStage,
  extra: Parameters<typeof updateStatus>[1] = {},
): void {
  updateStatus(id, { ...extra, stage });
}

const defaultKind = (i: number, n: number): Scene["kind"] =>
  i === 0 || i === n - 1 ? "text_card" : "capture";

export interface PlanInput {
  recording?: Pick<Recording, "duration_s">;
  /** Stills, in the order the capture beats should show them. Paths are staticFile-relative. */
  stills?: { src: string; width: number; height: number }[];
}

/**
 * Windows come from stems, never from estimates: each section is
 * pause_before + measured stem + pause_after, laid end to end. Capture beats get one slow push,
 * a still (or an offset into the continuous recording), and hold on the UI for CAPTURE_BEAT_MIN_S.
 */
export function planScenes(
  script: Script,
  stems: Stem[],
  input: PlanInput = {},
): { script: Script; scenes: Scene[]; total_seconds: number } {
  const byId = new Map(stems.map((s) => [s.id, s]));
  let cursor = 0;
  const sections: Section[] = [];
  const scenes: Scene[] = [];
  const n = script.sections.length;
  let captureIndex = 0;
  script.sections.forEach((raw, i) => {
    const stem = byId.get(raw.id);
    if (!stem) throw new Error(`planScenes: no stem for section ${raw.id}`);
    const kindOf = raw.kind ?? defaultKind(i, n);
    // The film's holds live in the cues, so the window and the stem stay reconcilable.
    const spoken =
      raw.delivery_cues.pause_before_seconds +
      stem.duration_s +
      raw.delivery_cues.pause_after_seconds;
    const uiHold =
      kindOf === "capture" || kindOf === "terminal" ? Math.max(0, CAPTURE_BEAT_MIN_S - spoken) : 0;
    const hold = (i === 0 ? WEDGE_TURN_HOLD_S : i === n - 1 ? CLOSE_HOLD_S : 0) + uiHold;
    const s: Section = hold
      ? {
          ...raw,
          delivery_cues: {
            ...raw.delivery_cues,
            pause_after_seconds: raw.delivery_cues.pause_after_seconds + hold,
          },
        }
      : raw;
    const start = cursor;
    const end =
      start +
      s.delivery_cues.pause_before_seconds +
      stem.duration_s +
      s.delivery_cues.pause_after_seconds;
    cursor = end;
    sections.push({ ...s, start_seconds: start, end_seconds: end });
    const scene: Scene = {
      id: s.id,
      kind: kindOf,
      start_seconds: start,
      end_seconds: end,
      caption: s.label,
    };
    if (kindOf === "capture") {
      scene.focus = {
        from: [0.5, 0.5, 1],
        to: [0.5, 0.52, 0.9],
        moveStart: 0.2,
        moveEnd: end - start,
      };
      // The writer names the still each beat plays over; without one, beats take stills in order.
      const chosen =
        typeof s.still === "number" && input.stills?.[s.still - 1] ? s.still - 1 : undefined;
      const still =
        input.stills?.[chosen ?? Math.min(captureIndex, (input.stills?.length ?? 1) - 1)];
      if (still) {
        scene.still = still.src;
        scene.still_width = still.width;
        scene.still_height = still.height;
      }
      captureIndex++;
    }
    scenes.push(scene);
  });
  // Footage offsets for the continuous recording, if that is what the beats are cut from.
  if (input.recording && !input.stills?.length) {
    let used = 0;
    for (const sc of scenes) {
      if (sc.kind !== "capture" && sc.kind !== "terminal") continue;
      const len = sc.end_seconds - sc.start_seconds;
      sc.recording_offset_s = Math.max(0, Math.min(used, input.recording.duration_s - len - 0.1));
      used += len;
    }
  }
  scenes.push({
    id: "endtag",
    kind: "endtag",
    start_seconds: cursor,
    end_seconds: cursor + ENDTAG_SECONDS,
  });
  const total_seconds = cursor + ENDTAG_SECONDS;
  return { script: { ...script, sections, total_duration_seconds: cursor }, scenes, total_seconds };
}

export interface RunOptions {
  /** A public GitHub repo to boot in a sandbox, or a deployed app URL. One is required. */
  repo_url?: string;
  app_url?: string;
  ref?: string;
  /** "install: …; start: …; port: N" and any paths to show. */
  setup_hint?: string;
  env?: Record<string, string>;
  length_s?: number;
  silentOnly?: boolean;
  /** Cut the beats from a continuous recording instead of stills (deployed URLs only). */
  video?: boolean;
  /** Run id; also the intake submission id. Defaults to a timestamp. */
  id?: string;
  /** One line from the submitter on what to show. Reaches the script prompt and the page picker. */
  hint?: string;
  /** Reuse this footage instead of booting and shooting again (a re-write of an existing run). */
  explored?: Explored;
  eventsPath?: string;
  outDir?: string;
}

export interface DryRunPlan {
  target: string;
  length_s: number;
  stages: { stage: Stage; note: string }[];
  tts: typeof TTS_REQUEST;
}

export function describePlan(opts: RunOptions): DryRunPlan {
  return {
    target: opts.repo_url ?? opts.app_url ?? "",
    length_s: opts.length_s ?? 30,
    stages: STAGES.map((stage) => ({ stage, note: STAGE_NOTES[stage] })),
    tts: TTS_REQUEST,
  };
}

export function gate(ctx: Parameters<typeof runGates>[0]): GateReport {
  const report = runGates(ctx);
  if (!report.ok) {
    const lines = report.failed.map(
      (k) =>
        `${k}: ${report.results[k].reason}${report.results[k].notes ? " — " + report.results[k].notes?.join("; ") : ""}`,
    );
    throw new Error(`taste gates failed:\n${lines.join("\n")}`);
  }
  return report;
}

export interface Artifacts {
  id: string;
  target: string;
  script: Script;
  stems: Stem[];
  /** What the viewer saw: page stills (default) or a continuous recording. */
  pages?: PageShot[];
  recording?: Recording;
  observed: string[];
  cost_usd?: number;
  boot?: Explored["boot"];
}

function probeDuration(path: string): number {
  const p = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", path],
    { encoding: "utf8" },
  );
  const d = Number.parseFloat(p.stdout.trim());
  if (!Number.isFinite(d)) throw new Error(`ffprobe could not read ${path}`);
  return d;
}

function render(
  composition: "DemoVideo" | "DemoVideoSilent",
  propsPath: string,
  out: string,
  log: EventLog,
): void {
  log.write({ tool: "remotion_render", event: "start", output_path: out, note: composition });
  const t0 = Date.now();
  const r = spawnSync(
    "bunx",
    ["remotion", "render", "src/index.ts", composition, out, `--props=${propsPath}`, "--log=error"],
    { cwd: FILM_DIR, encoding: "utf8" },
  );
  const duration_s = (Date.now() - t0) / 1000;
  if (r.status !== 0) {
    log.write({
      tool: "remotion_render",
      event: "finish",
      output_path: out,
      success: false,
      duration_s,
      note: composition,
    });
    throw new Error(
      `remotion render ${composition} failed: ${(r.stderr || r.stdout).slice(-1200)}`,
    );
  }
  log.write({
    tool: "remotion_render",
    event: "finish",
    output_path: out,
    success: true,
    duration_s,
    cost_usd: 0,
    note: composition,
  });
}

const norm = (x: string) => x.toLowerCase().replace(/\s+/g, " ").trim();

/** plan → gates → render, from artifacts already on disk. run() ends here; so does a re-render. */
export async function finish(
  a: Artifacts,
  opts: { silentOnly?: boolean } = {},
): Promise<RenderResult> {
  const dir = runDir(a.id);
  const log = new EventLog(join(dir, "events.jsonl"));
  const pub = join(FILM_DIR, "public", "runs", a.id);
  mkdirSync(join(pub, "stems"), { recursive: true });

  writeStatus(a.id, "planning");
  const stills = (a.pages ?? []).map((p, i) => {
    const name = `page-${i + 1}.png`;
    copyFileSync(p.png, join(pub, name));
    return { src: `runs/${a.id}/${name}`, width: p.width, height: p.height };
  });
  const { script, scenes, total_seconds } = planScenes(a.script, a.stems, {
    recording: a.recording,
    stills,
  });
  writeFileSync(join(dir, "scenes.json"), JSON.stringify(scenes, null, 2));

  writeStatus(a.id, "gates");
  log.write({ tool: "gates", event: "start" });
  // What the viewer can see. A text card draws its own on_screen lines, so those are observed by
  // construction. A capture beat's on_screen items are the script's expectations of the page: each is
  // checked against the captured text (whitespace and case folded, across element boundaries) and
  // kept only if seen. Nothing false is drawn either way, so an unmet expectation is a note, not a
  // failed film. Commands and URLs in narration stay hard-gated by dontReadTheCommand.
  const blob = norm(a.observed.join(" "));
  const dropped: string[] = [];
  for (const s of script.sections) {
    if ((s.kind ?? "capture") === "text_card" || !s.on_screen?.length) continue;
    const kept = s.on_screen.filter((item) => blob.includes(norm(item)));
    for (const item of s.on_screen) if (!kept.includes(item)) dropped.push(`${s.id}: "${item}"`);
    s.on_screen = kept;
  }
  if (dropped.length)
    log.write({
      tool: "gates",
      event: "start",
      note: `on_screen expectations not seen on the pages, dropped: ${dropped.join("; ")}`,
    });
  const drawn = script.sections
    .filter((s) => (s.kind ?? "capture") === "text_card")
    .flatMap((s) => s.on_screen ?? []);
  const observed = [...a.observed, ...drawn, ...script.sections.flatMap((s) => s.on_screen ?? [])];
  const filmDirs = [join(FILM_DIR, "src")];
  const report = runGates({
    script,
    stems: a.stems,
    observed,
    scenes,
    bedPath: BED_PATH,
    tts: TTS_REQUEST,
    filmDirs,
  });
  const gates = (Object.keys(report.results) as (keyof typeof report.results)[]).map((name) => ({
    name,
    ok: report.results[name].ok,
    reason: report.results[name].reason,
  }));
  writeFileSync(join(dir, "gates.json"), JSON.stringify(report, null, 2));
  log.write({
    tool: "gates",
    event: "finish",
    success: report.ok,
    note: report.failed.join(",") || "all ok",
  });
  if (!report.ok) {
    writeStatus(a.id, "failed", {
      error: `taste gates failed: ${report.failed.join(", ")}`,
      gates,
    });
    gate({
      script,
      stems: a.stems,
      observed,
      scenes,
      bedPath: BED_PATH,
      tts: TTS_REQUEST,
      filmDirs,
    });
  }

  // Everything the composition plays is served by staticFile() from packages/film/public.
  if (a.recording) copyFileSync(a.recording.path, join(pub, "recording.mp4"));
  const stems = a.stems.map((s) => {
    const name = basename(s.path);
    copyFileSync(s.path, join(pub, "stems", name));
    return { ...s, path: `runs/${a.id}/stems/${name}` };
  });
  if (!existsSync(join(FILM_DIR, "public", "score.mp3")))
    copyFileSync(BED_PATH, join(FILM_DIR, "public", "score.mp3"));
  const targetUrl = a.target.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const hostname = (() => {
    try {
      return new URL(a.target.startsWith("http") ? a.target : `https://${a.target}`).hostname;
    } catch {
      return a.target;
    }
  })();
  const target = {
    hostname: hostname === "github.com" ? targetUrl.replace(/^github\.com\//, "") : hostname,
    url: targetUrl,
  };
  const props = {
    script,
    scenes,
    total_seconds,
    stems,
    recording: a.recording
      ? { src: `runs/${a.id}/recording.mp4`, width: a.recording.width, height: a.recording.height }
      : undefined,
    bed: "score.mp3",
    target,
  };
  const propsPath = join(dir, "props.json");
  writeFileSync(propsPath, JSON.stringify(props));

  writeStatus(a.id, "rendering", { gates });
  mkdirSync(join(ROOT, "renders"), { recursive: true });
  const silent = join(ROOT, "renders", `${a.id}-silent.mp4`);
  const voiced = join(ROOT, "renders", `${a.id}-voiced.mp4`);
  render("DemoVideoSilent", propsPath, silent, log);
  if (!opts.silentOnly) {
    render("DemoVideo", propsPath, voiced, log);
    // The two cuts mix differently (voice + ducked bed vs bed alone); identical files mean the
    // voice never reached the render. That shipped unnoticed once; it fails the run now.
    if (readFileSync(voiced).equals(readFileSync(silent)))
      throw new Error(
        "render: the voiced cut is identical to the silent one (no voice in the mix)",
      );
  }

  const cost = a.cost_usd ?? 0;
  const result: RenderResult = {
    video_url: opts.silentOnly ? silent : voiced,
    silent_video_url: silent,
    script,
    scenes,
    cost,
  };
  writeFileSync(
    join(dir, "result.json"),
    JSON.stringify({ ...result, gates, boot: a.boot }, null, 2),
  );
  return result;
}

/** Load a run's artifacts back from disk (script.json, stems/stems.json, explored.json or recording.mp4). */
export function loadArtifacts(id: string, target: string): Artifacts {
  const dir = runDir(id);
  const script = JSON.parse(readFileSync(join(dir, "script.json"), "utf8")) as Script;
  const stems = JSON.parse(readFileSync(join(dir, "stems", "stems.json"), "utf8")) as Stem[];
  const exploredPath = join(dir, "explored.json");
  if (existsSync(exploredPath)) {
    const ex = JSON.parse(readFileSync(exploredPath, "utf8")) as Explored;
    return {
      id,
      target,
      script,
      stems,
      pages: ex.pages.map((p) => ({ ...p, png: resolve(dir, p.png) })),
      observed: ex.observed,
      boot: ex.boot,
    };
  }
  const rec = join(dir, "recording.mp4");
  const observedPath = join(dir, "observed.json");
  const observed = existsSync(observedPath)
    ? (JSON.parse(readFileSync(observedPath, "utf8")) as string[])
    : [];
  return {
    id,
    target,
    script,
    stems,
    recording: {
      path: rec,
      width: 1920,
      height: 1080,
      fps: 30,
      duration_s: probeDuration(rec),
      observed,
    },
    observed,
  };
}

/** The full run. Clients are resolved lazily so --dry-run and tests never import them. */
export async function run(opts: RunOptions): Promise<RenderResult> {
  if (!opts.repo_url && !opts.app_url) throw new Error("run(): repo_url or app_url is required");
  const id = opts.id ?? new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19).toLowerCase();
  const dir = runDir(id);
  mkdirSync(dir, { recursive: true });
  const log = new EventLog(opts.eventsPath ?? join(dir, "events.jsonl"));
  const progress = progressFrom(id);
  const say = (line: string) => {
    log.write({ tool: "explore", event: "start", note: line });
    progress.line(line);
  };
  const length_s = opts.length_s ?? 30;
  const target = opts.repo_url ?? (opts.app_url as string);

  const { buildScript } = await import("@oneshot-video/script");
  const { localWebRead, oneshotWebRead, openRouterLlm } =
    await import("@oneshot-video/script/clients");
  const { narrate } = await import("@oneshot-video/narrate");
  const { elevenLabsTts } = await import("@oneshot-video/narrate/clients");

  // 1. boot + shoot (or record). The app is what the film is about; read it before writing a word.
  writeStatus(id, opts.repo_url ? "booting" : "shooting");
  log.write({ tool: "explore", event: "start" });
  const t0 = Date.now();
  let pages: PageShot[] | undefined;
  let recording: Recording | undefined;
  let observed: string[] = [];
  let boot: Explored["boot"];
  let harness: Explored["harness"];
  if (opts.video && opts.app_url && !opts.repo_url) {
    const { record } = await import("@oneshot-video/record");
    const rec = await record({ app_url: opts.app_url, outDir: join(dir, "recording") });
    copyFileSync(rec.path, join(dir, "recording.mp4"));
    writeFileSync(join(dir, "observed.json"), JSON.stringify(rec.observed));
    recording = {
      ...rec,
      path: join(dir, "recording.mp4"),
      duration_s: probeDuration(join(dir, "recording.mp4")),
    };
    observed = rec.observed;
  } else {
    const { explore, pathsFromHint } = await import("@oneshot-video/explore");
    const ex =
      opts.explored ??
      (await explore({
        repo_url: opts.repo_url,
        app_url: opts.app_url,
        ref: opts.ref,
        setup_hint: opts.setup_hint,
        env: opts.env,
        hint: opts.hint,
        want: pathsFromHint(`${opts.hint ?? ""} ${opts.setup_hint ?? ""}`),
        runDir: dir,
        log: say,
      }));
    progress.flush();
    pages = ex.pages;
    observed = ex.observed;
    boot = ex.boot;
    harness = ex.harness;
    pages = selectStills(pages);
    // Narration and a render cost money and minutes; a film with no footage is not worth either.
    if (!pages.length)
      throw new Error(
        "shooting: the camera got no stills (every page failed to load); nothing to film",
      );
    // Stills that all show the same screen (a welcome dialog, a login wall, a spinner) give the
    // script nothing true to say, and it will say something anyway. Stop here instead.
    const screens = new Set(
      pages.filter((p) => p.text?.length).map((p) => (p.text ?? []).slice(0, 30).join("\n")),
    );
    if (pages.length >= 3 && screens.size === 1)
      throw new Error(
        `shooting: all ${pages.length} stills show the same screen ("${[...screens][0]?.split("\n")[0]?.slice(0, 60)}"): the workflow never got past it; nothing true to film`,
      );
  }
  log.write({
    tool: "explore",
    event: "finish",
    success: true,
    duration_s: (Date.now() - t0) / 1000,
    note: `${pages?.length ?? 0} pages${boot ? ` · ${boot.backend} ${boot.mode ?? ""} boot ${boot.seconds.toFixed(1)}s` : ""}${boot?.harness_note ? ` · harness: ${boot.harness_note}` : ""}`,
  });

  // 2. script, from what the app says about itself plus what its pages show.
  writeStatus(id, "script");
  log.write({ tool: "script", event: "start" });
  let webRead = localWebRead();
  let reader = "local-fetch";
  try {
    webRead = oneshotWebRead();
    reader = "oneshot-webread";
  } catch {
    /* no wallet key: the local reader stays */
  }
  const pageText = observed
    .filter((l) => !/^https?:\/\//.test(l))
    .slice(0, 400)
    .join("\n");
  // What the harness agent learned from the code comes before what the pages show.
  const fromCode = harness
    ? [
        "## What the app is (read from its code by the sandbox agent)",
        `${harness.app.name}: ${harness.app.what_it_does}`,
        harness.app.wedge_hint ? `Wedge: ${harness.app.wedge_hint}` : "",
        harness.app.proof_hint ? `Proof on screen: ${harness.app.proof_hint}` : "",
        harness.seeded?.length ? `Demo data: ${harness.seeded.join("; ")}` : "",
        "Workflow shot, in order:",
        ...harness.workflow.map((w, i) => `${i + 1}. ${w.path} — ${w.caption}`),
      ]
        .filter(Boolean)
        .join("\n")
    : "";
  const withPages =
    (wr: typeof webRead): typeof webRead =>
    async (url) => {
      const r = await wr(url);
      return {
        ...r,
        markdown: `${r.markdown}${fromCode ? `\n\n${fromCode}` : ""}\n\n## What the app's pages show (captured)\n${pageText}${opts.hint ? `\n\n## The submitter asked to show\n${opts.hint}` : ""}`,
      };
    };
  let scriptResult: { script: Script; cost_usd: number };
  try {
    scriptResult = await buildScript({
      app_url: target,
      length_s,
      webRead: withPages(webRead),
      llm: openRouterLlm(),
      stills: pages?.map((p) => ({ png: p.png, caption: p.title })),
    });
  } catch (e) {
    if (reader === "oneshot-webread" && /payment/i.test(String(e))) {
      log.write({
        tool: "script",
        event: "finish",
        success: false,
        note: `oneshot-webread: ${String(e).slice(0, 160)}; retrying with local-fetch`,
      });
      reader = "local-fetch";
      scriptResult = await buildScript({
        app_url: target,
        length_s,
        webRead: withPages(localWebRead()),
        llm: openRouterLlm(),
        stills: pages?.map((p) => ({ png: p.png, caption: p.title })),
      });
    } else throw e;
  }
  writeFileSync(join(dir, "script.json"), JSON.stringify(scriptResult.script, null, 2));
  log.write({
    tool: "script",
    event: "finish",
    success: true,
    cost_usd: scriptResult.cost_usd,
    output_path: join(dir, "script.json"),
    note: reader,
  });

  // 3. narrate
  writeStatus(id, "narrating");
  log.write({ tool: "elevenlabs_tts", event: "start" });
  const t1 = Date.now();
  const stems = await narrate(scriptResult.script, {
    outDir: join(dir, "stems"),
    tts: elevenLabsTts(),
  });
  log.write({
    tool: "elevenlabs_tts",
    event: "finish",
    success: true,
    duration_s: (Date.now() - t1) / 1000,
    note: `${stems.length} stems`,
  });

  return finish(
    {
      id,
      target,
      script: scriptResult.script,
      stems,
      pages,
      recording,
      observed,
      cost_usd: scriptResult.cost_usd,
      boot,
    },
    { silentOnly: opts.silentOnly },
  );
}

/**
 * The stills worth filming: drops an exact repeat of an earlier still, and a still whose visible
 * text is wholly contained in the next one's (the same screen caught mid-load). Stills without
 * recorded text are kept as they are.
 */
export function selectStills<T extends { text?: string[] }>(pages: T[]): T[] {
  const key = (p: T) => (p.text ?? []).join("\n");
  const out: T[] = [];
  pages.forEach((p, i) => {
    if (!p.text?.length) return void out.push(p);
    if (out.some((q) => q.text?.length && key(q) === key(p))) return;
    const next = pages[i + 1];
    if (next?.text?.length && key(next) !== key(p)) {
      const nextSet = new Set(next.text);
      if (p.text.every((t) => nextSet.has(t))) return;
    }
    out.push(p);
  });
  return out.length ? out : pages;
}
