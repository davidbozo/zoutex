import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: "./vitest.globalSetup.ts",
    include: ["tests/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    environment: "node",
    env: {
      TEST_BASE_URL: "http://localhost:4321",
    },
  },
});
