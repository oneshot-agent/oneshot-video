import * as path from "node:path";
import { defineConfig } from "vitest/config";

const src = (p: string) => path.resolve(import.meta.dirname, p);

export default defineConfig({
  test: {
    include: ["packages/**/__tests__/**/*.test.ts", "apps/**/__tests__/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
  resolve: {
    alias: [
      {
        find: /^@oneshot-agent\/video-baseline$/,
        replacement: src("./packages/baseline/src/index.ts"),
      },
      { find: /^@oneshot-agent\/video-film$/, replacement: src("./packages/film/src/index.ts") },
      {
        find: /^@oneshot-video\/shared-types$/,
        replacement: src("./packages/shared-types/src/index.ts"),
      },
      { find: /^@oneshot-video\/script$/, replacement: src("./packages/script/src/index.ts") },
      { find: /^@oneshot-video\/record$/, replacement: src("./packages/record/src/index.ts") },
      { find: /^@oneshot-video\/narrate$/, replacement: src("./packages/narrate/src/index.ts") },
      { find: /^@oneshot-video\/pipeline$/, replacement: src("./packages/pipeline/src/index.ts") },
    ],
  },
});
