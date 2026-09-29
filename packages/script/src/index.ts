/**
 * Read the app (a paid OneShot call, with a receipt), then write the script with OpenRouter.
 * Both clients are injected. The output is gated before it is returned.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  OPENING_SENTENCE,
  SHAPE_30S,
  TONE,
  dontReadTheCommand,
  silenceRespected,
  voiceLint,
  wordBudget,
} from "@oneshot-agent/video-baseline";
import type { Script } from "@oneshot-video/shared-types";

export type WebRead = (url: string) => Promise<{ markdown: string; cost_usd?: number }>;
export type Llm = (system: string, user: string) => Promise<string>;

export const PROMPT_PATH = resolve(import.meta.dirname, "../prompts/script.md");
const EXEMPLAR_PATH = resolve(
  import.meta.dirname,
  "../../baseline/fixtures/oneshot-gtm-launch.script.json",
);

export interface BuildScriptOptions {
  app_url: string;
  length_s?: number;
  webRead: WebRead;
  llm: Llm;
}

export function systemPrompt(): string {
  return readFileSync(PROMPT_PATH, "utf8");
}

export function userPrompt(app_url: string, markdown: string, length_s: number): string {
  const exemplar = readFileSync(EXEMPLAR_PATH, "utf8");
  const shape = SHAPE_30S.map((b) => `- ${b.id} (${b.kind}, ~${b.target_s}s): ${b.role}`).join(
    "\n",
  );
  return [
    `App: ${app_url}`,
    `Length: ${length_s} s`,
    `Word budget: ${wordBudget(length_s)} words total`,
    `Tone: ${TONE}`,
    OPENING_SENTENCE,
    "",
    "Shape:",
    shape,
    "",
    "What the page says (markdown, truncated):",
    markdown.slice(0, 12_000),
    "",
    "Exemplar (the launch film's script):",
    exemplar,
  ].join("\n");
}

export function parseScript(raw: string): Script {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("script: model returned no JSON object");
  const obj = JSON.parse(raw.slice(start, end + 1)) as Partial<Script>;
  if (!Array.isArray(obj.sections) || !obj.sections.length) throw new Error("script: no sections");
  if (typeof obj.total_duration_seconds !== "number")
    throw new Error("script: no total_duration_seconds");
  for (const s of obj.sections) {
    if (!s.id || typeof s.text !== "string" || !s.delivery_cues)
      throw new Error(`script: malformed section ${JSON.stringify(s).slice(0, 80)}`);
  }
  return obj as Script;
}

/** The three gates that can run before a recording or a stem exists. */
export function gateScript(script: Script): void {
  const results = {
    voiceLint: voiceLint(script),
    dontReadTheCommand: dontReadTheCommand(script),
    silenceRespected: silenceRespected(script),
  };
  const failed = Object.entries(results).filter(([, r]) => !r.ok);
  if (failed.length) {
    throw new Error(
      "script failed taste gates: " +
        failed
          .map(([k, r]) => `${k} (${r.reason}${r.notes ? ": " + r.notes.join("; ") : ""})`)
          .join(" · "),
    );
  }
}

export async function buildScript(
  opts: BuildScriptOptions,
): Promise<{ script: Script; cost_usd: number }> {
  const length_s = opts.length_s ?? 30;
  const page = await opts.webRead(opts.app_url);
  const raw = await opts.llm(systemPrompt(), userPrompt(opts.app_url, page.markdown, length_s));
  const script = parseScript(raw);
  gateScript(script);
  return { script, cost_usd: page.cost_usd ?? 0 };
}
