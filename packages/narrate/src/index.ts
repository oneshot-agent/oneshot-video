/**
 * One stem per section with the baseline voice; every stem measured, never estimated.
 * The TTS client is injected so tests never pay and the flatEnergy gate sees the exact request.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { TTS_REQUEST, flatEnergy } from "@oneshot-agent/video-baseline";
import type { Script, Stem, TtsRequest } from "@oneshot-video/shared-types";

export type Tts = (text: string, req: TtsRequest) => Promise<Uint8Array>;

/** Duration in seconds. ffprobe when present; a WAV header otherwise, so tests are hermetic. */
export function probeDuration(path: string): number {
  const p = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", path],
    { encoding: "utf8" },
  );
  if (p.status === 0) {
    const d = Number.parseFloat(p.stdout.trim());
    if (Number.isFinite(d)) return d;
  }
  return wavDuration(readFileSync(path));
}

export function wavDuration(buf: Buffer): number {
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE")
    throw new Error("not a WAV file and ffprobe unavailable");
  const byteRate = buf.readUInt32LE(28);
  let off = 12;
  while (off + 8 <= buf.length) {
    const id = buf.toString("ascii", off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === "data") return size / byteRate;
    off += 8 + size + (size % 2);
  }
  throw new Error("WAV without data chunk");
}

/** A silent PCM WAV of the given length; used by tests as a stand-in for a stem. */
export function silentWav(seconds: number, sampleRate = 8000): Buffer {
  const samples = Math.round(seconds * sampleRate);
  const data = samples * 2;
  const buf = Buffer.alloc(44 + data);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + data, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(data, 40);
  return buf;
}

export interface NarrateOptions {
  outDir: string;
  tts: Tts;
  /** Only the baseline request is accepted. Passing anything else is how an explainer voice gets in. */
  request?: TtsRequest;
  ext?: "mp3" | "wav";
}

/** How long a section with no voice line holds, in seconds. */
export const SILENT_STEM_S = 2;

export async function narrate(script: Script, opts: NarrateOptions): Promise<Stem[]> {
  const req = opts.request ?? TTS_REQUEST;
  const g = flatEnergy(req);
  if (!g.ok) throw new Error(`narrate: ${g.reason} — ${g.notes?.join("; ")}`);
  mkdirSync(opts.outDir, { recursive: true });
  const stems: Stem[] = [];
  for (const s of script.sections) {
    const path = join(opts.outDir, `${s.id}.${opts.ext ?? "mp3"}`);
    if (!s.text.trim()) {
      // A card with no voice line (a silent close) gets a short silent stem, not a TTS call:
      // the timeline still needs a window for it, and the TTS API rejects empty text.
      const r = spawnSync("ffmpeg", [
        "-v",
        "error",
        "-y",
        "-f",
        "lavfi",
        "-i",
        "anullsrc=r=44100:cl=mono",
        "-t",
        String(SILENT_STEM_S),
        path,
      ]);
      if (r.status !== 0) throw new Error(`narrate: could not write a silent stem for ${s.id}`);
    } else {
      writeFileSync(path, await opts.tts(s.text, req));
    }
    stems.push({ id: s.id, path, duration_s: probeDuration(path) });
  }
  writeFileSync(join(opts.outDir, "stems.json"), JSON.stringify(stems, null, 2));
  return stems;
}
