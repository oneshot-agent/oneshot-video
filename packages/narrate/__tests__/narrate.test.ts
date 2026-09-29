import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Script } from "@oneshot-video/shared-types";
import { narrate, silentWav, wavDuration } from "@oneshot-video/narrate";

const script: Script = {
  version: "1.0",
  title: "t",
  total_duration_seconds: 10,
  voice_performance: {
    performance_intent: "",
    pacing_profile: "technical",
    energy_curve: "",
    pause_policy: "",
  },
  sections: [
    {
      id: "a",
      label: "a",
      text: "One line.",
      start_seconds: 0,
      end_seconds: 4,
      delivery_cues: {
        pace: "measured",
        energy: "flat",
        emphasis_words: [],
        pause_before_seconds: 0.4,
        pause_after_seconds: 0.5,
      },
    },
    {
      id: "b",
      label: "b",
      text: "Two lines.",
      start_seconds: 4,
      end_seconds: 10,
      delivery_cues: {
        pace: "measured",
        energy: "flat",
        emphasis_words: [],
        pause_before_seconds: 0,
        pause_after_seconds: 0.35,
      },
    },
  ],
};

describe("narrate", () => {
  it("measures every stem instead of estimating it", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "stems-"));
    const lengths: Record<string, number> = { "One line.": 1.375, "Two lines.": 2.5 };
    const stems = await narrate(script, {
      outDir,
      ext: "wav",
      tts: async (text) => silentWav(lengths[text] ?? 1),
    });
    expect(stems.map((s) => s.id)).toEqual(["a", "b"]);
    expect(stems[0]?.duration_s).toBeCloseTo(1.375, 3);
    expect(stems[1]?.duration_s).toBeCloseTo(2.5, 3);
  });
  it("refuses a request that is not the baseline voice", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "stems-"));
    await expect(
      narrate(script, {
        outDir,
        tts: async () => silentWav(1),
        request: {
          voice_id: "roger",
          model_id: "eleven_multilingual_v2",
          stability: 0.3,
          style: 0.5,
          output_format: "mp3_44100_128",
        },
      }),
    ).rejects.toThrow(/deviates from the baseline voice/);
  });
  it("reads a WAV header", () => expect(wavDuration(silentWav(0.75))).toBeCloseTo(0.75, 6));
});
