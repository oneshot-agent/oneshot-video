import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const root = mkdtempSync(join(tmpdir(), "intake-"));
process.env["ONESHOT_VIDEO_ROOT"] = root;
process.env["INTAKE_ADMIN_KEY"] = "k";

const { handle } = await import("../src/server.ts");
const { listSubmissions, readStatus, validateUrl } = await import("../src/queue.ts");

const post = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return handle(new Request("http://x/submit", { method: "POST", body: fd }));
};

describe("intake", () => {
  beforeAll(() => {});
  it("serves the form on the landing's look", async () => {
    const r = await handle(new Request("http://x/"));
    expect(r.status).toBe(200);
    const html = await r.text();
    expect(html).toMatch(/Queue the film/);
    expect(html).toMatch(/DM\+Sans/);
    expect(html).not.toMatch(/radial-gradient|Host Grotesk/);
    expect(html).toMatch(/class="rail-svg"/);
  });
  it("refuses localhost with the tunnel hint and queues nothing", async () => {
    const r = await post({ url: "http://localhost:3000" });
    expect(r.status).toBe(422);
    expect(await r.text()).toMatch(/cloudflared tunnel --url/);
    expect(listSubmissions()).toHaveLength(0);
  });
  it("queues a public URL and redirects to its status page", async () => {
    const r = await post({
      url: "https://oneshot-gtm.com",
      contact: "@j",
      hint: "the receipts page",
    });
    expect(r.status).toBe(303);
    const loc = r.headers.get("location") ?? "";
    expect(loc).toMatch(/\/r\/[a-z0-9-]+$/);
    const id = loc.split("/").pop() as string;
    expect(listSubmissions().map((s) => s.url)).toEqual(["https://oneshot-gtm.com/"]);
    expect(readStatus(id).stage).toBe("queued");
    const page = await (await handle(new Request(loc))).text();
    expect(page).toMatch(/oneshot-gtm\.com/);
    expect(page).toMatch(/http-equiv="refresh"/);
  });
  it("admin is gated", async () => {
    expect((await handle(new Request("http://x/admin"))).status).toBe(401);
    expect((await handle(new Request("http://x/admin?key=k"))).status).toBe(200);
  });
  it("status page stacks the stages as markers and lights the current one", async () => {
    const r = await post({ url: "https://oneshot-gtm.com/status-test" });
    const loc = r.headers.get("location") ?? "";
    const html = await (await handle(new Request(loc))).text();
    expect(html.match(/class="section-marker"/g)?.length).toBe(8);
    expect(html).toMatch(/stage-row is-current/);
    const { writeStatus } = await import("../src/queue.ts");
    const id = loc.split("/").pop() as string;
    writeStatus({
      id,
      stage: "failed",
      updated: "",
      error: "taste gates failed:\nrealPixels: 57% real pixels",
    });
    const failed = await (await handle(new Request(loc))).text();
    expect(failed).toMatch(/stage-failed/);
    expect(failed).toMatch(/It did not ship/);
  });
  it("validateUrl", () => {
    expect(validateUrl("ftp://x")).toEqual({ ok: false, reason: "invalid" });
    expect(validateUrl("http://127.0.0.1:8080")).toEqual({ ok: false, reason: "local" });
    expect(validateUrl(" https://a.b/c ")).toEqual({ ok: true, url: "https://a.b/c" });
  });
});
