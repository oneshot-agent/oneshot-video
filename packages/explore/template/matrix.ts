/**
 * The smoke matrix: the harness on a spread of public repos, to see where the box breaks before a
 * hacker's repo does. Each repo runs explore() (harness → workflow shots, or the recipe fallback)
 * in its own sandbox, in parallel; no script, narration or render, so it costs model turns only.
 *
 *   bun --env-file=.env packages/explore/template/matrix.ts [owner/repo ...]
 *
 * Writes runs/matrix-<ts>/<repo>/ (the usual explore artefacts) and a summary table.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { explore } from "../src/index.ts";

type Case = { repo: string; hint: string; setup_hint?: string };

const DEFAULT: Case[] = [
  {
    repo: "neo4j-contrib/neodash",
    hint: "a live Movies dashboard on Neo4j's public movies graph: the totals, the graph itself, the most-connected actors",
    setup_hint:
      "Public read-only Neo4j, no account needed: neo4j+s://demo.neo4jlabs.com:7687, database movies, user movies, password movies.",
  },
  {
    repo: "vercel/nextjs-postgres-nextauth-tailwindcss-template",
    hint: "the admin dashboard with its products table, filtered and paged",
  },
  {
    repo: "fastapi/full-stack-fastapi-template",
    hint: "logging in, the items list, adding an item",
  },
  { repo: "excalidraw/excalidraw", hint: "a diagram on the canvas" },
];

const args = process.argv.slice(2);
const cases = args.length ? args.map((repo) => ({ repo, hint: "" })) : DEFAULT;
const root = join(process.cwd(), "runs", `matrix-${Date.now().toString(36)}`);
mkdirSync(root, { recursive: true });
console.log(`matrix → ${root}`);

const results = await Promise.all(
  cases.map(async (c) => {
    const runDir = join(root, c.repo.replace("/", "__"));
    mkdirSync(runDir, { recursive: true });
    const t0 = Date.now();
    const log = (l: string) => {
      if (!/^harness turn|^\$ /.test(l)) console.log(`[${c.repo}] ${l.slice(0, 160)}`);
    };
    try {
      const ex = await explore({
        repo_url: `https://github.com/${c.repo}`,
        hint: c.hint,
        setup_hint: c.setup_hint,
        runDir,
        log,
      });
      return {
        repo: c.repo,
        ok: true,
        mode: ex.boot?.mode ?? "?",
        seconds: Math.round((Date.now() - t0) / 1000),
        turns: ex.harness?.turns,
        stills: ex.pages.length,
        note: ex.boot?.harness_note ?? ex.harness?.seeded?.[0] ?? "",
      };
    } catch (e) {
      return {
        repo: c.repo,
        ok: false,
        mode: "-",
        seconds: Math.round((Date.now() - t0) / 1000),
        stills: 0,
        note: (e instanceof Error ? e.message : String(e)).slice(0, 200),
      };
    }
  }),
);

const table = results
  .map(
    (r) =>
      `${r.ok ? "ok  " : "FAIL"} ${r.repo.padEnd(52)} ${String(r.mode).padEnd(8)} ${String(r.seconds).padStart(4)}s  turns ${String(r.turns ?? "-").padStart(2)}  stills ${r.stills}  ${r.note}`,
  )
  .join("\n");
writeFileSync(join(root, "summary.json"), JSON.stringify(results, null, 2));
console.log(`\n${table}`);
