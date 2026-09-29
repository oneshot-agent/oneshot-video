/**
 * check-workflow: the camera, inside the box, for the agent. Runs demo-plan.json exactly the way
 * the camera outside will (same validator, same runWorkflow, same Chromium at film size) against
 * localhost and prints what each step actually showed, so the agent can fix a selector, a login
 * or a blank page before it finishes instead of the film finding out afterwards.
 *
 * Bundled by build.sh into the template as `check-workflow`:
 *   check-workflow [plan.json] [--base http://localhost:3000]
 * Exit 0 when every step loaded, every action ran and no step looks like a login wall.
 */
import { readFileSync } from "node:fs";
import { validateDemoPlan } from "../src/demo-plan.ts";
import { runWorkflow, type WorkflowAuth, type WorkflowStep } from "../src/workflow.ts";

const args = process.argv.slice(2);
const baseIdx = args.indexOf("--base");
const planPath =
  args.find((a, i) => !a.startsWith("--") && (baseIdx < 0 || i !== baseIdx + 1)) ??
  "/home/user/output/demo-plan.json";

let json: unknown;
try {
  json = JSON.parse(readFileSync(planPath, "utf8"));
} catch (e) {
  console.log(`PLAN UNREADABLE ${planPath}: ${e instanceof Error ? e.message : e}`);
  process.exit(2);
}
const v = validateDemoPlan(json);
if (!v.ok) {
  console.log(`PLAN INVALID\n${v.errors.map((e) => `  - ${e}`).join("\n")}`);
  process.exit(2);
}
const plan = v.plan;
const base = baseIdx >= 0 ? (args[baseIdx + 1] as string) : `http://localhost:${plan.boot.port}`;
const steps: WorkflowStep[] = plan.workflow.map((s) => ({
  id: s.id,
  path: s.path,
  caption: s.caption,
  actions: s.actions as WorkflowStep["actions"],
}));
const auth: WorkflowAuth | undefined = plan.auth
  ? {
      path: plan.auth.path,
      actions: plan.auth.actions as WorkflowAuth["actions"],
      expect: plan.auth.expect,
    }
  : undefined;

const r = await runWorkflow({
  base_url: base,
  steps,
  auth,
  outDir: process.env["CHECK_OUT"] ?? "/home/user/output/check",
});

const LOGIN_WALL =
  /\b(log ?in|sign ?in)\b[\s\S]{0,200}\bpassword\b|\bpassword\b[\s\S]{0,200}\b(log ?in|sign ?in)\b/i;
let problems = 0;
if (auth) {
  const ok = r.authOk !== false;
  if (!ok) problems++;
  console.log(
    `${ok ? "ok  " : "FAIL"} auth ${auth.path}${auth.expect ? ` expect "${auth.expect}"` : ""}`,
  );
  for (const a of r.actions.filter((x) => x.step === "auth" && !x.ok))
    console.log(`       ${a.op} failed: ${(a.error ?? "").split("\n")[0]?.slice(0, 160)}`);
}
for (const s of steps) {
  const shot = r.pages.find((p) => p.id === s.id);
  const failed = r.actions.filter((a) => a.step === s.id && !a.ok);
  const text = shot?.text ?? [];
  const wall =
    shot && LOGIN_WALL.test(text.slice(0, 40).join(" ")) ? "LOOKS LIKE A LOGIN WALL" : "";
  const blank = shot && text.length === 0 ? "BLANK PAGE" : "";
  const bad = !shot || failed.length > 0 || wall || blank;
  if (bad) problems++;
  console.log(
    `${bad ? "FAIL" : "ok  "} ${s.id} ${s.path}${shot ? "" : " did not load"} ${wall}${blank}`,
  );
  for (const a of failed) {
    console.log(`       ${a.op} failed: ${(a.error ?? "").split("\n")[0]?.slice(0, 160)}`);
  }
  if (shot) console.log(`       shows: ${text.slice(0, 5).join(" | ").slice(0, 220)}`);
}
console.log(
  problems
    ? `${problems} problem(s): fix the plan or the app, then run check-workflow again`
    : "all steps ok",
);
process.exit(problems ? 1 : 0);
