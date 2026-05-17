import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["src/define/types.test.ts"],
    environment: "node",
  },
  coverage: {
    provider: "v8",
    reporter: ["text", "lcov"],
    reportsDirectory: "./coverage",
    include: ["src/**/*.ts"],
    exclude: ["src/**/*.test.ts", "src/define/types.test.ts"],
  },
});
