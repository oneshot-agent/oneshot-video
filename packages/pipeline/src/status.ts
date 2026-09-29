/**
 * One status record per run, at runs/<id>/status.json. The intake page, its JSON twin, the MCP
 * status tool and the CLI all read this file; the pipeline and the runner write it. Updates merge,
 * and every write is atomic (tmp + rename) so a poll never reads half a file.
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

export const ROOT = process.env["ONESHOT_VIDEO_ROOT"] ?? process.cwd();
export const runDir = (id: string) => join(ROOT, "runs", id);
export const statusPath = (id: string) => join(runDir(id), "status.json");

/** The order run() executes them. A URL run skips booting. */
export const STATUS_STAGES = [
  "queued",
  "booting",
  "shooting",
  "script",
  "narrating",
  "planning",
  "gates",
  "rendering",
  "done",
] as const;
export type StatusStage = (typeof STATUS_STAGES)[number] | "failed";

export const STATUS_NOTES: Record<StatusStage, string> = {
  queued: "waiting its turn",
  booting: "an agent in a sandbox is installing the app, seeding it and choosing what to show",
  shooting: "the camera, outside the box, is taking a still of each step",
  script: "reading the app and what the pages show, writing the words",
  narrating: "Sarah reads each section; the stems are measured",
  planning: "scene timings from the measured stems",
  gates: "eleven taste checks before anything renders",
  rendering: "Remotion: a voiced cut and a silent cut",
  done: "done",
  failed: "stopped",
};

export const HARNESS_MAX_TURNS = 50;

export interface StatusStep {
  stage: StatusStage;
  started: string;
  finished?: string;
}

export interface Status {
  id: string;
  stage: StatusStage;
  updated: string;
  started?: string;
  /** The latest human-readable line. */
  detail?: string;
  steps?: StatusStep[];
  harness?: {
    turn: number;
    max: number;
    notes?: string[];
    plan?: {
      app: { name: string; what_it_does: string };
      workflow: { path: string; caption: string }[];
    };
  };
  /** Run-relative PNG paths, in the order they were shot. */
  stills?: string[];
  error?: string;
  video?: string;
  silent?: string;
  cost_usd?: number;
  gates?: { name: string; ok: boolean; reason: string }[];
}

export function readStatus(id: string): Status {
  const p = statusPath(id);
  if (!existsSync(p)) return { id, stage: "queued", updated: "" };
  try {
    return JSON.parse(readFileSync(p, "utf8")) as Status;
  } catch {
    return { id, stage: "queued", updated: "" };
  }
}

function writeAtomic(id: string, s: Status): void {
  mkdirSync(runDir(id), { recursive: true });
  const tmp = `${statusPath(id)}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(s, null, 2));
  renameSync(tmp, statusPath(id));
}

/**
 * Merge a patch into the record. A new stage closes the previous step and opens the next, so the
 * page can show how long each one took.
 */
export function updateStatus(id: string, patch: Partial<Omit<Status, "id">>): Status {
  const cur = readStatus(id);
  const now = new Date().toISOString();
  const next: Status = { ...cur, ...patch, id, updated: now, started: cur.started ?? now };
  // A missing record reads as "queued", so the first write opens its step too.
  if (patch.stage && (patch.stage !== cur.stage || !cur.steps?.length)) {
    const steps = (cur.steps ?? []).map((s) => (s.finished ? s : { ...s, finished: now }));
    if (patch.stage !== "done" && patch.stage !== "failed")
      steps.push({ stage: patch.stage, started: now });
    next.steps = steps;
    if (patch.detail === undefined) next.detail = undefined;
  }
  writeAtomic(id, next);
  return next;
}

/** Stills explore has written so far, run-relative, in shot order. */
function stillsOn(id: string): string[] {
  const dir = join(runDir(id), "pages");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".png") && !f.endsWith("-s.png"))
    .map((f) => ({ f, t: statSync(join(dir, f)).mtimeMs }))
    .toSorted((a, b) => a.t - b.t)
    .map(({ f }) => `pages/${f}`);
}

/** What the harness agent has written so far: its notes (copied out mid-run) and its plan. */
function harnessOn(id: string, turn: number): NonNullable<Status["harness"]> | undefined {
  const notesPath = join(runDir(id), "harness-notes.md");
  const planPath = join(runDir(id), "harness-demo-plan.json");
  if (!turn && !existsSync(notesPath)) return undefined;
  const notes = existsSync(notesPath)
    ? readFileSync(notesPath, "utf8")
        .split("\n")
        .filter((l) => !l.trimStart().startsWith("#"))
        .map((l) => l.replace(/^[-*\s]+/, "").trim())
        .filter((l) => l.length > 3)
        .slice(-10)
    : undefined;
  let plan: NonNullable<Status["harness"]>["plan"];
  try {
    const p = JSON.parse(readFileSync(planPath, "utf8")) as NonNullable<Status["harness"]>["plan"];
    if (p?.app && Array.isArray(p.workflow))
      plan = { app: p.app, workflow: p.workflow.map(({ path, caption }) => ({ path, caption })) };
  } catch {
    /* not written yet */
  }
  return { turn, max: HARNESS_MAX_TURNS, notes, plan };
}

/**
 * Turns the pipeline's log lines into status fields. Explore already says what it is doing
 * ("harness turn 23 · 81s", `shot 2 /queue "Queue"`); this keeps the latest line as the detail,
 * picks up the turn count, and reads the stills and the agent's notes from the run dir. At most
 * one write a second.
 */
export function progressFrom(id: string, now: () => number = Date.now) {
  let last = Number.NEGATIVE_INFINITY;
  let turn = readStatus(id).harness?.turn ?? 0;
  let detail: string | undefined;
  let stage: StatusStage | undefined;
  const flush = () => {
    const harness = harnessOn(id, turn);
    updateStatus(id, {
      ...(stage ? { stage } : {}),
      ...(detail ? { detail } : {}),
      ...(harness ? { harness } : {}),
      stills: stillsOn(id),
    });
    last = now();
  };
  return {
    line(line: string) {
      const t = /^harness turn (\d+)/.exec(line);
      if (t?.[1]) {
        turn = Number(t[1]);
        detail = `the agent is on turn ${turn} of ${HARNESS_MAX_TURNS}`;
      } else if (!line.startsWith("$ ")) detail = line.slice(0, 200);
      // The app answered: from here the camera is working, not the sandbox.
      const up = /^(harness ready|up on port)/.test(line) && readStatus(id).stage === "booting";
      if (up) stage = "shooting";
      if (up || now() - last >= 1000) flush();
      stage = undefined;
    },
    flush,
  };
}
