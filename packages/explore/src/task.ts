/**
 * The E2B harness gives OneShot's sandbox agent two files: /home/user/task.json (objective,
 * params, budget_usdc) and /home/user/AGENT.md (the playbook). This builds the former and checks
 * the latter has all its sections, in order.
 */

const REPO_RE = /github\.com\/([^/]+)\/([^/#?]+)/;

const DEFAULT_HINT = "what the app is for, on real-looking data";

function repoName(repo_url: string): string {
  const m = REPO_RE.exec(repo_url);
  if (!m?.[1] || !m[2]) throw new Error(`not a GitHub repo URL: ${repo_url}`);
  return `${m[1]}/${m[2].replace(/\.git$/, "")}`;
}

export interface BuildObjectiveOptions {
  repo_url: string;
  hint?: string;
}

export function buildObjective({ repo_url, hint }: BuildObjectiveOptions): string {
  const name = repoName(repo_url);
  const h = hint && hint.trim() ? hint : DEFAULT_HINT;
  return `Prepare ${name} for a thirty-second launch film that shows: ${h}. Write /home/user/output/demo-plan.json.`;
}

export interface BuildTaskOptions {
  repo_url: string;
  ref?: string;
  hint?: string;
  setup_hint?: string;
  port_hint?: number;
  /** Names reach task.json; values reach the sandbox as process env only. */
  env?: Record<string, string>;
}

export interface TaskParams {
  repo_url: string;
  ref?: string;
  hint?: string;
  setup_hint?: string;
  port_hint: number;
  /** The names of `env` only, sorted. Values never go into task.json. */
  env_keys: string[];
}

export interface Task {
  objective: string;
  params: TaskParams;
  budget_usdc: 0;
}

export function buildTask(opts: BuildTaskOptions): Task {
  const objective = buildObjective({ repo_url: opts.repo_url, hint: opts.hint });
  const env_keys = Object.keys(opts.env ?? {}).toSorted();
  const params: TaskParams = {
    repo_url: opts.repo_url,
    ref: opts.ref,
    hint: opts.hint,
    setup_hint: opts.setup_hint,
    port_hint: opts.port_hint ?? 3000,
    env_keys,
  };
  return { objective, params, budget_usdc: 0 };
}

/** The six headings AGENT.md must carry, in order. */
export const AGENT_MD_SECTIONS = [
  "## Who you are",
  "## Read before running",
  "## Make it demoable",
  "## Start it",
  "## Find the workflow",
  "## Write the plan",
] as const;

export interface AgentMdCheck {
  ok: boolean;
  missing: string[];
  outOfOrder: boolean;
}

export function checkAgentMd(md: string): AgentMdCheck {
  const lines = md.split("\n").map((l) => l.trim());
  const positions = AGENT_MD_SECTIONS.map((h) => lines.indexOf(h));
  const missing = AGENT_MD_SECTIONS.filter((_, i) => positions[i] === -1);
  const present = positions.filter((p) => p !== -1);
  let outOfOrder = false;
  for (let i = 1; i < present.length; i++) {
    if (present[i]! < present[i - 1]!) {
      outOfOrder = true;
      break;
    }
  }
  return { ok: missing.length === 0 && !outOfOrder, missing, outOfOrder };
}
