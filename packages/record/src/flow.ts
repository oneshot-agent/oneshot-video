/**
 * Load a Flow from disk and validate it. A team handing us a URL often has a one-line hint —
 * "the dashboard after login" — that becomes a flow; this is the loader for the JSON they (or an
 * agent) write instead of hand-typed TypeScript. See packages/record/examples/flows/*.json.
 */
import { readFileSync } from "node:fs";
import type { Flow, FlowStep } from "./index.ts";

export type { Flow, FlowStep };

const KNOWN_OPS = new Set<FlowStep["op"]>(["goto", "wait", "click", "fill", "scroll"]);

function fail(index: number, op: unknown, field: string, reason: string): never {
  const opLabel = typeof op === "string" ? op : String(op);
  throw new Error(`flow step ${index} ("${opLabel}"): "${field}" ${reason}`);
}

function requireString(
  index: number,
  op: string,
  step: Record<string, unknown>,
  field: string,
): string {
  const value = step[field];
  if (typeof value !== "string" || value.length === 0) {
    fail(index, op, field, "must be a non-empty string");
  }
  return value as string;
}

function requirePositiveNumber(
  index: number,
  op: string,
  step: Record<string, unknown>,
  field: string,
): number {
  const value = step[field];
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    fail(index, op, field, "must be a positive number");
  }
  return value as number;
}

function requireNumber(
  index: number,
  op: string,
  step: Record<string, unknown>,
  field: string,
): number {
  const value = step[field];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(index, op, field, "must be a number");
  }
  return value as number;
}

function validateStep(raw: unknown, index: number): FlowStep {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    fail(index, "?", "op", "must be a step object");
  }
  const step = raw as Record<string, unknown>;
  const op = step.op;
  if (typeof op !== "string" || !KNOWN_OPS.has(op as FlowStep["op"])) {
    fail(index, op, "op", `must be one of ${[...KNOWN_OPS].join(", ")}`);
  }
  switch (op as FlowStep["op"]) {
    case "goto":
      return { op: "goto", url: requireString(index, op, step, "url") };
    case "wait":
      return { op: "wait", ms: requirePositiveNumber(index, op, step, "ms") };
    case "click":
      return { op: "click", selector: requireString(index, op, step, "selector") };
    case "fill":
      return {
        op: "fill",
        selector: requireString(index, op, step, "selector"),
        value: requireString(index, op, step, "value"),
      };
    case "scroll":
      return { op: "scroll", dy: requireNumber(index, op, step, "dy") };
    default:
      // Unreachable: KNOWN_OPS guards this above.
      fail(index, op, "op", "is not a recognised step");
  }
}

/** Read a Flow from a JSON file on disk, validating every step. Throws naming the step index and field. */
export function loadFlow(path: string): Flow {
  const raw = readFileSync(path, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`flow ${path}: invalid JSON (${(err as Error).message})`, { cause: err });
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !Array.isArray((parsed as { steps?: unknown }).steps)
  ) {
    throw new Error(`flow ${path}: expected a top-level "steps" array`);
  }
  const steps = (parsed as { steps: unknown[] }).steps.map((step, index) =>
    validateStep(step, index),
  );
  return { steps };
}

const STEP_SUMMARY: Record<FlowStep["op"], (step: FlowStep) => string> = {
  goto: (s) => `goto ${(s as { url: string }).url}`,
  wait: (s) => `wait ${(s as { ms: number }).ms}ms`,
  click: (s) => `click ${(s as { selector: string }).selector}`,
  fill: (s) => `fill ${(s as { selector: string }).selector} = ${(s as { value: string }).value}`,
  scroll: (s) => `scroll ${(s as { dy: number }).dy}`,
};

/** One line per step, for logs. */
export function describeFlow(flow: Flow): string {
  return flow.steps.map((step, index) => `${index}: ${STEP_SUMMARY[step.op](step)}`).join("\n");
}
