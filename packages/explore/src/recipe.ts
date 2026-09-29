/**
 * How to boot a repo, read without running it (the "quote step" of #881, lite). A recipe is a
 * prediction; the boot step's time cap covers the cases where it is wrong.
 */
export interface Recipe {
  install: string;
  start: string;
  /** Ports to probe in order once the start command is running. */
  ports: number[];
  runtime: "bun" | "node" | "python" | "unknown";
  notes: string[];
  /** Env the box supplies: its local Postgres and Redis under the names .env.example asks for. */
  env: Record<string, string>;
}

export interface RepoFacts {
  files: string[];
  packageJson?: {
    scripts?: Record<string, string>;
    packageManager?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  envExample?: string;
}

export type RecipeResult = { ok: true; recipe: Recipe } | { ok: false; reason: string };

/** Services the box has (packages/explore/template): Postgres and Redis, already running. */
const LOCAL_PG = "postgresql://demo:demo@localhost:5432/demo";
const LOCAL_REDIS = "redis://localhost:6379";
const PG_KEYS =
  /^(DATABASE_URL|POSTGRES_(?:PRISMA_)?URL(?:_NON_POOLING|_UNPOOLED)?|DIRECT_URL|DATABASE_URL_UNPOOLED)=/gm;
const REDIS_KEYS = /^(REDIS_URL|KV_URL|UPSTASH_REDIS_URL)=/gm;
/** Services it does not have. */
const NEEDS_MISSING = /^(MONGODB_URI|MONGO_URL|SUPABASE_[A-Z_]+|CLICKHOUSE_[A-Z_]+)=/m;

/** Parse "install: …; start: …; port: N" from a submitter's setup hint. Anything else is prose and ignored. */
export function parseSetupHint(hint?: string): Partial<Recipe> {
  const out: Partial<Recipe> = {};
  if (!hint) return out;
  const m = (k: string) => new RegExp(`${k}\\s*[:=]\\s*([^;\\n]+)`, "i").exec(hint)?.[1]?.trim();
  const install = m("install");
  const start = m("start");
  const port = /port\s*[:=]\s*(\d{2,5})/i.exec(hint)?.[1];
  if (install) out.install = install;
  if (start) out.start = start;
  if (port) out.ports = [Number(port)];
  return out;
}

export function recipeFor(facts: RepoFacts, hint?: string): RecipeResult {
  const notes: string[] = [];
  const has = (f: string) => facts.files.includes(f);
  const fromHint = parseSetupHint(hint);
  if (has("docker-compose.yml") || has("docker-compose.yaml") || has("compose.yaml"))
    notes.push("docker-compose present: no Docker in the box; its Postgres and Redis stand in");
  const env: Record<string, string> = {};
  const example = facts.envExample ?? "";
  for (const m of example.matchAll(PG_KEYS)) if (m[1]) env[m[1]] = LOCAL_PG;
  for (const m of example.matchAll(REDIS_KEYS)) if (m[1]) env[m[1]] = LOCAL_REDIS;
  if (Object.keys(env).length) notes.push(`local services for ${Object.keys(env).join(", ")}`);
  const missing = NEEDS_MISSING.exec(example)?.[1];
  if (missing && !fromHint.start) {
    return {
      ok: false,
      reason: `needs ${missing} (from .env.example), which the box does not run. Pass env, or a setup hint with a demo mode`,
    };
  }
  const pj = facts.packageJson;
  if (!pj && !fromHint.start) {
    if (has("pyproject.toml") || has("requirements.txt"))
      return {
        ok: false,
        reason:
          "Python app: the recipe boot reads package.json only (the harness agent handles Python)",
      };
    return { ok: false, reason: "no package.json and no setup hint: nothing to start" };
  }
  const scripts = pj?.scripts ?? {};
  const runtime: Recipe["runtime"] =
    has("bun.lock") || has("bun.lockb") || /^bun@/.test(pj?.packageManager ?? "")
      ? "bun"
      : pj
        ? "node"
        : "unknown";
  const install = fromHint.install ?? "bun install";
  let start = fromHint.start ?? "";
  if (!start) {
    const script = scripts["dev"]
      ? "dev"
      : scripts["start"]
        ? "start"
        : scripts["preview"]
          ? "preview"
          : "";
    if (!script)
      return {
        ok: false,
        reason: "package.json has no dev, start or preview script; pass a setup hint",
      };
    start = `bun run ${script}`;
    if (
      script === "dev" &&
      scripts["build"] &&
      !scripts["dev"]?.includes("next") &&
      !scripts["dev"]?.includes("vite")
    )
      notes.push("running the dev script; a build was not attempted");
  }
  const ports = fromHint.ports ?? [3000, 5173, 8080, 4321, 8000, 3030, 4000, 5000];
  if (!has("package.json") && !fromHint.start) return { ok: false, reason: "no package.json" };
  return { ok: true, recipe: { install, start, ports, runtime, notes, env } };
}
