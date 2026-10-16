import { defineConfig } from "vitest/config";

/** Run the unchanged game suite on Parlor's actual SQLite adapter runtime. */
export default defineConfig({
  resolve: { alias: { "convex-test": "@parlor/cloudflare/testing" } },
  test: { include: ["tests/convex/**/*.test.ts"] },
});
