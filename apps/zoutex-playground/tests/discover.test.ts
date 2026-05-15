import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { beforeAll, describe, expect, test } from "vitest";

const execFileAsync = promisify(execFile);

const CLI = fileURLToPath(new URL("../../../dist/cli.mjs", import.meta.url));
const PLAYGROUND_ROOT = fileURLToPath(new URL("../", import.meta.url));

type CliResult = { stdout: string; exitCode: number };

async function runCli(root: string): Promise<CliResult> {
  try {
    const { stdout } = await execFileAsync("node", [CLI, "discover", "--root", root]);
    return { stdout, exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout: string; code: number };
    return { stdout: e.stdout ?? "", exitCode: e.code ?? 1 };
  }
}

describe("discover", () => {
  let result: CliResult;

  beforeAll(async () => {
    result = await runCli(PLAYGROUND_ROOT);
  });

  test("exits 1 when a declared method is not exported", () => {
    expect(result.exitCode).toBe(1);
  });

  test("flags the missing DELETE export on /api/tags", () => {
    expect(result.stdout).toContain("/api/tags");
    expect(result.stdout).toContain("DELETE");
    expect(result.stdout).toMatch(/not exported/i);
  });

  test("reports valid ZouteX routes as all exported", () => {
    expect(result.stdout).toContain("/api/users");
    expect(result.stdout).toContain("/api/posts");
    expect(result.stdout).toContain("/api/auth/me");
    const validRouteLines = result.stdout
      .split("\n")
      .filter(
        (l) =>
          l.includes("/api/users") ||
          l.includes("/api/posts") ||
          l.includes("/api/auth/me"),
      );
    for (const line of validRouteLines) {
      expect(line).toContain("all exported");
    }
  });

  test("lists plain routes without ZouteX label", () => {
    const lines = result.stdout.split("\n");
    const healthLine = lines.find((l) => l.includes("/api/health"));
    expect(healthLine).toBeDefined();
    expect(healthLine).toContain("plain");
  });
});
