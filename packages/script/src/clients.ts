/** Real clients for the script stage. Both read their keys from the environment; tests inject fakes instead. */
import { OneShot } from "@oneshot-agent/sdk";
import type { Llm, WebRead } from "./index.ts";

/** OneShot webRead: the page as markdown, a signed receipt, a cost. Same construction as oneshot-gtm. */
export function oneshotWebRead(): WebRead {
  const privateKey = process.env["AGENT_PRIVATE_KEY"];
  if (!privateKey) throw new Error("AGENT_PRIVATE_KEY is not set");
  const agent = new OneShot({ privateKey });
  return async (url) => {
    const r = await agent.webRead({ url });
    return { markdown: r.markdown, cost_usd: r.cost ?? 0 };
  };
}

/** OpenRouter chat completion, JSON object out. Model from OPENROUTER_MODEL. */
export function openRouterLlm(): Llm {
  const key = process.env["OPENROUTER_API_KEY"];
  if (!key) throw new Error("OPENROUTER_API_KEY is not set");
  const model = process.env["OPENROUTER_MODEL"] ?? "anthropic/claude-sonnet-4.5";
  return async (system, user) => {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
        "http-referer": "https://github.com/oneshot-agent/oneshot-video",
        "x-title": "oneshot-video",
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) throw new Error(`openrouter ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("openrouter: empty completion");
    return content;
  };
}

/**
 * Fallback reader for when the agent wallet cannot pay: plain fetch, tags stripped, no receipt.
 * The pipeline prefers oneshotWebRead() and records which one ran in events.jsonl.
 */
export function localWebRead(): WebRead {
  return async (url) => {
    const res = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 oneshot-video" },
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`fetch ${url}: ${res.status}`);
    const html = await res.text();
    const title = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() ?? "";
    const body = html
      .replace(
        /<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<svg[\s\S]*?<\/svg>|<!--[\s\S]*?-->/gi,
        " ",
      )
      .replace(/<(h[1-6])[^>]*>/gi, "\n# ")
      .replace(/<\/(p|div|li|h[1-6]|section|article|tr)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s*\n+/g, "\n\n")
      .trim();
    return { markdown: `# ${title}\n\n${body}`, cost_usd: 0 };
  };
}
