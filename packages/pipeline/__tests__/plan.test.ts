import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { measuredTimeline, realPixels } from "@oneshot-agent/video-baseline";
import type { Script } from "@oneshot-video/shared-types";
import { STAGES, describePlan, planScenes } from "@oneshot-video/pipeline";

const film = JSON.parse(
  readFileSync(
    resolve(import.meta.dirname, "../../baseline/fixtures/oneshot-gtm-launch.script.json"),
    "utf8",
  ),
) as Script;

describe("planScenes", () => {
  const stems = film.sections.map((s, i) => ({
    id: s.id,
    path: `stems/${s.id}.mp3`,
    duration_s: 3.137 + i * 0.41,
  }));
  const { script, scenes, total_seconds } = planScenes(film, stems);

  it("rebuilds windows from stems so measuredTimeline passes", () => {
    expect(measuredTimeline(script, stems).ok).toBe(true);
  });
  it("lays sections end to end and appends the endtag", () => {
    expect(scenes.at(-1)?.kind).toBe("endtag");
    expect(total_seconds).toBeCloseTo(script.total_duration_seconds + 1.2, 6);
    for (let i = 1; i < script.sections.length; i++) {
      expect(script.sections[i]?.start_seconds).toBeCloseTo(
        script.sections[i - 1]?.end_seconds ?? -1,
        9,
      );
    }
  });
  it("text cards open and close; the middle is captured", () => {
    expect(realPixels(scenes).ok).toBe(true);
    expect(scenes[0]?.kind).toBe("text_card");
    expect(scenes.at(-2)?.kind).toBe("text_card");
  });
});

describe("describePlan", () => {
  it("lists the six stages and the baseline voice", () => {
    const p = describePlan({ app_url: "https://oneshotagent.com" });
    expect(p.stages.map((s) => s.stage)).toEqual([...STAGES]);
    expect(p.tts.voice_id).toBe("EXAVITQu4vr4xnSDxMaL");
    expect(p.length_s).toBe(30);
  });
});
