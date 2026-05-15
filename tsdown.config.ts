import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/next.ts", "src/openapi.ts"],
  format: ["esm"],
});
