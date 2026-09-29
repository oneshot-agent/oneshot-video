/**
 * The front door. One Bun server: the form, the queue, a status page per run, the renders.
 * No framework. `handle()` is exported so tests never bind a port.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { adminPage, formPage, liveFragment, statusPage } from "./html.ts";
import {
  ROOT,
  enqueue,
  listSubmissions,
  readStatus,
  runDir,
  validateEmail,
  validateUrl,
} from "./queue.ts";

/** Where people reach this server. Every entry point hands back `${PUBLIC_URL}/r/<id>`. */
export const publicUrl = () =>
  (process.env["PUBLIC_URL"] ?? "http://localhost:3034").replace(/\/+$/, "");
export const statusUrl = (id: string) => `${publicUrl()}/r/${id}`;

export { enqueue, readStatus, validateUrl } from "./queue.ts";
export type { Status, Submission } from "./queue.ts";

const html = (body: string, status = 200) =>
  new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8" } });

export async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const p = url.pathname;

  if (req.method === "GET" && p === "/") return html(formPage());

  if (req.method === "POST" && p === "/submit") {
    const form = await req.formData();
    const raw = String(form.get("url") ?? "");
    const rawContact = String(form.get("contact") ?? "");
    const v = validateUrl(raw);
    if (!v.ok) return html(formPage({ error: v.reason, url: raw, contact: rawContact }), 422);
    const email = validateEmail(rawContact);
    if (!email) return html(formPage({ error: "email", url: raw, contact: rawContact }), 422);
    const sub = enqueue({
      url: v.url,
      kind: v.kind,
      contact: email,
      hint: String(form.get("hint") ?? "").slice(0, 200),
    });
    // Relative, so it stays on https behind the tunnel (Bun itself sees plain http).
    return new Response(null, { status: 303, headers: { location: `/r/${sub.id}` } });
  }

  // The JSON twin: what the page shows, for agents, the CLI and the page's own poll.
  const json = p.match(/^\/r\/([a-z0-9-]+)\.json$/);
  if (req.method === "GET" && json?.[1]) {
    const id = json[1];
    const sub = listSubmissions().find((s) => s.id === id);
    const st = readStatus(id);
    if (!sub && !st.updated) return Response.json({ error: "no such run" }, { status: 404 });
    return Response.json(
      {
        ...st,
        url: sub?.url,
        kind: sub?.kind ?? "app",
        hint: sub?.hint,
        status_url: statusUrl(id),
        live_html: liveFragment(st),
      },
      { headers: { "cache-control": "no-store" } },
    );
  }

  // Stills, by their index in the status record only: nothing else under runs/ is reachable.
  const still = p.match(/^\/r\/([a-z0-9-]+)\/stills\/(\d+)\.png$/);
  if (req.method === "GET" && still?.[1] && still[2]) {
    const rel = readStatus(still[1]).stills?.[Number(still[2])];
    if (!rel || !/^pages\/[\w.-]+\.png$/.test(rel)) return new Response("no", { status: 404 });
    const file = join(runDir(still[1]), rel);
    if (!existsSync(file)) return new Response("no", { status: 404 });
    return new Response(readFileSync(file), {
      headers: { "content-type": "image/png", "cache-control": "max-age=3600" },
    });
  }

  const run = p.match(/^\/r\/([a-z0-9-]+)$/);
  if (req.method === "GET" && run?.[1]) {
    const id = run[1];
    const sub = listSubmissions().find((s) => s.id === id);
    const st = readStatus(id);
    // A CLI run has a status record but no submission; it still gets its page.
    if (!sub && !st.updated) return html(formPage(), 404);
    return html(statusPage(sub, st));
  }

  const vid = p.match(/^\/videos\/([a-z0-9-]+)\/(voiced|silent)\.mp4$/);
  if (req.method === "GET" && vid?.[1] && vid[2]) {
    const file = join(ROOT, "renders", `${vid[1]}-${vid[2]}.mp4`);
    if (!existsSync(file)) return new Response("not rendered yet", { status: 404 });
    return new Response(Bun.file(file), {
      headers: { "content-type": "video/mp4", "cache-control": "no-store" },
    });
  }

  if (req.method === "GET" && p === "/admin") {
    const key = process.env["INTAKE_ADMIN_KEY"];
    if (!key || url.searchParams.get("key") !== key) return new Response("no", { status: 401 });
    const rows = listSubmissions()
      .map((sub) => ({ sub, st: readStatus(sub.id) }))
      .reverse();
    return html(adminPage(rows));
  }

  return html(formPage(), 404);
}

if (import.meta.main) {
  const port = Number(process.env["INTAKE_PORT"] ?? 3034);
  Bun.serve({ port, fetch: handle });
  console.log(
    `oneshot-video intake · http://localhost:${port} · queue at ${join(ROOT, "intake/queue.jsonl")}`,
  );
}
