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
    "",
    `Hard limits, again: ${wordBudget(length_s)} words in total; wedge and close at most ${CARD_WORDS_MAX} words each, counted by spaces.`,
  ].join("\n");
}

/**
 * One card, one line, one small call. After a whole-script retry the model still tends to copy the
 * exemplar's card lengths; asking for a single line under a hard cap is far more reliable.
 */
export async function fixCardLine(
  llm: Llm,
  section: Script["sections"][number],
  cap = CARD_WORDS_MAX,
): Promise<string> {
  const system = `You shorten one line of narration for a product film. Terse, dry, declarative. Keep the meaning. Return the line only, no quotes, no commentary.`;
  for (let i = 0; i < 2; i++) {
    const raw = await llm(
      system,
      `Rewrite this in at most ${cap} words (count by spaces):\n${section.text}`,
    );
    const line =
      raw
        .trim()
        .split("\n")[0]
        ?.replace(/^["'“”]+|["'“”]+$/g, "")
        .trim() ?? "";
    if (line && countWords(line) <= cap) return line;
  }
  return section.text;
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
    const missing = [
      !s.id && "id",
      typeof s.text !== "string" && "text",
      !s.delivery_cues && "delivery_cues",
    ].filter(Boolean);
    if (missing.length)
      throw new Error(
        `script: section ${String(s.id ?? "?")} is missing ${missing.join(", ")}; every section keeps id, text, delivery_cues`,
      );
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
    let script: Script | undefined;
    try {
      script = parseScript(raw);
      // Cards over the cap get a single-line rewrite before the whole script is judged.
      for (const s of script.sections) {
        if ((s.kind ?? "capture") === "text_card" && countWords(s.text) > CARD_WORDS_MAX) {
          s.text = await fixCardLine(opts.llm, s);
          if (s.on_screen?.length && s.on_screen.join(" ").split(/\s+/).length > CARD_WORDS_MAX)
            s.on_screen = [s.text];
        }
      }
      gateScript(script, length_s);
      return { script, cost_usd: page.cost_usd ?? 0, attempts: attempt };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      prompt = [
        user,
        "",
        `Attempt ${attempt} did not pass:`,
        lastError,
        script ? cutList(script, length_s) : "",
        "Cut whole clauses rather than shaving every line. Keep the same section ids, keys and kinds. Return the corrected JSON only.",
      ].join("\n");
    }
  }
  throw new Error(`script failed taste gates after ${MAX_ATTEMPTS} attempts: ${lastError}`);
}
