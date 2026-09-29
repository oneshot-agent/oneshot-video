/**
 * Read the app (a paid OneShot call, with a receipt), then write the script with OpenRouter.
 * Both clients are injected. The output is gated before it is returned.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CARD_WORDS_MAX,
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
    `Word budget: ${wordBudget(length_s)} words total, hard limit. Each text card at most ${CARD_WORDS_MAX} words; the captures carry the words.`,
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

const countWords = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;

/** Words are runtime. The budget is the film's pace over its whole length; cards get few words so the captures get the seconds. */
export function wordsWithinBudget(
  script: Script,
  length_s: number,
): { ok: boolean; reason: string; notes?: string[] } {
  const budget = wordBudget(length_s);
  const total = script.sections.reduce((n, s) => n + countWords(s.text), 0);
  const notes: string[] = [];
  if (total > budget) notes.push(`${total} words, budget ${budget}`);
  for (const s of script.sections) {
    if ((s.kind ?? "capture") === "text_card" && countWords(s.text) > CARD_WORDS_MAX) {
      notes.push(`${s.id}: ${countWords(s.text)} words on a card, max ${CARD_WORDS_MAX}`);
    }
  }
  return notes.length
    ? { ok: false, reason: "over the word budget", notes }
    : { ok: true, reason: `${total} words within ${budget}` };
}

/** The gates that can run before a recording or a stem exists. */
export function gateScript(script: Script, length_s = 30): void {
  const results = {
    // At script time the timeline is a target, not a measurement; the measured check runs again after narration.
    voiceLint: voiceLint({
      ...script,
      total_duration_seconds: Math.max(script.total_duration_seconds, length_s),
    }),
    wordsWithinBudget: wordsWithinBudget(script, length_s),
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

export const MAX_ATTEMPTS = 3;

/** What to cut, section by section, in numbers the model can act on. */
function cutList(script: Script, length_s: number): string {
  const budget = wordBudget(length_s);
  const total = script.sections.reduce((n, x) => n + countWords(x.text), 0);
  const lines = script.sections.map((s) => {
    const n = countWords(s.text);
    const cap = (s.kind ?? "capture") === "text_card" ? CARD_WORDS_MAX : null;
    return `- ${s.id}: ${n} words${cap && n > cap ? ` → at most ${cap}` : ""}`;
  });
  return [
    `Total ${total} words; the budget is ${budget}${total > budget ? ` → cut ${total - budget}` : ""}.`,
    ...lines,
  ].join("\n");
}

/** Up to three attempts, each retry carrying the gate's own words and a per-section cut list. A third miss stops the run; the taste is not negotiable. */
export async function buildScript(
  opts: BuildScriptOptions,
): Promise<{ script: Script; cost_usd: number; attempts: number }> {
  const length_s = opts.length_s ?? 30;
  const page = await opts.webRead(opts.app_url);
  const system = systemPrompt();
  const user = userPrompt(opts.app_url, page.markdown, length_s);
  let prompt = user;
  let lastError = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const raw = await opts.llm(system, prompt);
    const script = parseScript(raw);
    try {
      gateScript(script, length_s);
      return { script, cost_usd: page.cost_usd ?? 0, attempts: attempt };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      prompt = [
        user,
        "",
        `Attempt ${attempt} did not pass:`,
        lastError,
        cutList(script, length_s),
        "Cut whole clauses rather than shaving every line. Keep the same section ids, keys and kinds. Return the corrected JSON only.",
      ].join("\n");
    }
  }
  throw new Error(`script failed taste gates after ${MAX_ATTEMPTS} attempts: ${lastError}`);
}
