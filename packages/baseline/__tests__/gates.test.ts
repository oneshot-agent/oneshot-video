import { mkdtempSync, writeFileSync } from "node:fs";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { Scene, Script, Stem, TtsRequest } from "@oneshot-video/shared-types";
import {
  BED_PATH,
  TTS_REQUEST,
  bedIsScore,
  dontReadTheCommand,
  flatEnergy,
  measuredTimeline,
  noTaughtErrors,
  oneMotionVocabulary,
  packageBoundary,
  realPixels,
  runGates,
  silenceRespected,
  silentCutIsNotAMute,
  voiceLint,
} from "@oneshot-agent/video-baseline";

const here = import.meta.dirname;
const read = <T>(p: string): T =>
  JSON.parse(readFileSync(resolve(here, "../fixtures", p), "utf8")) as T;

const film = read<Script>("oneshot-gtm-launch.script.json");
const filmScenes = read<Scene[]>("oneshot-gtm-launch.scenes.json");
const v1 = read<Script>("v1-shaped.script.json");
const v1meta = v1.metadata as { bed: string; tts: TtsRequest; observed: string[] };

/** Stems as ffprobe would have measured them: the window minus the cued pauses. */
const measuredStems = (s: Script): Stem[] =>
  s.sections.map((x) => ({
    id: x.id,
    path: `stems/${x.id}.mp3`,
    duration_s:
      x.end_seconds -
      x.start_seconds -
      x.delivery_cues.pause_before_seconds -
      x.delivery_cues.pause_after_seconds,
  }));

const filmDir = resolve(here, "../../film/src");
const baselineDir = resolve(here, "../src");

describe("the launch film passes every gate", () => {
  it("measuredTimeline", () => expect(measuredTimeline(film, measuredStems(film)).ok).toBe(true));
  it("noTaughtErrors", () => expect(noTaughtErrors(film, []).ok).toBe(true));
  it("voiceLint", () => {
    const r = voiceLint(film);
    expect(r.ok, r.reason + " " + (r.notes ?? []).join("; ")).toBe(true);
  });
  it("dontReadTheCommand", () => expect(dontReadTheCommand(film).ok).toBe(true));
  it("silenceRespected", () => expect(silenceRespected(film).ok).toBe(true));
  it("bedIsScore", () => expect(bedIsScore(BED_PATH).ok).toBe(true));
  it("silentCutIsNotAMute", () => expect(silentCutIsNotAMute(film).ok).toBe(true));
  it("oneMotionVocabulary", () => {
    const r = oneMotionVocabulary([filmDir, baselineDir]);
    expect(r.ok, (r.notes ?? []).join("; ")).toBe(true);
  });
  it("realPixels", () => expect(realPixels(filmScenes).ok).toBe(true));
  it("flatEnergy", () => expect(flatEnergy(TTS_REQUEST).ok).toBe(true));
  it("packageBoundary", () => {
    const r = packageBoundary(baselineDir);
    expect(r.ok, (r.notes ?? []).join("; ")).toBe(true);
  });
  it("runGates reports ok", () => {
    const report = runGates({
      script: film,
      stems: measuredStems(film),
      observed: [],
      scenes: filmScenes,
      bedPath: BED_PATH,
      tts: TTS_REQUEST,
      filmDirs: [filmDir],
      baselineDir,
    });
    expect(report.failed).toEqual([]);
    expect(report.ok).toBe(true);
  });
});

describe("the v1-shaped script fails, by name", () => {
  const v1Scenes: Scene[] = v1.sections.map((s) => ({
    id: s.id,
    kind: s.kind ?? "capture",
    start_seconds: s.start_seconds,
    end_seconds: s.end_seconds,
  }));
  const phonk = join(mkdtempSync(join(tmpdir(), "bed-")), "phonk_source.mp3");
  writeFileSync(phonk, "not the score");

  const report = runGates({
    script: v1,
    stems: v1.sections.map((s) => ({ id: s.id, path: "x", duration_s: 3.1 })),
    observed: v1meta.observed,
    scenes: v1Scenes,
    bedPath: phonk,
    tts: v1meta.tts,
    filmDirs: [filmDir],
    baselineDir,
  });

  it.each([
    "measuredTimeline",
    "noTaughtErrors",
    "voiceLint",
    "dontReadTheCommand",
    "silenceRespected",
    "bedIsScore",
    "silentCutIsNotAMute",
    "realPixels",
    "flatEnergy",
  ] as const)("%s fails", (name) => {
    expect(report.results[name].ok, report.results[name].reason).toBe(false);
  });

  it("fails at least six gates", () => expect(report.failed.length).toBeGreaterThanOrEqual(6));

  it("names the historical 404: the init command that never shipped", () => {
    expect(report.results.noTaughtErrors.notes?.join(" ")).toContain("bunx oneshot-gtm init");
  });

  it("catches a spring config outside motion.ts", () => {
    const dir = mkdtempSync(join(tmpdir(), "film-"));
    writeFileSync(
      join(dir, "Bouncy.tsx"),
      "spring({ frame, fps, config: { damping: 20, stiffness: 120 } })",
    );
    expect(oneMotionVocabulary([dir]).ok).toBe(false);
  });

  it("catches a baseline that imports a renderer", () => {
    const dir = mkdtempSync(join(tmpdir(), "base-"));
    writeFileSync(join(dir, "oops.ts"), 'import { spring } from "remotion";');
    expect(packageBoundary(dir).ok).toBe(false);
  });
});
