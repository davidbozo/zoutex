import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const dir = fileURLToPath(new URL(".", import.meta.url));
const isWindows = process.platform === "win32";

let server: ChildProcess | null = null;

export async function setup() {
  if (!existsSync(`${dir}.next/BUILD_ID`)) {
    throw new Error(
      "Production build not found. Run 'npm run build' in apps/zoutex-playground before running tests.",
    );
  }

  server = spawn("npm", ["run", "start"], {
    cwd: dir,
    stdio: "pipe",
    shell: isWindows,
    env: { ...process.env, NODE_ENV: "production" },
  });

  server.stderr?.on("data", (d: Buffer) => process.stderr.write(d));

  const base = "http://localhost:4321";
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${base}/api/health`);
      if (res.ok) return;
    } catch {
      await sleep(500);
    }
  }
  throw new Error("Next.js server did not start within 60 seconds.");
}

export async function teardown() {
  if (!server) return;
  if (isWindows && server.pid) {
    spawn("taskkill", ["/pid", String(server.pid), "/T", "/F"], { shell: false });
  } else {
    server.kill("SIGTERM");
  }
}
