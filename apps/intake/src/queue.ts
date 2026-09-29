/** One JSONL file, append-only for submissions; status lives in runs/<id>/status.json. */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export interface Submission {
  id: string;
  url: string;
  contact: string;
  hint: string;
  ts: string;
}

export type Stage = "queued" | "script" | "recording" | "narrating" | "planning" | "gates" | "rendering" | "done" | "failed";

export interface Status {
  id: string;
  stage: Stage;
  updated: string;
  error?: string;
  video?: string;
  silent?: string;
  cost_usd?: number;
  gates?: { name: string; ok: boolean; reason: string }[];
}

export const ROOT = process.env["ONESHOT_VIDEO_ROOT"] ?? process.cwd();
export const QUEUE_PATH = join(ROOT, "intake", "queue.jsonl");
export const runDir = (id: string) => join(ROOT, "runs", id);
export const statusPath = (id: string) => join(runDir(id), "status.json");

export const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export function enqueue(s: Omit<Submission, "id" | "ts">): Submission {
  const full: Submission = { id: newId(), ts: new Date().toISOString(), ...s };
  mkdirSync(dirname(QUEUE_PATH), { recursive: true });
  appendFileSync(QUEUE_PATH, JSON.stringify(full) + "\n");
  writeStatus({ id: full.id, stage: "queued", updated: full.ts });
  return full;
}

export function listSubmissions(): Submission[] {
  if (!existsSync(QUEUE_PATH)) return [];
  return readFileSync(QUEUE_PATH, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Submission);
}

export function readStatus(id: string): Status {
  const p = statusPath(id);
  if (!existsSync(p)) return { id, stage: "queued", updated: "" };
  return JSON.parse(readFileSync(p, "utf8")) as Status;
}

export function writeStatus(s: Status): void {
  mkdirSync(runDir(s.id), { recursive: true });
  writeFileSync(statusPath(s.id), JSON.stringify(s, null, 2));
}

/** Oldest submission still queued, or null. */
export function nextQueued(): Submission | null {
  for (const s of listSubmissions()) if (readStatus(s.id).stage === "queued") return s;
  return null;
}

const LOCAL_HOSTS = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|.*\.local)$/i;

/** http(s), reachable from somewhere that is not the submitter's laptop. */
export function validateUrl(raw: string): { ok: true; url: string } | { ok: false; reason: "invalid" | "local" } {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return { ok: false, reason: "invalid" };
  if (LOCAL_HOSTS.test(u.hostname)) return { ok: false, reason: "local" };
  return { ok: true, url: u.toString() };
}
