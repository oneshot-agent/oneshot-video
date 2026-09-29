/**
 * One gate per way the first launch video went wrong. Each returns { ok, reason }.
 * A render that fails a gate does not ship — in this CLI or in OneShot's demo-video tool.
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import type {
  GateResult,
  Scene,
  Script,
  Section,
  Stem,
  TtsRequest,
} from "@oneshot-video/shared-types";
import { BED_SHA256 } from "./music.ts";
import { REAL_PIXELS_MIN } from "./structure.ts";
import { PAUSE_AFTER_MIN, TTS_REQUEST, WORDS_PER_SECOND_MAX } from "./voice.ts";
import {
  BANNED_WORDS,
  CTA_LIFT_PHRASES,
  SENTENCE_WORDS_MAX,
  SENTENCE_WORDS_TARGET,
} from "./vocabulary.ts";

const ok = (reason: string, notes?: string[]): GateResult =>
  notes?.length ? { ok: true, reason, notes } : { ok: true, reason };
const fail = (reason: string, notes?: string[]): GateResult =>
  notes?.length ? { ok: false, reason, notes } : { ok: false, reason };

const words = (s: string): string[] => s.trim().split(/\s+/).filter(Boolean);
const window = (s: Section): number => s.end_seconds - s.start_seconds;
const nearHalf = (x: number): boolean => Math.abs(x * 2 - Math.round(x * 2)) < 1e-6;
const sceneDur = (s: Scene): number => s.end_seconds - s.start_seconds;
const skipped = (what: string): GateResult => ({
  ok: true,
  reason: `skipped: no ${what} supplied`,
  notes: ["skipped"],
});

/** Timeline tolerance, seconds. Stems are measured with ffprobe; anything looser is an estimate. */
export const TIMELINE_TOLERANCE_S = 0.08;

/** d-010: "Timeline rebuilt from measured stems rather than forcing copy into the old estimates." */
export function measuredTimeline(script: Script, stems: Stem[] = []): GateResult {
  const byId = new Map(stems.map((s) => [s.id, s]));
  const off: string[] = [];
  let matched = 0;
  for (const s of script.sections) {
    const stem = byId.get(s.id);
    if (!stem) continue;
    matched++;
    const expected =
      stem.duration_s + s.delivery_cues.pause_before_seconds + s.delivery_cues.pause_after_seconds;
    const delta = Math.abs(window(s) - expected);
    if (delta > TIMELINE_TOLERANCE_S)
      off.push(`${s.id}: window ${window(s).toFixed(2)}s vs stem+pauses ${expected.toFixed(2)}s`);
  }
  if (off.length) return fail("scene windows do not match measured stems", off);
  const rounded = script.sections.filter((s) => nearHalf(window(s)));
  if (script.sections.length >= 2 && rounded.length === script.sections.length) {
    return fail("every window is a round half-second; these are estimates, not measurements");
  }
  return matched === 0
    ? ok("no stems supplied; windows are not round numbers", ["only the estimate check ran"])
    : ok(`${matched} windows match their stems within ${TIMELINE_TOLERANCE_S}s`);
}

/** "A launch video that teaches a 404 is worse than no launch video." */
export function noTaughtErrors(script: Script, observed: string[] = []): GateResult {
  const missing: string[] = [];
  for (const s of script.sections) {
    for (const item of s.on_screen ?? []) {
      const seen = observed.some((o) => o === item || o.includes(item));
      if (!seen) missing.push(`${s.id}: "${item}"`);
    }
  }
  return missing.length
    ? fail("on-screen text was never observed in the recording or verified", missing)
    : ok("everything shown on canvas was observed");
}

/** brands/oneshot.md vocabulary, the CTA lift the film refused, and the film's measured pace. */
export function voiceLint(script: Script): GateResult {
  const problems: string[] = [];
  const notes: string[] = [];
  const all = script.sections.map((s) => s.text).join(" ");
  const lower = all.toLowerCase();
  for (const w of BANNED_WORDS) {
    const re = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(lower)) problems.push(`banned word: "${w}"`);
  }
  for (const p of CTA_LIFT_PHRASES) if (lower.includes(p)) problems.push(`CTA lift: "${p}"`);
  if (all.includes("!")) problems.push("exclamation mark in narration");
  const total = words(all).length;
  const wps = total / script.total_duration_seconds;
  if (wps > WORDS_PER_SECOND_MAX)
    problems.push(`${wps.toFixed(2)} words/s exceeds ${WORDS_PER_SECOND_MAX}`);
  for (const s of script.sections) {
    for (const sentence of s.text
      .split(/[.?!]+/)
      .map((x) => x.trim())
      .filter(Boolean)) {
      const n = words(sentence).length;
      if (n > SENTENCE_WORDS_MAX) problems.push(`${s.id}: ${n}-word sentence`);
      else if (n > SENTENCE_WORDS_TARGET)
        notes.push(`${s.id}: ${n} words, target ${SENTENCE_WORDS_TARGET}`);
    }
  }
  return problems.length
    ? fail("narration breaks the voice", problems)
    : ok(`${total} words at ${wps.toFixed(2)} words/s`, notes);
}

