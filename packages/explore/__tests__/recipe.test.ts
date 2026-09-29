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
  it("refuses a repo that needs a database unless a hint starts it", () => {
    const facts = {
      files: ["package.json", ".env.example"],
      packageJson: { scripts: { dev: "next dev" } },
      envExample: "DATABASE_URL=postgres://x\nAPI_KEY=",
    };
    const r = recipeFor(facts);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toMatch(/DATABASE_URL/);
    const hinted = recipeFor(facts, "start: ONESHOT_GTM_DEMO=1 bun run ui; port: 3030");
    expect(hinted.ok && hinted.recipe.start).toBe("ONESHOT_GTM_DEMO=1 bun run ui");
    expect(hinted.ok && hinted.recipe.ports).toEqual([3030]);
  });
  it("refuses compose, python and scriptless repos with a reason", () => {
    expect(
      recipeFor({
        files: ["docker-compose.yml", "package.json"],
        packageJson: { scripts: { dev: "x" } },
      }).ok,
    ).toBe(false);
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
