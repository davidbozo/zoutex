import { defineConfig } from "tsdown";

export default defineConfig([
  {
    entry: ["src/index.ts", "src/next.ts", "src/openapi.ts"],
    format: ["esm"],
  },
  {
    entry: { cli: "src/cli/index.ts" },
    format: ["esm"],
    banner: "#!/usr/bin/env node",
    deps: { neverBundle: ["typescript"] },
  },
]);
