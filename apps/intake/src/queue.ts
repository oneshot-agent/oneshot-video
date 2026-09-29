/** One JSONL file, append-only for submissions; status lives in runs/<id>/status.json. */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  ROOT,
  runDir,
  statusPath,
  readStatus,
  updateStatus,
  STATUS_STAGES,
  STATUS_NOTES,
  type Status,
  type StatusStage,
} from "@oneshot-video/pipeline/status";

export interface Submission {
  id: string;
  url: string;
  /** app: a deployed URL, shot as it is. repo: a GitHub repo, booted and prepared in a sandbox. */
  kind?: "app" | "repo";
  contact: string;
  hint: string;
  ts: string;
}

export { ROOT, runDir, statusPath, readStatus, STATUS_STAGES, STATUS_NOTES };
export type { Status, StatusStage };

export const QUEUE_PATH = join(ROOT, "intake", "queue.jsonl");

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
  return readFileSync(QUEUE_PATH, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Submission);
}

/** Merge into the run's status record (atomic; see @oneshot-video/pipeline/status). */
export function writeStatus(s: Partial<Status> & { id: string }): void {
  const { id, ...patch } = s;
  updateStatus(id, patch);
}

/** Oldest submission still queued, or null. */
export function nextQueued(): Submission | null {
  for (const s of listSubmissions()) if (readStatus(s.id).stage === "queued") return s;
  return null;
}

const LOCAL_HOSTS = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|.*\.local)$/i;

const GITHUB_REPO = /^\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(?:\/.*)?$/;

/**
 * http(s), reachable from somewhere that is not the submitter's laptop. A github.com/<owner>/<repo>
 * URL is a repo to boot, normalised to its root.
 */
export function validateUrl(
  raw: string,
): { ok: true; url: string; kind: "app" | "repo" } | { ok: false; reason: "invalid" | "local" } {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return { ok: false, reason: "invalid" };
  if (LOCAL_HOSTS.test(u.hostname)) return { ok: false, reason: "local" };
  if (u.hostname === "github.com" || u.hostname === "www.github.com") {
    const m = GITHUB_REPO.exec(u.pathname);
    if (!m?.[1] || !m[2]) return { ok: false, reason: "invalid" };
    return { ok: true, url: `https://github.com/${m[1]}/${m[2]}`, kind: "repo" };
  }
  return { ok: true, url: u.toString(), kind: "app" };
}

/** One address, the usual shape: something@domain.tld, no spaces. The browser checks too. */
export function validateEmail(raw: string): string | null {
  const e = raw.trim();
  return e.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : null;
}
