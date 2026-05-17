import { defineConfig } from "tsdown";

export default defineConfig([
  {
    entry: {
      index: "src/define/index.ts",
      next: "src/next/index.ts",
      openapi: "src/openapi/index.ts",
    },
    format: ["esm"],
  },
  {
    entry: { cli: "src/cli/index.ts" },
    format: ["esm"],
    banner: "#!/usr/bin/env node",
    deps: { neverBundle: ["typescript"] },
  },
]);
