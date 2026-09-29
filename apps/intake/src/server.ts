/**
 * The front door. One Bun server: the form, the queue, a status page per run, the renders.
 * No framework. `handle()` is exported so tests never bind a port.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { adminPage, formPage, statusPage } from "./html.ts";
import { ROOT, enqueue, listSubmissions, readStatus, validateUrl } from "./queue.ts";

const html = (body: string, status = 200) => new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8" } });

export async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const p = url.pathname;

  if (req.method === "GET" && p === "/") return html(formPage());

  if (req.method === "POST" && p === "/submit") {
    const form = await req.formData();
    const raw = String(form.get("url") ?? "");
    const v = validateUrl(raw);
    if (!v.ok) return html(formPage({ error: v.reason, url: raw }), 422);
    const sub = enqueue({ url: v.url, contact: String(form.get("contact") ?? "").slice(0, 120), hint: String(form.get("hint") ?? "").slice(0, 200) });
    return Response.redirect(new URL(`/r/${sub.id}`, url).toString(), 303);
  }

  const run = p.match(/^\/r\/([a-z0-9-]+)$/);
  if (req.method === "GET" && run?.[1]) {
    const id = run[1];
    const sub = listSubmissions().find((s) => s.id === id);
    if (!sub) return html(formPage(), 404);
    return html(statusPage(sub, readStatus(id)));
  }

  const vid = p.match(/^\/videos\/([a-z0-9-]+)\/(voiced|silent)\.mp4$/);
  if (req.method === "GET" && vid?.[1] && vid[2]) {
    const file = join(ROOT, "renders", `${vid[1]}-${vid[2]}.mp4`);
    if (!existsSync(file)) return new Response("not rendered yet", { status: 404 });
    return new Response(Bun.file(file), { headers: { "content-type": "video/mp4", "cache-control": "no-store" } });
  }

  if (req.method === "GET" && p === "/admin") {
    const key = process.env["INTAKE_ADMIN_KEY"];
    if (!key || url.searchParams.get("key") !== key) return new Response("no", { status: 401 });
    const rows = listSubmissions().map((sub) => ({ sub, st: readStatus(sub.id) })).reverse();
    return html(adminPage(rows));
  }

  return html(formPage(), 404);
}

if (import.meta.main) {
  const port = Number(process.env["INTAKE_PORT"] ?? 3034);
  Bun.serve({ port, fetch: handle });
  console.log(`oneshot-video intake · http://localhost:${port} · queue at ${join(ROOT, "intake/queue.jsonl")}`);
}