const COMMAND_RE = /\b(bunx|npx|npm|pnpm|yarn|bun run|bun install|curl|git clone|docker run)\b/i;

/** s2-install: "Do not read the command aloud. The viewer can see it." */
export function dontReadTheCommand(script: Script): GateResult {
  const hits: string[] = [];
  for (const s of script.sections) {
    // A text card's lines are meant to be spoken (the film says "Most founders don't." as it draws it).
    // The rule is for commands and URLs the viewer can already see on a capture or terminal beat.
    if ((s.kind ?? "capture") !== "text_card") {
      for (const item of s.on_screen ?? [])
        if (s.text.includes(item)) hits.push(`${s.id}: reads "${item}" aloud`);
    }
    const m = s.text.match(COMMAND_RE);
    if (m) hits.push(`${s.id}: narration contains "${m[0]}"`);
  }
  return hits.length
    ? fail("the voice reads what the viewer can already see", hits)
    : ok("no commands in narration");
}

/** pause_policy: full stops get real silence; never speak over a beat where the viewer reads UI. */
export function silenceRespected(script: Script): GateResult {
  const short: string[] = [];
  const notes: string[] = [];
  const last = script.sections.length - 1;
  script.sections.forEach((s, i) => {
    // The close holds in silence by construction; its cue is the scene, not the pause.
    if (i !== last && s.delivery_cues.pause_after_seconds < PAUSE_AFTER_MIN)
      short.push(
        `${s.id}: pause_after ${s.delivery_cues.pause_after_seconds}s < ${PAUSE_AFTER_MIN}s`,
      );
    if ((s.kind === "capture" || s.kind === "terminal") && s.speak_after_settle == null)
      notes.push(`${s.id}: UI beat without speak_after_settle`);
  });
  return short.length
    ? fail("silence is not respected", short)
    : ok("every full stop gets its silence", notes);
}

export function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** The bed is score.mp3 until music becomes adjustable. Not a phonk loop, not a lofi bed, not froid. */
export function bedIsScore(bedPath: string): GateResult {
  const got = sha256File(bedPath);
  return got === BED_SHA256
    ? ok("bed is score.mp3")
    : fail(`bed ${resolve(bedPath)} is not score.mp3 (sha256 ${got.slice(0, 12)}…)`);
}

/** d-009: "The silent cut is not a mute." Narration-only content is promoted to on-canvas type. */
export function silentCutIsNotAMute(script: Script): GateResult {
  const missing = script.sections
    .filter((s) => s.narration_only && !s.silentFallback)
    .map((s) => s.id);
  return missing.length
    ? fail("narration-only beats have no on-canvas fallback for the silent cut", missing)
    : ok("silent cut carries what the voice carries");
}

function walk(dir: string, exts: string[], acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, exts, acc);
    else if (exts.includes(extname(name))) acc.push(p);
  }
  return acc;
}

const SPRING_LITERAL_RE = /\b(damping|stiffness)\s*:\s*\d/;

/** OneShotLaunch.tsx: "one easing vocabulary for the whole piece." Only motion.ts may spell a spring out. */
export function oneMotionVocabulary(
  dirs: string[],
  allowed: string[] = [resolve(import.meta.dirname, "motion.ts")],
): GateResult {
  const allow = new Set(allowed.map((p) => resolve(p)));
  const offenders: string[] = [];
  for (const dir of dirs) {
    for (const f of walk(dir, [".ts", ".tsx"])) {
      if (allow.has(resolve(f))) continue;
      if (SPRING_LITERAL_RE.test(readFileSync(f, "utf8"))) offenders.push(f);
    }
  }
  return offenders.length
    ? fail("a spring config lives outside motion.ts", offenders)
    : ok("one motion vocabulary");
}

