/**
 * After a template build: does the box have what AGENT.md promises? Boots one sandbox and checks
 * each claim as `user`, the account the agent runs under. Exit 1 on any miss.
 *
 *   bun --env-file=.env packages/explore/template/smoke.ts
 */
import { Sandbox } from "e2b";
import { BOX_ENV, E2B_TEMPLATE } from "../src/boot.ts";

const checks: [string, string][] = [
  [
    "resources",
    "echo $(nproc) vCPU $(free -m | awk '/Mem:/{print $2}') MB, $(df -m /home/user | awk 'NR==2{print $4}') MB free",
  ],
  ["node", "node -v"],
  ["npm", "npm -v"],
  ["pnpm", "pnpm -v"],
  ["yarn", "yarn -v"],
  ["bun", "bun -v"],
  ["bunx", "bunx --version"],
  ["python", "python3 --version"],
  ["uv", "uv --version"],
  ["gcc", "gcc --version | head -1"],
  [
    "postgres",
    'psql "$DATABASE_URL_LOCAL" -tAc "create table if not exists smoke(x int); insert into smoke values (1); select count(*) from smoke"',
  ],
  [
    "redis",
    'redis-cli -u "$REDIS_URL_LOCAL" set smoke 1 && redis-cli -u "$REDIS_URL_LOCAL" get smoke',
  ],
  [
    "home writable",
    "touch /home/user/app-probe && mkdir -p /home/user/output && touch /home/user/output/probe && echo ok",
  ],
  ["run-agent.ts", "test -r /home/user/run-agent.ts && wc -l < /home/user/run-agent.ts"],
  ["sudo", "sudo -n true && echo ok"],
  [
    "check-workflow",
    `printf '%s' '{"app":{"name":"s","what_it_does":"x"},"boot":{"install":"-","start":"-","port":4011,"env":{},"demo_mode":null,"seeded":[]},"workflow":[{"id":"a","path":"/","caption":"a","shows":"a"},{"id":"b","path":"/","caption":"b","shows":"b"},{"id":"c","path":"/","caption":"c","shows":"c"}],"blocked":null}' > /tmp/plan.json && check-workflow /tmp/plan.json | tail -1`,
  ],
  ["whoami", "whoami"],
];

const t0 = Date.now();
const sbx = await Sandbox.create(E2B_TEMPLATE, { timeoutMs: 5 * 60_000, envs: BOX_ENV });
console.log(
  `sandbox ${sbx.sandboxId} from ${E2B_TEMPLATE} in ${((Date.now() - t0) / 1000).toFixed(1)}s`,
);
// A page for check-workflow to shoot. Started with background: true, since an E2B command waits
// on a child it backgrounded itself, setsid or not.
await sbx.files.write("/tmp/site/index.html", "<h1>Smoke</h1><p>three rows of data</p>");
await sbx.commands.run("cd /tmp/site && python3 -m http.server 4011", { background: true });
await new Promise((r) => setTimeout(r, 1000));
let failed = 0;
for (const [name, cmd] of checks) {
  const r = await sbx.commands
    .run(cmd, { timeoutMs: 90_000 })
    .catch(
      (e: { result?: { exitCode: number; stdout: string; stderr: string } }) =>
        e.result ?? { exitCode: -1, stdout: "", stderr: String(e) },
    );
  const out = (r.stdout || r.stderr).trim().split("\n").at(-1) ?? "";
  if (r.exitCode !== 0) failed++;
  console.log(`${r.exitCode === 0 ? "ok  " : "FAIL"} ${name.padEnd(14)} ${out.slice(0, 120)}`);
}
await sbx.kill();
console.log(failed ? `${failed} check(s) failed` : "all checks passed");
process.exit(failed ? 1 : 0);
