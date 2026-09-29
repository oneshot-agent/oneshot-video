/**
 * Stages in order, an events.jsonl per run, gates before render, the #881 result contract.
 * --dry-run prints the plan and returns before any paid call.
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import {
  ENDTAG_SECONDS,
  TTS_REQUEST,
  runGates,
  type GateReport,
} from "@oneshot-agent/video-baseline";
import type { Scene, Script, Section, StageEvent, Stem } from "@oneshot-video/shared-types";

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

const defaultKind = (i: number, n: number): Scene["kind"] =>
  i === 0 || i === n - 1 ? "text_card" : "capture";

/**
 * Windows come from stems, never from estimates: each section is
 * pause_before + measured stem + pause_after, laid end to end.
 */
export function planScenes(
  script: Script,
  stems: Stem[],
): { script: Script; scenes: Scene[]; total_seconds: number } {
  const byId = new Map(stems.map((s) => [s.id, s]));
  let cursor = 0;
  const sections: Section[] = [];
  const scenes: Scene[] = [];
  const n = script.sections.length;
  script.sections.forEach((s, i) => {
    const stem = byId.get(s.id);
    if (!stem) throw new Error(`planScenes: no stem for section ${s.id}`);
    const start = cursor;
    const end =
      start +
      s.delivery_cues.pause_before_seconds +
      stem.duration_s +
      s.delivery_cues.pause_after_seconds;
    cursor = end;
    sections.push({ ...s, start_seconds: start, end_seconds: end });
    scenes.push({
      id: s.id,
      kind: s.kind ?? defaultKind(i, n),
      start_seconds: start,
      end_seconds: end,
      caption: s.label,
    });
  });
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
  dryRun?: boolean;
  silentOnly?: boolean;
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

/** The full run is wired once the stages have real clients. Today it plans, and stops. */
export async function run(opts: RunOptions): Promise<DryRunPlan> {
  const plan = describePlan(opts);
  if (opts.dryRun) return plan;
  throw new Error(
    "run(): stages script/record/narrate/render need ELEVENLABS_API_KEY, OPENROUTER_API_KEY, ONESHOT_PRIVATE_KEY and are wired on Hack Day. Use --dry-run.",
  );
}
