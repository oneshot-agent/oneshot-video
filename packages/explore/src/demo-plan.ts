/**
 * demo-plan.json is the contract between the sandbox agent that explores a repo and the camera
 * that shoots it: what the app is, how it was booted, and the 3–6 steps of the workflow to film.
 * Nothing upstream checks the shape of that file today, so a malformed plan reaches the camera
 * and fails there, far from the cause. This module is that check.
 */

export type DemoActionOp = "click" | "fill" | "wait" | "scroll";

export interface DemoAction {
  op: DemoActionOp;
  /** Required for click/fill. */
  selector?: string;
  /** Required for fill. */
  value?: string;
  /** Required for wait; 0–10000. */
  ms?: number;
  /** Required for scroll; an integer pixel count. */
  px?: number;
}

export interface DemoWorkflowStep {
  id: string;
  /** Must start with "/". */
  path: string;
  /** 12 words or fewer. */
  caption: string;
  shows: string;
  actions?: DemoAction[];
}

export interface DemoAuth {
  /** Where the login form is. Must start with "/". */
  path: string;
  /** The fills and the submit click, in order. */
  actions: DemoAction[];
  /** Text visible once logged in; the check and the camera wait for it. */
  expect?: string;
}

export interface DemoPlan {
  app: {
    name: string;
    what_it_does: string;
    wedge_hint?: string;
    proof_hint?: string;
  };
  boot: {
    install: string;
    start: string;
    port: number;
    env: Record<string, string>;
    demo_mode: string | null;
    seeded: string[];
  };
  /**
   * Run once before the workflow, in the same browser session, and never filmed: the login that
   * gets the camera past the wall. The session (cookies, localStorage) carries into every step.
   */
  auth?: DemoAuth;
  /** 3–6 steps, unless `blocked` is set, in which case it may be empty. */
  workflow: DemoWorkflowStep[];
  blocked: string | null;
  notes?: string[];
}

export type ValidateDemoPlanResult = { ok: true; plan: DemoPlan } | { ok: false; errors: string[] };

const ACTION_OPS: DemoActionOp[] = ["click", "fill", "wait", "scroll"];

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const countWords = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length;

/** Required, non-empty string. Reports "required" (absent), "must be a string" (wrong type), or "empty". */
function checkRequiredString(errors: string[], path: string, value: unknown): void {
  if (value === undefined) {
    errors.push(`${path}: required`);
  } else if (typeof value !== "string") {
    errors.push(`${path}: must be a string`);
  } else if (value.trim() === "") {
    errors.push(`${path}: empty`);
  }
}

/** Optional string: only checked when present. */
function checkOptionalString(errors: string[], path: string, value: unknown): void {
  if (value !== undefined && typeof value !== "string") {
    errors.push(`${path}: must be a string`);
  }
}

function checkAction(errors: string[], path: string, value: unknown): void {
  if (!isRecord(value)) {
    errors.push(`${path}: must be an object`);
    return;
  }
  const op = value["op"];
  if (typeof op !== "string" || !ACTION_OPS.includes(op as DemoActionOp)) {
    errors.push(`${path}.op: must be one of ${ACTION_OPS.join(", ")}`);
    return;
  }
  if (op === "click" || op === "fill") {
    checkRequiredString(errors, `${path}.selector`, value["selector"]);
  }
  if (op === "fill") {
    checkRequiredString(errors, `${path}.value`, value["value"]);
  }
  if (op === "wait") {
    const ms = value["ms"];
    if (typeof ms !== "number" || !Number.isInteger(ms) || ms < 0 || ms > 10000) {
      errors.push(`${path}.ms: must be an integer between 0 and 10000`);
    }
  }
  if (op === "scroll") {
    const px = value["px"];
    if (typeof px !== "number" || !Number.isInteger(px)) {
      errors.push(`${path}.px: must be an integer`);
    }
  }
}

