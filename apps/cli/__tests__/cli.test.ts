import { describe, expect, it, vi } from "vitest";
import { checkUrl, isLocalHost, main, parseArgs, renderPlan, TUNNEL_HINT } from "../src/main.ts";

describe("cli", () => {
  it("parses the surface", () => {
    expect(parseArgs(["https://x", "--length", "20", "--silent-only", "--dry-run"])).toEqual({
      app_url: "https://x",
      length_s: 20,
      silentOnly: true,
      dryRun: true,
      help: false,
      urlCheck: false,
      outDir: "renders",
    });
    expect(() => parseArgs(["--nope"])).toThrow(/unknown argument/);
  });
  it("parses --url-check and --out", () => {
    expect(parseArgs(["https://x", "--url-check", "--out", "build/vids", "--dry-run"])).toEqual({
      app_url: "https://x",
      length_s: 30,
      silentOnly: false,
      dryRun: true,
      help: false,
      urlCheck: true,
      outDir: "build/vids",
    });
  });
  it("defaults --out to renders/", () => {
    expect(parseArgs(["https://x"]).outDir).toBe("renders");
  });
  it("dry run prints six stages and touches nothing", () => {
    const out = renderPlan(parseArgs(["https://oneshotagent.com", "--dry-run"]));
    expect(out).toMatch(/1\. script/);
    expect(out).toMatch(/6\. render/);
    expect(out).toMatch(/Sarah/);
    expect(out).toMatch(/nothing was recorded/);
  });
  it("exits 2 without a url and 0 with --dry-run", async () => {
    expect(await main([])).toBe(2);
    expect(await main(["https://x", "--dry-run"])).toBe(0);
  });
  it("--dry-run output is unchanged by --url-check when the check is not requested", async () => {
    const out1 = renderPlan(parseArgs(["https://oneshotagent.com", "--dry-run"]));
    const out2 = renderPlan(parseArgs(["https://oneshotagent.com", "--dry-run", "--out", "x"]));
    expect(out1).toBe(out2);
  });

  describe("isLocalHost", () => {
    it("flags localhost-shaped hosts", () => {
      expect(isLocalHost("localhost")).toBe(true);
      expect(isLocalHost("127.0.0.1")).toBe(true);
      expect(isLocalHost("0.0.0.0")).toBe(true);
      expect(isLocalHost("myapp.local")).toBe(true);
      expect(isLocalHost("LOCALHOST")).toBe(true);
    });
    it("does not flag real hosts", () => {
      expect(isLocalHost("oneshot-gtm.com")).toBe(false);
      expect(isLocalHost("example.com")).toBe(false);
    });
  });

  describe("checkUrl", () => {
    it("refuses a local host without calling fetch", async () => {
      const fetchImpl = vi.fn();
      const result = await checkUrl("http://localhost:3000", fetchImpl as unknown as typeof fetch);
      expect(result.ok).toBe(false);
      expect(result.message).toContain(TUNNEL_HINT);
      expect(fetchImpl).not.toHaveBeenCalled();
    });
    it("passes for a reachable URL (injected fetch, no network)", async () => {
      const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
      const result = await checkUrl(
        "https://oneshot-gtm.com",
        fetchImpl as unknown as typeof fetch,
      );
      expect(result.ok).toBe(true);
      expect(fetchImpl).toHaveBeenCalledWith(
        "https://oneshot-gtm.com",
        expect.objectContaining({ method: "HEAD" }),
      );
    });
    it("falls back to GET when HEAD fails", async () => {
      const fetchImpl = vi
        .fn()
        .mockRejectedValueOnce(new Error("HEAD not allowed"))
        .mockResolvedValueOnce(new Response(null, { status: 200 }));
      const result = await checkUrl(
        "https://oneshot-gtm.com",
        fetchImpl as unknown as typeof fetch,
      );
      expect(result.ok).toBe(true);
      expect(fetchImpl).toHaveBeenCalledTimes(2);
      expect(fetchImpl).toHaveBeenNthCalledWith(
        2,
        "https://oneshot-gtm.com",
        expect.objectContaining({ method: "GET" }),
      );
    });
    it("fails for a non-2xx/3xx answer", async () => {
      const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
      const result = await checkUrl(
        "https://oneshot-gtm.com",
        fetchImpl as unknown as typeof fetch,
      );
      expect(result.ok).toBe(false);
      expect(result.message).toMatch(/404/);
    });
    it("fails when fetch throws (unreachable host, injected)", async () => {
      const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));
      const result = await checkUrl("https://dead.example", fetchImpl as unknown as typeof fetch);
      expect(result.ok).toBe(false);
      expect(result.message).toMatch(/unreachable/);
    });
  });

  describe("main with --url-check", () => {
    it("exits 3 with the tunnel hint on stderr for a local host", async () => {
      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const fetchImpl = vi.fn();
      const code = await main(
        ["http://localhost:3000", "--url-check", "--dry-run"],
        fetchImpl as unknown as typeof fetch,
      );
      expect(code).toBe(3);
      expect(fetchImpl).not.toHaveBeenCalled();
      const printed = errSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(printed).toContain("cloudflared tunnel --url http://localhost:3000");
      errSpy.mockRestore();
    });
    it("exits 3 for an unreachable host (fetch injected, no network hit)", async () => {
      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));
      const code = await main(
        ["https://dead.example", "--url-check", "--dry-run"],
        fetchImpl as unknown as typeof fetch,
      );
      expect(code).toBe(3);
      expect(fetchImpl).toHaveBeenCalled();
      errSpy.mockRestore();
    });
    it("exits 0 for a reachable host with --dry-run (dry-run output unchanged)", async () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
      const code = await main(
        ["https://oneshot-gtm.com", "--url-check", "--dry-run"],
        fetchImpl as unknown as typeof fetch,
      );
      expect(code).toBe(0);
      const printed = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(printed).toMatch(/nothing was recorded/);
      logSpy.mockRestore();
    });
  });
});
