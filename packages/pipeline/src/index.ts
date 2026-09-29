/**
 * Stages in order, an events.jsonl per run, gates before render, the #881 result contract.
 * script → record → narrate → plan → gates → render. --dry-run prints the plan and returns before any paid call.
 */
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
  WEDGE_TURN_HOLD_S,
  ENDTAG_SECONDS,
  TTS_REQUEST,
  runGates,
  type GateReport,
} from "@oneshot-agent/video-baseline";
import type {
  Recording,
  RenderResult,
  Scene,
  Script,
  Section,
  StageEvent,
  Stem,
} from "@oneshot-video/shared-types";

export const STAGES = ["script", "record", "narrate", "plan", "gates", "render"] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_NOTES: Record<Stage, string> = {
  script:
    "OneShot webRead(app_url) → OpenRouter → script.json, then voiceLint / dontReadTheCommand / silenceRespected",
  record:
    "Playwright drives flow.json against app_url at 1920×1080 and records; emits observed[] for noTaughtErrors",
  narrate: "ElevenLabs eleven_v3, Sarah, one stem per section; ffprobe measures each stem",
  plan: "scene windows rebuilt from measured stems; text cards open and close, captured pixels between",
  gates: "every gate in @oneshot-agent/video-baseline; a failure stops the run before render",
  render: "Remotion DemoVideo + DemoVideoSilent; bed at 0.40 under narration, 0.85 alone",
};

export const ROOT = process.env["ONESHOT_VIDEO_ROOT"] ?? process.cwd();
export const FILM_DIR = resolve(ROOT, "packages/film");
export const runDir = (id: string) => join(ROOT, "runs", id);

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

/** The line the intake status page reads. Same shape as apps/intake's Status. */
export function writeStatus(id: string, stage: string, extra: Record<string, unknown> = {}): void {
  mkdirSync(runDir(id), { recursive: true });
  writeFileSync(
    join(runDir(id), "status.json"),
    JSON.stringify({ id, stage, updated: new Date().toISOString(), ...extra }, null, 2),
  );
}

const defaultKind = (i: number, n: number): Scene["kind"] =>
  i === 0 || i === n - 1 ? "text_card" : "capture";

/**
 * Windows come from stems, never from estimates: each section is
 * pause_before + measured stem + pause_after, laid end to end. Capture scenes get one slow
 * push and an offset into the continuous recording.
 */
