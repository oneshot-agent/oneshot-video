import { describe, expect, it } from "vitest";
import { parseSetupHint, pathsFromHint, recipeFor } from "@oneshot-video/explore";

describe("recipe", () => {
  it("bun repo with a dev script boots with bun", () => {
    const r = recipeFor({
      files: ["package.json", "bun.lock"],
      packageJson: { scripts: { dev: "bun run src/server.ts" } },
    });
    expect(r.ok && r.recipe.start).toBe("bun run dev");
    expect(r.ok && r.recipe.runtime).toBe("bun");
  });
  it("wires Postgres and Redis keys to the box's own services", () => {
    const r = recipeFor({
      files: ["package.json", ".env.example"],
      packageJson: { scripts: { dev: "next dev" } },
      envExample: "POSTGRES_URL=\nPOSTGRES_PRISMA_URL=\nREDIS_URL=\nAUTH_SECRET=",
    });
    expect(r.ok).toBe(true);
    expect(r.ok && r.recipe.env).toEqual({
      POSTGRES_URL: "postgresql://demo:demo@localhost:5432/demo",
      POSTGRES_PRISMA_URL: "postgresql://demo:demo@localhost:5432/demo",
      REDIS_URL: "redis://localhost:6379",
    });
  });
  it("refuses a service the box does not run, unless a hint starts the app", () => {
    const facts = {
      files: ["package.json", ".env.example"],
      packageJson: { scripts: { dev: "next dev" } },
      envExample: "MONGODB_URI=mongodb://x\nAPI_KEY=",
    };
    const r = recipeFor(facts);
    expect(!r.ok && r.reason).toMatch(/MONGODB_URI/);
    const hinted = recipeFor(facts, "start: ONESHOT_GTM_DEMO=1 bun run ui; port: 3030");
    expect(hinted.ok && hinted.recipe.start).toBe("ONESHOT_GTM_DEMO=1 bun run ui");
    expect(hinted.ok && hinted.recipe.ports).toEqual([3030]);
  });
  it("boots compose repos on the local services; refuses python and scriptless repos", () => {
    const compose = recipeFor({
      files: ["docker-compose.yml", "package.json"],
      packageJson: { scripts: { dev: "x" } },
    });
    expect(compose.ok).toBe(true);
    expect(compose.ok && compose.recipe.notes.join(" ")).toMatch(/docker-compose/);
    expect(recipeFor({ files: ["pyproject.toml"] }).ok).toBe(false);
    expect(
      recipeFor({ files: ["package.json"], packageJson: { scripts: { test: "vitest" } } }).ok,
    ).toBe(false);
  });
  it("hints parse", () => {
    expect(parseSetupHint("install: pnpm i; start: pnpm dev; port: 5173")).toEqual({
      install: "pnpm i",
      start: "pnpm dev",
      ports: [5173],
    });
    expect(pathsFromHint("show /queue then /receipts, and the measure table")).toEqual([
      "/queue",
      "/receipts",
    ]);
  });
});