/** d-001: "Only real pixels carry that." Text cards open and close; the middle is captured. */
export function realPixels(scenes: Scene[]): GateResult {
  if (!scenes.length) return fail("no scenes");
  // The end tag is appended after the piece; it is neither argument nor pixels.
  const total = scenes.filter((s) => s.kind !== "endtag").reduce((a, s) => a + sceneDur(s), 0);
  const pixels = scenes
    .filter((s) => s.kind === "capture" || s.kind === "terminal")
    .reduce((a, s) => a + sceneDur(s), 0);
  const ratio = total ? pixels / total : 0;
  const problems: string[] = [];
  if (ratio < REAL_PIXELS_MIN)
    problems.push(`${(ratio * 100).toFixed(0)}% real pixels, need ${REAL_PIXELS_MIN * 100}%`);
  scenes.forEach((s, i) => {
    const edge = i === 0 || i >= scenes.length - 2;
    if (s.kind === "text_card" && !edge)
      problems.push(`${s.id}: text card in the middle of the piece`);
  });
  return problems.length
    ? fail("the picture is designed where it should be captured", problems)
    : ok(`${(ratio * 100).toFixed(0)}% real pixels`);
}

/** provider_notes: settings are fixed; a per-call override is an explainer voice waiting to happen. */
export function flatEnergy(req: TtsRequest): GateResult {
  const diffs = (Object.keys(TTS_REQUEST) as (keyof TtsRequest)[])
    .filter((k) => req[k] !== TTS_REQUEST[k])
    .map((k) => `${k}: ${String(req[k])} (baseline ${String(TTS_REQUEST[k])})`);
  return diffs.length
    ? fail("TTS request deviates from the baseline voice", diffs)
    : ok("voice settings match the baseline");
}

const FORBIDDEN_IMPORT_RE =
  /from\s+["'](remotion|@remotion\/|react|playwright|@playwright\/|elevenlabs|@elevenlabs\/|\.\.\/\.\.\/apps\/|\.\.\/\.\.\/\.\.\/apps\/)/;

/** This package is imported by a server. It must not drag a renderer, a browser, or an app in. */
export function packageBoundary(srcDir: string = import.meta.dirname): GateResult {
  const offenders: string[] = [];
  for (const f of walk(srcDir, [".ts", ".tsx"])) {
    const m = readFileSync(f, "utf8").match(FORBIDDEN_IMPORT_RE);
    if (m) offenders.push(`${f}: ${m[0]}`);
  }
  return offenders.length
    ? fail("baseline imports something a server cannot", offenders)
    : ok("baseline is pure");
}

export interface GateContext {
  script: Script;
  stems?: Stem[];
  observed?: string[];
  scenes?: Scene[];
  bedPath?: string;
  tts?: TtsRequest;
  /** Directories the film's source lives in, for the motion scan. */
  filmDirs?: string[];
  baselineDir?: string;
}

export type GateName =
  | "measuredTimeline"
  | "noTaughtErrors"
  | "voiceLint"
  | "dontReadTheCommand"
  | "silenceRespected"
  | "bedIsScore"
  | "silentCutIsNotAMute"
  | "oneMotionVocabulary"
  | "realPixels"
  | "flatEnergy"
  | "packageBoundary";

export interface GateReport {
  ok: boolean;
  results: Record<GateName, GateResult>;
  failed: GateName[];
}

/** Run every gate the context can feed. Gates without input are skipped, not passed silently. */
export function runGates(ctx: GateContext): GateReport {
  const results: Record<GateName, GateResult> = {
    measuredTimeline: measuredTimeline(ctx.script, ctx.stems),
    noTaughtErrors: noTaughtErrors(ctx.script, ctx.observed),
    voiceLint: voiceLint(ctx.script),
    dontReadTheCommand: dontReadTheCommand(ctx.script),
    silenceRespected: silenceRespected(ctx.script),
    bedIsScore: ctx.bedPath ? bedIsScore(ctx.bedPath) : skipped("bed"),
    silentCutIsNotAMute: silentCutIsNotAMute(ctx.script),
    oneMotionVocabulary: ctx.filmDirs ? oneMotionVocabulary(ctx.filmDirs) : skipped("film source"),
    realPixels: ctx.scenes ? realPixels(ctx.scenes) : skipped("scene plan"),
    flatEnergy: ctx.tts ? flatEnergy(ctx.tts) : skipped("tts request"),
    packageBoundary: packageBoundary(ctx.baselineDir),
  };
  const failed = (Object.keys(results) as GateName[]).filter((k) => !results[k].ok);
  return { ok: failed.length === 0, results, failed };
}