export function planScenes(
  script: Script,
  stems: Stem[],
  recording?: Pick<Recording, "duration_s">,
): { script: Script; scenes: Scene[]; total_seconds: number } {
  const byId = new Map(stems.map((s) => [s.id, s]));
  let cursor = 0;
  const sections: Section[] = [];
  const scenes: Scene[] = [];
  const n = script.sections.length;
  script.sections.forEach((raw, i) => {
    const stem = byId.get(raw.id);
    if (!stem) throw new Error(`planScenes: no stem for section ${raw.id}`);
    // The film's holds live in the cues, so the window and the stem stay reconcilable.
    const kindOf = raw.kind ?? defaultKind(i, n);
    // A capture beat holds on the UI for CAPTURE_BEAT_MIN_S even when the voice is done sooner.
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
    const kind = kindOf;
    const scene: Scene = {
      id: s.id,
      kind,
      start_seconds: start,
      end_seconds: end,
      caption: s.label,
    };
    if (kind === "capture")
      scene.focus = {
        from: [0.5, 0.5, 1],
        to: [0.5, 0.52, 0.9],
        moveStart: 0.2,
        moveEnd: end - start,
      };
    scenes.push(scene);
  });
  // Footage offsets: capture beats read the recording in order. If the recording is shorter
  // than the beats need, the last beats slide back so nothing seeks past the end.
  if (recording) {
    let used = 0;
    for (const sc of scenes) {
      if (sc.kind !== "capture" && sc.kind !== "terminal") continue;
      const len = sc.end_seconds - sc.start_seconds;
      sc.recording_offset_s = Math.max(0, Math.min(used, recording.duration_s - len - 0.1));
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
  app_url: string;
  length_s?: number;
  silentOnly?: boolean;
  /** Run id; also the intake submission id. Defaults to a timestamp. */
  id?: string;
  /** One line from the submitter on what to show. Reaches the script prompt. */
  hint?: string;
  eventsPath?: string;
}

export interface DryRunPlan {
  app_url: string;
  length_s: number;
  stages: { stage: Stage; note: string }[];
  tts: typeof TTS_REQUEST;
}

export function describePlan(opts: RunOptions): DryRunPlan {
  return {
    app_url: opts.app_url,
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
  app_url: string;
  script: Script;
  stems: Stem[];
  recording: Recording;
  cost_usd?: number;
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
  id: string,
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

/** plan → gates → render, from artifacts already on disk. run() ends here; so does a re-render. */
export async function finish(
  a: Artifacts,
  opts: { silentOnly?: boolean } = {},
): Promise<RenderResult> {
  const dir = runDir(a.id);
  const log = new EventLog(join(dir, "events.jsonl"));

  writeStatus(a.id, "planning");
  const { script, scenes, total_seconds } = planScenes(a.script, a.stems, a.recording);
  writeFileSync(join(dir, "scenes.json"), JSON.stringify(scenes, null, 2));

  writeStatus(a.id, "gates");
  log.write({ tool: "gates", event: "start" });
  // What the viewer can see. A text card draws its own on_screen lines, so those are observed by
  // construction. A capture beat's on_screen items are the script's expectations of the page: each is
  // checked against the recorded text (whitespace and case folded, across element boundaries) and
  // kept only if seen. Nothing false is drawn either way, so an unmet expectation is a note, not a
  // failed film. Commands and URLs in narration stay hard-gated by dontReadTheCommand.
  const norm = (x: string) => x.toLowerCase().replace(/\s+/g, " ").trim();
  const blob = norm(a.recording.observed.join(" "));
  const dropped: string[] = [];
  for (const s of script.sections) {
    if ((s.kind ?? "capture") === "text_card" || !s.on_screen?.length) continue;
    const kept = s.on_screen.filter((item) => blob.includes(norm(item)));
    for (const item of s.on_screen) if (!kept.includes(item)) dropped.push(`${s.id}: "${item}"`);
    s.on_screen = kept;
  }
  if (dropped.length) {
    log.write({
      tool: "gates",
      event: "start",
      note: `on_screen expectations not seen in the recording, dropped: ${dropped.join("; ")}`,
    });
  }
  const drawn = script.sections
    .filter((s) => (s.kind ?? "capture") === "text_card")
    .flatMap((s) => s.on_screen ?? []);
  const observed = [
    ...a.recording.observed,
    ...drawn,
    ...script.sections.flatMap((s) => s.on_screen ?? []),
  ];
  const report = runGates({
    script,
    stems: a.stems,
    observed,
    scenes,
    bedPath: BED_PATH,
    tts: TTS_REQUEST,
    filmDirs: [join(FILM_DIR, "src")],
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
      filmDirs: [join(FILM_DIR, "src")],
    });
  }

  // Everything the composition plays is served by staticFile() from packages/film/public.
  const pub = join(FILM_DIR, "public", "runs", a.id);
  mkdirSync(join(pub, "stems"), { recursive: true });
  copyFileSync(a.recording.path, join(pub, "recording.mp4"));
  const stems = a.stems.map((s) => {
    const name = basename(s.path);
    copyFileSync(s.path, join(pub, "stems", name));
    return { ...s, path: `runs/${a.id}/stems/${name}` };
  });
  if (!existsSync(join(FILM_DIR, "public", "score.mp3")))
    copyFileSync(BED_PATH, join(FILM_DIR, "public", "score.mp3"));
  const target = {
    hostname: new URL(a.app_url).hostname,
    url: a.app_url.replace(/^https?:\/\//, "").replace(/\/$/, ""),
  };
  const props = {
    script,
    scenes,
    total_seconds,
    stems,
    recording: {
      src: `runs/${a.id}/recording.mp4`,
      width: a.recording.width,
      height: a.recording.height,
    },
    bed: "score.mp3",
    target,
  };
  const propsPath = join(dir, "props.json");
  writeFileSync(propsPath, JSON.stringify(props));

  writeStatus(a.id, "rendering", { gates });
  mkdirSync(join(ROOT, "renders"), { recursive: true });
  const silent = join(ROOT, "renders", `${a.id}-silent.mp4`);
  const voiced = join(ROOT, "renders", `${a.id}-voiced.mp4`);
  render(a.id, "DemoVideoSilent", propsPath, silent, log);
  if (!opts.silentOnly) render(a.id, "DemoVideo", propsPath, voiced, log);

  const cost = a.cost_usd ?? 0;
  const result: RenderResult = {
    video_url: opts.silentOnly ? silent : voiced,
    silent_video_url: silent,
    script,
    scenes,
    cost,
  };
  writeFileSync(join(dir, "result.json"), JSON.stringify({ ...result, gates }, null, 2));
  return result;
}

/** Load a run's artifacts back from disk (script.json, stems/stems.json, recording.mp4). */
export function loadArtifacts(id: string, app_url: string): Artifacts {
  const dir = runDir(id);
  const script = JSON.parse(readFileSync(join(dir, "script.json"), "utf8")) as Script;
  const stems = JSON.parse(readFileSync(join(dir, "stems", "stems.json"), "utf8")) as Stem[];
  const rec = join(dir, "recording.mp4");
  const observedPath = join(dir, "observed.json");
  const observed = existsSync(observedPath)
    ? (JSON.parse(readFileSync(observedPath, "utf8")) as string[])
    : [];
  return {
    id,
    app_url,
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
  };
}

/** The full run. Clients are resolved lazily so --dry-run and tests never import them. */
export async function run(opts: RunOptions): Promise<RenderResult> {
  const id = opts.id ?? new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19).toLowerCase();
  const dir = runDir(id);
  mkdirSync(dir, { recursive: true });
  const log = new EventLog(opts.eventsPath ?? join(dir, "events.jsonl"));
  const length_s = opts.length_s ?? 30;

  const { buildScript } = await import("@oneshot-video/script");
  const { localWebRead, oneshotWebRead, openRouterLlm } =
    await import("@oneshot-video/script/clients");
  const { record } = await import("@oneshot-video/record");
  const { narrate } = await import("@oneshot-video/narrate");
  const { elevenLabsTts } = await import("@oneshot-video/narrate/clients");

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
  let scriptResult: { script: Script; cost_usd: number };
  try {
    scriptResult = await buildScript({
      app_url: opts.app_url,
      length_s,
      webRead,
      llm: openRouterLlm(),
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
        app_url: opts.app_url,
        length_s,
        webRead: localWebRead(),
        llm: openRouterLlm(),
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

  writeStatus(id, "recording");
  log.write({ tool: "record", event: "start" });
  const t0 = Date.now();
  const rec = await record({ app_url: opts.app_url, outDir: join(dir, "recording") });
  copyFileSync(rec.path, join(dir, "recording.mp4"));
  writeFileSync(join(dir, "observed.json"), JSON.stringify(rec.observed));
  const recording: Recording = {
    ...rec,
    path: join(dir, "recording.mp4"),
    duration_s: probeDuration(join(dir, "recording.mp4")),
  };
  log.write({
    tool: "record",
    event: "finish",
    success: true,
    output_path: recording.path,
    duration_s: (Date.now() - t0) / 1000,
  });

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
      app_url: opts.app_url,
      script: scriptResult.script,
      stems,
      recording,
      cost_usd: scriptResult.cost_usd,
    },
    { silentOnly: opts.silentOnly },
  );
}
