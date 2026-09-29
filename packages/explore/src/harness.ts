/**
 * The harness: OneShot's sandbox agent (run-agent.ts, baked into the E2B template) prepares the
 * repo for its film inside the box — clone, read, seed or switch on a demo mode, start, and pick
 * the workflow — and writes /home/user/output/demo-plan.json. Driven the way
 * one-shot/apps/worker-service/agent_tier/executor.py drives it: AGENT.md + task.json + a wrapper
 * that touches a sentinel, polled from here. No ONESHOT_API_URL, so no pre-flight and no paid tools.
 */
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { APP_DIR, openSandbox, portAnswers, startProxy, type Box } from "./boot.ts";
import { validateDemoPlan, type DemoPlan } from "./demo-plan.ts";
import { buildTask } from "./task.ts";

export const HARNESS_CAP_S = Number(process.env["HARNESS_CAP_S"] ?? 480);
const AGENT_MD_PATH = join(import.meta.dirname, "..", "harness", "AGENT.md");
const DONE = "/home/user/.agent-done";
const OUT = "/home/user/output";

export type HarnessPlan = DemoPlan;

export interface HarnessOptions {
  repo_url: string;
  ref?: string;
  hint?: string;
  setup_hint?: string;
  env?: Record<string, string>;
  runDir: string;
  log?: (line: string) => void;
}

export type HarnessResult =
  | {
      ok: true;
      url: string;
      port: number;
      plan: HarnessPlan;
      seconds: number;
      turns?: number;
      box: Box;
      stop: () => Promise<void>;
    }
  | { ok: false; reason: string; box?: Box };

/**
 * Small defects in an otherwise usable plan are fixed here rather than throwing away a whole agent
 * run: long captions are cut to 12 words, a missing `shows` takes the caption, missing boot fields
 * take their empty defaults. Anything structural is left for validateDemoPlan to reject.
 */
export function repairPlan(json: unknown): unknown {
  if (!json || typeof json !== "object") return json;
  const p = structuredClone(json) as Record<string, any>;
  if (p["boot"] && typeof p["boot"] === "object") {
    const b = p["boot"];
    b.install ??= "";
    b.start ??= "";
    b.env ??= {};
    b.demo_mode ??= null;
    b.seeded ??= [];
    if (typeof b.port === "string" && /^\d+$/.test(b.port)) b.port = Number(b.port);
  }
  p["blocked"] ??= null;
  if (Array.isArray(p["workflow"]))
    for (const step of p["workflow"]) {
      if (!step || typeof step !== "object") continue;
      if (typeof step.caption === "string") {
        const words = step.caption.trim().split(/\s+/);
        if (words.length > 12)
          step.caption = words
            .slice(0, 12)
            .join(" ")
            .replace(/[,;:]$/, "");
      }
      if (typeof step.shows !== "string" || !step.shows) step.shows = step.caption ?? "";
    }
  return p;
}

