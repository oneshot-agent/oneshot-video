/**
 * Boot a repo somewhere that is not this laptop and hand back a public URL: OneShot's own E2B
 * compute template. The camera stays outside the box: the recorder only needs a URL.
 */
import { spawnSync } from "node:child_process";
import { recipeFor, type Recipe, type RepoFacts } from "./recipe.ts";

export const E2B_TEMPLATE = "3q9bmjreg9m3aggg9x3q"; // one-shot/apps/worker-service/agent_tier/e2b.toml

/** Runs inside the sandbox: forwards to the app on localhost with a loopback Host header. */
const PROXY_SOURCE = `const target = "http://127.0.0.1:__PORT__";
Bun.serve({
  port: __LISTEN__,
  hostname: "0.0.0.0",
  async fetch(req) {
    const u = new URL(req.url);
    const headers = new Headers(req.headers);
    headers.set("host", "localhost:__PORT__");
    headers.delete("accept-encoding");
    const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer();
    const res = await fetch(target + u.pathname + u.search, { method: req.method, headers, body, redirect: "manual" });
    const out = new Headers(res.headers);
    const loc = out.get("location");
    if (loc && loc.startsWith(target)) out.set("location", loc.slice(target.length));
    if (loc && loc.startsWith("http://localhost:__PORT__")) out.set("location", loc.slice("http://localhost:__PORT__".length));
    return new Response(res.body, { status: res.status, headers: out });
  },
});
console.log("proxy on __LISTEN__ -> " + target);
`;
export const BOOT_CAP_S = 150;

export interface BootOptions {
  repo_url: string;
  ref?: string;
  setup_hint?: string;
  env?: Record<string, string>;
  runDir: string;
  log?: (line: string) => void;
}

export interface Booted {
  url: string;
  backend: "e2b";
  recipe: Recipe;
  port: number;
  seconds: number;
  stop: () => Promise<void>;
}

export type BootResult = { ok: true; booted: Booted } | { ok: false; reason: string };