function checkWorkflowStep(
  errors: string[],
  path: string,
  value: unknown,
  seenIds: Set<string>,
): void {
  if (!isRecord(value)) {
    errors.push(`${path}: must be an object`);
    return;
  }
  const id = value["id"];
  if (typeof id !== "string" || id.trim() === "") {
    checkRequiredString(errors, `${path}.id`, id);
  } else if (seenIds.has(id)) {
    errors.push(`${path}.id: duplicate "${id}"`);
  } else {
    seenIds.add(id);
  }

  const stepPath = value["path"];
  if (typeof stepPath !== "string" || stepPath === "") {
    checkRequiredString(errors, `${path}.path`, stepPath);
  } else if (!stepPath.startsWith("/")) {
    errors.push(`${path}.path: must start with /`);
  }

  const caption = value["caption"];
  checkRequiredString(errors, `${path}.caption`, caption);
  if (typeof caption === "string" && caption.trim() !== "" && countWords(caption) > 12) {
    errors.push(`${path}.caption: must be 12 words or fewer`);
  }

  checkRequiredString(errors, `${path}.shows`, value["shows"]);

  const actions = value["actions"];
  if (actions !== undefined) {
    if (!Array.isArray(actions)) {
      errors.push(`${path}.actions: must be an array`);
    } else {
      actions.forEach((a, i) => checkAction(errors, `${path}.actions[${i}]`, a));
    }
  }
}

/** Validate a parsed demo-plan.json. Reports every error found, not just the first. */
export function validateDemoPlan(json: unknown): ValidateDemoPlanResult {
  const errors: string[] = [];

  if (!isRecord(json)) {
    return { ok: false, errors: ["root: must be an object"] };
  }

  const app = json["app"];
  if (!isRecord(app)) {
    errors.push("app: must be an object");
  } else {
    checkRequiredString(errors, "app.name", app["name"]);
    checkRequiredString(errors, "app.what_it_does", app["what_it_does"]);
    checkOptionalString(errors, "app.wedge_hint", app["wedge_hint"]);
    checkOptionalString(errors, "app.proof_hint", app["proof_hint"]);
  }

  const boot = json["boot"];
  if (!isRecord(boot)) {
    errors.push("boot: must be an object");
  } else {
    checkRequiredString(errors, "boot.install", boot["install"]);
    checkRequiredString(errors, "boot.start", boot["start"]);
    const port = boot["port"];
    if (typeof port !== "number" || !Number.isInteger(port) || port < 1 || port > 65535) {
      errors.push("boot.port: must be an integer between 1 and 65535");
    }
    const env = boot["env"];
    if (!isRecord(env)) {
      errors.push("boot.env: must be an object");
    } else {
      for (const [key, val] of Object.entries(env)) {
        if (typeof val !== "string") {
          errors.push(`boot.env.${key}: must be a string`);
        }
      }
    }
    const demoMode = boot["demo_mode"];
    if (demoMode !== null && demoMode !== undefined && typeof demoMode !== "string") {
      errors.push("boot.demo_mode: must be a string or null");
    }
    const seeded = boot["seeded"];
    if (!Array.isArray(seeded)) {
      errors.push("boot.seeded: must be an array of strings");
    } else {
      seeded.forEach((s, i) => {
        if (typeof s !== "string") errors.push(`boot.seeded[${i}]: must be a string`);
      });
    }
  }

  const blocked = json["blocked"];
  if (blocked !== null && typeof blocked !== "string") {
    errors.push("blocked: must be a string or null");
  }
  const isBlocked = typeof blocked === "string";

  const workflow = json["workflow"];
  if (!Array.isArray(workflow)) {
    errors.push("workflow: must be an array");
  } else {
    const inRange = workflow.length >= 3 && workflow.length <= 6;
    const emptyWhenBlocked = isBlocked && workflow.length === 0;
    if (!inRange && !emptyWhenBlocked) {
      errors.push("workflow: must have between 3 and 6 steps (or be empty when blocked)");
    }
    const seenIds = new Set<string>();
    workflow.forEach((step, i) => checkWorkflowStep(errors, `workflow[${i}]`, step, seenIds));
  }

  const auth = json["auth"];
  if (auth !== undefined && auth !== null) {
    if (!isRecord(auth)) {
      errors.push("auth: must be an object");
    } else {
      const authPath = auth["path"];
      if (typeof authPath !== "string" || !authPath.startsWith("/"))
        errors.push("auth.path: must be a string starting with /");
      const acts = auth["actions"];
      if (!Array.isArray(acts) || acts.length === 0) {
        errors.push("auth.actions: must be a non-empty array");
      } else {
        acts.forEach((a, i) => checkAction(errors, `auth.actions[${i}]`, a));
      }
      checkOptionalString(errors, "auth.expect", auth["expect"]);
    }
  }

  const notes = json["notes"];
  if (notes !== undefined) {
    if (!Array.isArray(notes)) {
      errors.push("notes: must be an array of strings");
    } else {
      notes.forEach((n, i) => {
        if (typeof n !== "string") errors.push(`notes[${i}]: must be a string`);
      });
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, plan: json as unknown as DemoPlan };
}