export async function runHarness(opts: HarnessOptions): Promise<HarnessResult> {
  const log = opts.log ?? (() => {});
  const key = process.env["OPENROUTER_API_KEY"];
  if (!key) return { ok: false, reason: "no OPENROUTER_API_KEY for the harness" };
  mkdirSync(opts.runDir, { recursive: true });
  const events = join(opts.runDir, "harness.jsonl");
  const note = (e: Record<string, unknown>) =>
    appendFileSync(events, JSON.stringify({ t: new Date().toISOString(), ...e }) + "\n");

  const box = await openSandbox(opts.env ?? {}, log);
  const { sbx, run } = box;
  const t0 = Date.now();
  const task = buildTask(opts);
  writeFileSync(join(opts.runDir, "task.json"), JSON.stringify(task, null, 2));
  await sbx.files.write("/home/user/AGENT.md", readFileSync(AGENT_MD_PATH, "utf8"));
  await sbx.files.write("/home/user/task.json", JSON.stringify(task, null, 2));
  // No `set -e`: the sentinel must be written whatever the agent's exit code.
  await sbx.files.write(
    "/home/user/run-wrapper.sh",
    `#!/bin/bash
mkdir -p ${OUT}
bun run /home/user/run-agent.ts > /home/user/.agent-stdout.log 2> /home/user/.agent-stderr.log
echo "$?" > /home/user/.agent-exit-code
touch ${DONE}
`,
  );
  await run("chmod +x /home/user/run-wrapper.sh", 10_000);
  const model = process.env["HARNESS_MODEL"] ?? process.env["OPENROUTER_MODEL"];
  await sbx.commands.run("/home/user/run-wrapper.sh", {
    background: true,
    timeoutMs: 0,
    envs: { ...opts.env, OPENROUTER_API_KEY: key, ...(model ? { AGENT_MODEL: model } : {}) },
  });
  log(`harness started · ${model ?? "template default model"} · cap ${HARNESS_CAP_S}s`);
  note({ event: "start", model: model ?? null, objective: task.objective });

  // Poll the sentinel; stream the agent's per-turn metrics as they land.
  let seen = 0;
  let done = false;
  let turns: number | undefined;
  const deadline = t0 + HARNESS_CAP_S * 1000;
  // Every ~30 s, copy what the agent has written so far next to the run: the status page shows
  // its notes, and its plan once it exists, while it is still working.
  const copyOut = async () => {
    for (const f of ["notes.md", "demo-plan.json"]) {
      const c = await sbx.commands
        .run(`cat ${OUT}/${f} 2>/dev/null || true`, { timeoutMs: 15_000 })
        .catch(() => ({ stdout: "" }));
      if (c.stdout.trim()) writeFileSync(join(opts.runDir, `harness-${f}`), c.stdout);
    }
  };
  let polls = 0;
  let misses = 0;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 5000));
    if (++polls % 6 === 0) await copyOut();
    const r = await sbx.commands
      .run(
        `test -f ${DONE} && echo done; cat /home/user/.agent-stderr.log 2>/dev/null | tail -n +${seen + 1}`,
        { timeoutMs: 15_000, requestTimeoutMs: 20_000 },
      )
      .then((x) => ((misses = 0), x))
      .catch(() => ((misses += 1), { stdout: "" }));
    // A box that stops answering is out of memory or wedged; waiting out the cap gains nothing,
    // and the recipe fallback cannot use it either.
    if (misses >= 6) {
      log(`harness: the sandbox stopped answering for ${misses * 20}s+ (likely out of memory)`);
      note({ event: "unresponsive", polls, seconds: (Date.now() - t0) / 1000 });
      await sbx.kill().catch(() => {});
      return { ok: false, reason: "the sandbox stopped answering (likely out of memory)" };
    }
    const lines = r.stdout.replace(/\n$/, "").split("\n");
    if (lines[0] === "done") {
      done = true;
      lines.shift();
    }
    if (lines.length === 1 && lines[0] === "") lines.pop();
    seen += lines.length;
    for (const line of lines) {
      const m = /^\[TURN_METRIC\] (\{.*\})/.exec(line);
      if (m?.[1]) {
        const metric = JSON.parse(m[1]) as { turn: number; elapsed_ms: number };
        turns = metric.turn;
        log(`harness turn ${metric.turn} · ${(metric.elapsed_ms / 1000).toFixed(0)}s`);
      } else if (/^\[(EXIT|TOOL)\]|Agent failed/.test(line)) {
        log(`harness ${line.slice(0, 200)}`);
        note({ event: "agent", line: line.slice(0, 500) });
      }
    }
    if (done) break;
  }
  const seconds = (Date.now() - t0) / 1000;
  if (!done) {
    await run("pkill -f run-agent.ts || true", 10_000, false);
    log(`harness cap hit at ${seconds.toFixed(0)}s; reading whatever plan exists`);
  }
  // Keep the agent's own account next to the run.
  for (const f of ["demo-plan.json", "notes.md", "app.log"]) {
    const c = await run(`cat ${OUT}/${f} 2>/dev/null || true`, 15_000, false);
    if (c.stdout.trim()) writeFileSync(join(opts.runDir, `harness-${f}`), c.stdout);
  }
  const summary = await run(
    "tail -1 /home/user/.agent-stdout.log 2>/dev/null || true",
    10_000,
    false,
  );
  note({ event: "finish", done, seconds, turns, summary: summary.stdout.trim().slice(0, 500) });

  const raw = await run(`cat ${OUT}/demo-plan.json 2>/dev/null || true`, 15_000, false);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.stdout);
  } catch {
    return {
      ok: false,
      reason: done ? "agent wrote no valid demo-plan.json" : "harness cap hit, no plan",
      box,
    };
  }
  const checked = validateDemoPlan(repairPlan(parsed));
  if (!checked.ok) return { ok: false, reason: `invalid plan: ${checked.errors.join("; ")}`, box };
  const plan = checked.plan;
  if (plan.blocked) return { ok: false, reason: `blocked: ${plan.blocked}`, box };

  // run-agent.ts kills its bash_bg children on exit. AGENT.md asks for a detached server; if the
  // port is still dead, start it from the plan's own command.
  const port = plan.boot.port;
  if (!(await portAnswers(box, port))) {
    if (!plan.boot.start) return { ok: false, reason: `port ${port} dead and no boot.start`, box };
    log(`port ${port} is down after the agent; restarting with the plan's start command`);
    const envs = Object.entries({
      PORT: String(port),
      HOST: "0.0.0.0",
      HOSTNAME: "0.0.0.0",
      ...plan.boot.env,
    })
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join(" ");
    await run(
      `cd ${APP_DIR} && (setsid nohup sh -c ${JSON.stringify(`${envs} ${plan.boot.start}`)} > ${OUT}/app-restart.log 2>&1 &)`,
      20_000,
      false,
    );
    let up = false;
    for (let i = 0; i < 30 && !up; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      up = await portAnswers(box, port);
    }
    if (!up) return { ok: false, reason: `port ${port} did not answer after restart`, box };
  }
  const proxy = await startProxy(box, port);
  log(`harness ready in ${seconds.toFixed(0)}s · ${plan.workflow.length} steps · ${proxy.url}`);
  note({ event: "ready", url: proxy.url, port, steps: plan.workflow.length });
  return {
    ok: true,
    url: proxy.url,
    port,
    plan,
    seconds,
    turns,
    box,
    stop: async () => {
      await proxy.kill();
      await sbx.kill().catch(() => {});
    },
  };
}