const ghRepo = (url: string) => {
  const m = /github\.com\/([^/]+)\/([^/#?]+)/.exec(url);
  if (!m?.[1] || !m[2]) throw new Error(`not a GitHub repo URL: ${url}`);
  return { owner: m[1], name: m[2].replace(/\.git$/, "") };
};

/** Read the repo without running it: file list, package.json, .env.example. Uses `gh` so private repos the user can see also work. */
export function readRepoFacts(repo_url: string, ref?: string): RepoFacts {
  const { owner, name } = ghRepo(repo_url);
  const r = ref ? `?ref=${encodeURIComponent(ref)}` : "";
  const list = spawnSync("gh", ["api", `repos/${owner}/${name}/contents${r}`, "--jq", ".[].name"], {
    encoding: "utf8",
  });
  if (list.status !== 0) throw new Error(`gh: ${list.stderr.trim().slice(0, 200)}`);
  const files = list.stdout.split("\n").filter(Boolean);
  const read = (path: string): string | undefined => {
    const g = spawnSync(
      "gh",
      ["api", `repos/${owner}/${name}/contents/${path}${r}`, "--jq", ".content"],
      { encoding: "utf8" },
    );
    if (g.status !== 0) return undefined;
    return Buffer.from(g.stdout.trim(), "base64").toString("utf8");
  };
  const pkg = files.includes("package.json") ? read("package.json") : undefined;
  const envExample = files.includes(".env.example")
    ? read(".env.example")
    : files.includes(".env.sample")
      ? read(".env.sample")
      : undefined;
  let packageJson: RepoFacts["packageJson"];
  try {
    packageJson = pkg ? (JSON.parse(pkg) as RepoFacts["packageJson"]) : undefined;
  } catch {
    packageJson = undefined;
  }
  return { files, packageJson, envExample };
}

async function bootE2B(opts: BootOptions, recipe: Recipe): Promise<Booted> {
  const { Sandbox } = await import("e2b");
  const log = opts.log ?? (() => {});
  const t0 = Date.now();
  const sbx = await Sandbox.create(E2B_TEMPLATE, { timeoutMs: 30 * 60_000 });
  log(`e2b sandbox ${sbx.sandboxId}`);
  const { owner, name } = ghRepo(opts.repo_url);
  const cloneUrl = `https://github.com/${owner}/${name}.git`;
  const dir = "/home/user/app";
  const run = async (cmd: string, timeoutMs = 240_000, mustSucceed = true) => {
    const r = await sbx.commands
      .run(cmd, { timeoutMs, requestTimeoutMs: timeoutMs + 30_000, envs: opts.env ?? {} })
      .catch(
        (e: {
          result?: { exitCode?: number; stdout?: string; stderr?: string };
          message?: string;
        }) => e.result ?? { exitCode: -1, stdout: "", stderr: e.message ?? String(e) },
      );
    const tail = ((r.stdout ?? "") + (r.stderr ?? "")).trim().split("\n").slice(-3).join(" | ");
    log(`$ ${cmd.slice(0, 80)} → exit ${r.exitCode} · ${tail.slice(0, 200)}`);
    if (mustSucceed && r.exitCode !== 0)
      throw new Error(`${cmd.slice(0, 60)} failed (exit ${r.exitCode}): ${tail.slice(0, 300)}`);
    return r;
  };
  const cloneCmd = `git clone --quiet --depth 1 --single-branch ${opts.ref ? `--branch ${opts.ref} ` : ""}${cloneUrl} ${dir}`;
  try {
    await run(cloneCmd, 300_000);
  } catch (e) {
    log(`clone retry after: ${String(e).slice(0, 120)}`);
    await run(`rm -rf ${dir}`, 30_000, false);
    await run(cloneCmd, 300_000);
  }
  await run(`cd ${dir} && ${recipe.install.replace(/(^|\s)bunx\s/g, "$1bun x ")}`, 420_000);
  let out = "";
  const envs = {
    PORT: String(recipe.ports[0] ?? 3000),
    HOST: "0.0.0.0",
    HOSTNAME: "0.0.0.0",
    BROWSER: "none",
    CI: "1",
    ...(opts.env ?? {}),
  };
  // The template has `bun` on PATH but no `bunx` shim; `bun x` is the same command.
  const start = recipe.start.replace(/(^|\s)bunx\s/g, "$1bun x ");
  const handle = await sbx.commands.run(`cd ${dir} && ${start}`, {
    background: true,
    timeoutMs: 0,
    envs,
    onStdout: (d) => {
      out += d;
    },
    onStderr: (d) => {
      out += d;
    },
  });
  const deadline = Date.now() + BOOT_CAP_S * 1000;
  let port = 0;
  while (Date.now() < deadline && !port) {
    await new Promise((r) => setTimeout(r, 2000));
    for (const p of recipe.ports) {
      const c = await sbx.commands
        .run(`curl -s -o /dev/null -w %{http_code} http://localhost:${p}/ || true`, {
          timeoutMs: 15_000,
        })
        .catch(() => ({ stdout: "000" }));
      if (/^[23]\d\d$|^40[134]$/.test(c.stdout.trim())) {
        port = p;
        break;
      }
    }
  }
  if (!port) {
    await handle.kill().catch(() => {});
    await sbx.kill().catch(() => {});
    throw new Error(
      `boot_failed: no port answered within ${BOOT_CAP_S}s. Last output: ${out.trim().slice(-600)}`,
    );
  }
  // Local dashboards (oneshot-gtm, Next dev servers) refuse requests whose Host is not localhost:
  // a DNS-rebinding defence. A one-file proxy inside the sandbox rewrites Host, so the camera
  // outside sees what a local browser would. The proxy's port is what gets exposed.
  const PROXY_PORT = 3999;
  await sbx.files.write(
    "/home/user/proxy.ts",
    PROXY_SOURCE.replaceAll("__PORT__", String(port)).replaceAll("__LISTEN__", String(PROXY_PORT)),
  );
  const proxy = await sbx.commands.run("cd /home/user && bun run proxy.ts", {
    background: true,
    timeoutMs: 0,
  });
  await new Promise((r) => setTimeout(r, 1200));
  const url = `https://${sbx.getHost(PROXY_PORT)}`;
  log(`up on port ${port}, proxied on ${PROXY_PORT} → ${url}`);
  return {
    url,
    backend: "e2b",
    recipe,
    port,
    seconds: (Date.now() - t0) / 1000,
    stop: async () => {
      await proxy.kill().catch(() => {});
      await handle.kill().catch(() => {});
      await sbx.kill().catch(() => {});
    },
  };
}

export async function bootRepo(opts: BootOptions): Promise<BootResult> {
  const facts = readRepoFacts(opts.repo_url, opts.ref);
  const r = recipeFor(facts, opts.setup_hint);
  if (!r.ok) return r;
  return { ok: true, booted: await bootE2B(opts, r.recipe) };
}
