import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { defineCommand } from "citty";
import pc from "picocolors";
import {
  analyzeRouteContent,
  deriveUrlPath,
  printSummary,
  type RouteInfo,
} from "./discover.utils.js";

export const discoverCommand = defineCommand({
  meta: {
    name: "discover",
    description:
      "Scan the project for ZouteX route files and validate handler exports",
  },
  args: {
    root: {
      type: "string",
      description: "Project root directory to scan",
      default: ".",
    },
  },
  async run({ args }) {
    const rootDir = resolve(args.root);
    console.log(`\nDiscovering routes in ${pc.cyan(rootDir)}...\n`);

    const appDir = await findAppDir(rootDir);
    if (!appDir) {
      console.error(pc.red("Error: could not find app/ or src/app/ directory"));
      process.exit(1);
    }

    console.log(`Found app dir: ${pc.dim(relative(rootDir, appDir))}\n`);

    const routeFiles = await findRouteFiles(appDir);
    const routes = await Promise.all(
      routeFiles.map((f) => analyzeRouteFile(f, appDir)),
    );

    routes.sort((a, b) => a.urlPath.localeCompare(b.urlPath));

    printSummary(routes);

    const hasErrors = routes.some((r) => r.missingExports.length > 0);
    if (hasErrors) process.exit(1);
  },
});

export async function findAppDir(rootDir: string): Promise<string | null> {
  for (const candidate of ["src/app", "app"]) {
    const full = join(rootDir, candidate);
    try {
      const s = await stat(full);
      if (s.isDirectory()) return full;
    } catch {
      // not found, try next
    }
  }
  return null;
}

export async function findRouteFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await findRouteFiles(full);
      results.push(...nested);
    } else if (entry.name === "route.ts" || entry.name === "route.tsx") {
      results.push(full);
    }
  }
  return results;
}

async function analyzeRouteFile(
  filePath: string,
  appDir: string,
): Promise<RouteInfo> {
  const content = await readFile(filePath, "utf-8");
  const urlPath = deriveUrlPath(filePath, appDir);
  return analyzeRouteContent(content, filePath, urlPath);
}
