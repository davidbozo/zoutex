import type { Dirent } from "node:fs";
import * as fsp from "node:fs/promises";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { findAppDir, findRouteFiles } from "./discover.js";
import {
  analyzeRouteContent,
  buildUrlPath,
  deriveUrlPath,
} from "./discover.utils.js";

vi.mock("node:fs/promises");

function makeDirent(name: string, isDir: boolean): Dirent {
  return {
    name,
    isDirectory: () => isDir,
    isFile: () => !isDir,
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isSymbolicLink: () => false,
    isFIFO: () => false,
    isSocket: () => false,
    parentPath: "",
    path: "",
  } as unknown as Dirent;
}

// ---------------------------------------------------------------------------
// buildUrlPath — pure normalization, no I/O
// ---------------------------------------------------------------------------

describe("buildUrlPath", () => {
  describe("root routes", () => {
    it("returns / for bare route.ts", () => {
      expect(buildUrlPath("route.ts")).toBe("/");
    });
    it("returns / for bare route.tsx", () => {
      expect(buildUrlPath("route.tsx")).toBe("/");
    });
  });

  describe("POSIX-style paths (Linux / macOS)", () => {
    it("single segment", () => {
      expect(buildUrlPath("api/route.ts")).toBe("/api");
    });
    it("two segments", () => {
      expect(buildUrlPath("api/users/route.ts")).toBe("/api/users");
    });
    it("dynamic segment [id]", () => {
      expect(buildUrlPath("api/users/[id]/route.ts")).toBe("/api/users/[id]");
    });
    it("catch-all [...slug]", () => {
      expect(buildUrlPath("blog/[...slug]/route.ts")).toBe("/blog/[...slug]");
    });
    it("deeply nested", () => {
      expect(buildUrlPath("a/b/c/d/route.ts")).toBe("/a/b/c/d");
    });
    it("route.tsx extension stripped", () => {
      expect(buildUrlPath("api/users/route.tsx")).toBe("/api/users");
    });
  });

  describe("Windows-style paths (backslash separators)", () => {
    it("single segment", () => {
      expect(buildUrlPath("api\\route.ts")).toBe("/api");
    });
    it("two segments", () => {
      expect(buildUrlPath("api\\users\\route.ts")).toBe("/api/users");
    });
    it("dynamic segment [id]", () => {
      expect(buildUrlPath("api\\users\\[id]\\route.ts")).toBe(
        "/api/users/[id]",
      );
    });
    it("catch-all [...slug]", () => {
      expect(buildUrlPath("blog\\[...slug]\\route.ts")).toBe("/blog/[...slug]");
    });
    it("deeply nested", () => {
      expect(buildUrlPath("a\\b\\c\\d\\route.ts")).toBe("/a/b/c/d");
    });
  });

  describe("mixed separators", () => {
    it("forward and back slashes combined", () => {
      expect(buildUrlPath("a/b\\c/route.tsx")).toBe("/a/b/c");
    });
  });

  describe("route groups (group) — segment stripped from URL", () => {
    it("single group at root", () => {
      expect(buildUrlPath("(auth)/login/route.ts")).toBe("/login");
    });
    it("group wrapping a dynamic segment", () => {
      expect(buildUrlPath("(shop)/users/[id]/route.ts")).toBe("/users/[id]");
    });
    it("nested groups both stripped, becomes root", () => {
      expect(buildUrlPath("(marketing)/(shop)/route.ts")).toBe("/");
    });
    it("group mid-path", () => {
      expect(buildUrlPath("api/(v1)/users/route.ts")).toBe("/api/users");
    });
    it("Windows backslash with group", () => {
      expect(buildUrlPath("(auth)\\login\\route.ts")).toBe("/login");
    });
  });

  describe("optional catch-all [[...slug]]", () => {
    it("POSIX path", () => {
      expect(buildUrlPath("blog/[[...slug]]/route.ts")).toBe(
        "/blog/[[...slug]]",
      );
    });
    it("Windows backslash path", () => {
      expect(buildUrlPath("blog\\[[...slug]]\\route.ts")).toBe(
        "/blog/[[...slug]]",
      );
    });
    it("optional catch-all at root", () => {
      expect(buildUrlPath("[[...slug]]/route.ts")).toBe("/[[...slug]]");
    });
  });
});

// ---------------------------------------------------------------------------
// deriveUrlPath — integration: calls path.relative then buildUrlPath
// ---------------------------------------------------------------------------

describe("deriveUrlPath", () => {
  it("returns / when file is directly in appDir", () => {
    const appDir = "/proj/app";
    expect(deriveUrlPath(`${appDir}/route.ts`, appDir)).toBe("/");
  });

  it("returns /users for one level deep", () => {
    const appDir = "/proj/app";
    expect(deriveUrlPath(`${appDir}/users/route.ts`, appDir)).toBe("/users");
  });

  it("returns /api/users for two levels deep", () => {
    const appDir = "/proj/app";
    expect(deriveUrlPath(`${appDir}/api/users/route.ts`, appDir)).toBe(
      "/api/users",
    );
  });
});

// ---------------------------------------------------------------------------
// analyzeRouteContent — pure AST analysis, no I/O
// ---------------------------------------------------------------------------

const FILE = "/app/users/route.ts";
const URL = "/users";

function analyze(content: string) {
  return analyzeRouteContent(content, FILE, URL);
}

describe("analyzeRouteContent", () => {
  describe("isZouteX detection", () => {
    it("is false when there are no imports", () => {
      expect(analyze("export const GET = () => {};").isZouteX).toBe(false);
    });

    it("is false for an unrelated library import", () => {
      expect(analyze(`import { something } from "other-lib";`).isZouteX).toBe(
        false,
      );
    });

    it("is true for an import from zoutex", () => {
      expect(analyze(`import { defineRoute } from "zoutex";`).isZouteX).toBe(
        true,
      );
    });

    it("is true for an import from zoutex/next", () => {
      expect(
        analyze(`import { toNextHandler } from "zoutex/next";`).isZouteX,
      ).toBe(true);
    });
  });

  describe("declaredMethods via defineRoute", () => {
    it("returns [] when defineRoute is never called", () => {
      expect(
        analyze(`import { defineRoute } from "zoutex";`).declaredMethods,
      ).toEqual([]);
    });

    it("detects a single GET", () => {
      const src = `
        import { defineRoute } from "zoutex";
        const r = defineRoute({ method: "GET", path: "/", responses: {}, handler: async () => ({ status: 200 as const, body: null }) });
      `;
      expect(analyze(src).declaredMethods).toEqual(["GET"]);
    });

    it("detects GET and POST from two calls", () => {
      const src = `
        import { defineRoute } from "zoutex";
        const r1 = defineRoute({ method: "GET", path: "/", responses: {}, handler: async () => ({ status: 200 as const, body: null }) });
        const r2 = defineRoute({ method: "POST", path: "/", responses: {}, handler: async () => ({ status: 200 as const, body: null }) });
      `;
      expect(analyze(src).declaredMethods).toEqual(["GET", "POST"]);
    });

    it("normalises lowercase method to uppercase", () => {
      const src = `
        import { defineRoute } from "zoutex";
        const r = defineRoute({ method: "get", path: "/", responses: {}, handler: async () => ({ status: 200 as const, body: null }) });
      `;
      expect(analyze(src).declaredMethods).toEqual(["GET"]);
    });

    it("deduplicates duplicate method declarations", () => {
      const src = `
        import { defineRoute } from "zoutex";
        const r1 = defineRoute({ method: "GET", path: "/", responses: {}, handler: async () => ({ status: 200 as const, body: null }) });
        const r2 = defineRoute({ method: "GET", path: "/", responses: {}, handler: async () => ({ status: 200 as const, body: null }) });
      `;
      expect(analyze(src).declaredMethods).toEqual(["GET"]);
    });

    it("works with an aliased import", () => {
      const src = `
        import { defineRoute as dr } from "zoutex";
        const r = dr({ method: "POST", path: "/", responses: {}, handler: async () => ({ status: 200 as const, body: null }) });
      `;
      expect(analyze(src).declaredMethods).toEqual(["POST"]);
    });

    it("ignores a function named defineRoute from an unrelated import", () => {
      const src = `
        import { defineRoute } from "other-lib";
        const r = defineRoute({ method: "GET" });
      `;
      expect(analyze(src).declaredMethods).toEqual([]);
    });
  });

  describe("exportedMethods via toNextHandlers (destructuring)", () => {
    it("returns [] when there are no exports", () => {
      expect(
        analyze(`import { toNextHandlers } from "zoutex/next";`)
          .exportedMethods,
      ).toEqual([]);
    });

    it("detects a single GET", () => {
      const src = `
        import { toNextHandlers } from "zoutex/next";
        export const { GET } = toNextHandlers(r);
      `;
      expect(analyze(src).exportedMethods).toEqual(["GET"]);
    });

    it("detects GET and POST from destructuring", () => {
      const src = `
        import { toNextHandlers } from "zoutex/next";
        export const { GET, POST } = toNextHandlers(r);
      `;
      expect(analyze(src).exportedMethods).toEqual(["GET", "POST"]);
    });

    it("works with an aliased import", () => {
      const src = `
        import { toNextHandlers as tnh } from "zoutex/next";
        export const { GET } = tnh(r);
      `;
      expect(analyze(src).exportedMethods).toEqual(["GET"]);
    });

    it("ignores non-exported destructuring", () => {
      const src = `
        import { toNextHandlers } from "zoutex/next";
        const { GET } = toNextHandlers(r);
      `;
      expect(analyze(src).exportedMethods).toEqual([]);
    });

    it("uses propertyName for a renamed binding { GET: MyGET }", () => {
      const src = `
        import { toNextHandlers } from "zoutex/next";
        export const { GET: MyGET } = toNextHandlers(r);
      `;
      expect(analyze(src).exportedMethods).toEqual(["GET"]);
    });
  });

  describe("exportedMethods via toNextHandler (singular)", () => {
    it("detects GET from export const GET = toNextHandler(...)", () => {
      const src = `
        import { toNextHandler } from "zoutex/next";
        export const GET = toNextHandler(r);
      `;
      expect(analyze(src).exportedMethods).toEqual(["GET"]);
    });

    it("detects POST", () => {
      const src = `
        import { toNextHandler } from "zoutex/next";
        export const POST = toNextHandler(r);
      `;
      expect(analyze(src).exportedMethods).toEqual(["POST"]);
    });

    it("works with an aliased import", () => {
      const src = `
        import { toNextHandler as tnh } from "zoutex/next";
        export const GET = tnh(r);
      `;
      expect(analyze(src).exportedMethods).toEqual(["GET"]);
    });

    it("ignores a non-exported const GET = toNextHandler(...)", () => {
      const src = `
        import { toNextHandler } from "zoutex/next";
        const GET = toNextHandler(r);
      `;
      expect(analyze(src).exportedMethods).toEqual([]);
    });
  });

  describe("missingExports", () => {
    it("is empty when all declared methods are exported", () => {
      const src = `
        import { defineRoute } from "zoutex";
        import { toNextHandlers } from "zoutex/next";
        const r = defineRoute({ method: "GET", path: "/", responses: {}, handler: async () => ({ status: 200 as const, body: null }) });
        export const { GET } = toNextHandlers(r);
      `;
      expect(analyze(src).missingExports).toEqual([]);
    });

    it("lists POST when GET is exported but POST is not", () => {
      const src = `
        import { defineRoute } from "zoutex";
        import { toNextHandlers } from "zoutex/next";
        const r1 = defineRoute({ method: "GET", path: "/", responses: {}, handler: async () => ({ status: 200 as const, body: null }) });
        const r2 = defineRoute({ method: "POST", path: "/", responses: {}, handler: async () => ({ status: 200 as const, body: null }) });
        export const { GET } = toNextHandlers(r1);
      `;
      expect(analyze(src).missingExports).toEqual(["POST"]);
    });

    it("lists GET when nothing is exported", () => {
      const src = `
        import { defineRoute } from "zoutex";
        const r = defineRoute({ method: "GET", path: "/", responses: {}, handler: async () => ({ status: 200 as const, body: null }) });
      `;
      expect(analyze(src).missingExports).toEqual(["GET"]);
    });

    it("is empty for a non-ZouteX file", () => {
      expect(analyze("export const GET = () => {};").missingExports).toEqual(
        [],
      );
    });
  });

  describe("full realistic route file", () => {
    it("valid ZouteX route: all methods declared and exported", () => {
      const src = `
        import { defineRoute } from "zoutex";
        import { toNextHandlers } from "zoutex/next";
        const r = defineRoute({ method: "GET", path: "/users", responses: {}, handler: async () => ({ status: 200 as const, body: [] }) });
        export const { GET } = toNextHandlers(r);
      `;
      const result = analyze(src);
      expect(result.isZouteX).toBe(true);
      expect(result.declaredMethods).toEqual(["GET"]);
      expect(result.exportedMethods).toEqual(["GET"]);
      expect(result.missingExports).toEqual([]);
    });

    it("invalid ZouteX route: POST declared but not exported", () => {
      const src = `
        import { defineRoute } from "zoutex";
        import { toNextHandlers } from "zoutex/next";
        const get = defineRoute({ method: "GET", path: "/", responses: {}, handler: async () => ({ status: 200 as const, body: null }) });
        const post = defineRoute({ method: "POST", path: "/", responses: {}, handler: async () => ({ status: 200 as const, body: null }) });
        export const { GET } = toNextHandlers(get);
      `;
      const result = analyze(src);
      expect(result.isZouteX).toBe(true);
      expect(result.declaredMethods).toEqual(["GET", "POST"]);
      expect(result.missingExports).toEqual(["POST"]);
    });

    it("uses the urlPath passed in, not derived from filePath", () => {
      const result = analyzeRouteContent("", FILE, "/custom-url");
      expect(result.urlPath).toBe("/custom-url");
    });
  });
});

// ---------------------------------------------------------------------------
// findAppDir — mocked stat
// ---------------------------------------------------------------------------

describe("findAppDir", () => {
  beforeEach(() => vi.resetAllMocks());

  const ROOT = "/project";

  it("returns src/app when it exists and is a directory", async () => {
    vi.mocked(fsp.stat).mockImplementation(async (p) => {
      if (p === join(ROOT, "src/app"))
        return { isDirectory: () => true } as Awaited<
          ReturnType<typeof fsp.stat>
        >;
      throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    });
    expect(await findAppDir(ROOT)).toBe(join(ROOT, "src/app"));
  });

  it("returns app when src/app does not exist", async () => {
    vi.mocked(fsp.stat).mockImplementation(async (p) => {
      if (p === join(ROOT, "src/app"))
        throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      if (p === join(ROOT, "app"))
        return { isDirectory: () => true } as Awaited<
          ReturnType<typeof fsp.stat>
        >;
      throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    });
    expect(await findAppDir(ROOT)).toBe(join(ROOT, "app"));
  });

  it("returns null when neither directory exists", async () => {
    vi.mocked(fsp.stat).mockRejectedValue(
      Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
    );
    expect(await findAppDir(ROOT)).toBeNull();
  });

  it("skips src/app when it exists but is not a directory", async () => {
    vi.mocked(fsp.stat).mockImplementation(async (p) => {
      if (p === join(ROOT, "src/app"))
        return { isDirectory: () => false } as Awaited<
          ReturnType<typeof fsp.stat>
        >;
      throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    });
    expect(await findAppDir(ROOT)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// findRouteFiles — mocked readdir
// ---------------------------------------------------------------------------

describe("findRouteFiles", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns [] for an empty directory", async () => {
    vi.mocked(fsp.readdir).mockResolvedValue([] as never);
    expect(await findRouteFiles("/app")).toEqual([]);
  });

  it("returns a route.ts file", async () => {
    vi.mocked(fsp.readdir).mockResolvedValue([
      makeDirent("route.ts", false),
    ] as never);
    expect(await findRouteFiles("/app")).toEqual([join("/app", "route.ts")]);
  });

  it("returns a route.tsx file", async () => {
    vi.mocked(fsp.readdir).mockResolvedValue([
      makeDirent("route.tsx", false),
    ] as never);
    expect(await findRouteFiles("/app")).toEqual([join("/app", "route.tsx")]);
  });

  it("ignores non-route files", async () => {
    vi.mocked(fsp.readdir).mockResolvedValue([
      makeDirent("page.ts", false),
      makeDirent("layout.tsx", false),
    ] as never);
    expect(await findRouteFiles("/app")).toEqual([]);
  });

  it("recurses into subdirectories", async () => {
    vi.mocked(fsp.readdir).mockImplementation(async (p: unknown) => {
      if (p === "/app")
        return [
          makeDirent("users", true),
          makeDirent("layout.ts", false),
        ] as never;
      if (p === join("/app", "users"))
        return [makeDirent("route.ts", false)] as never;
      return [] as never;
    });
    expect(await findRouteFiles("/app")).toEqual([
      join("/app", "users", "route.ts"),
    ]);
  });

  it("collects route files from multiple subdirectories", async () => {
    vi.mocked(fsp.readdir).mockImplementation(async (p: unknown) => {
      if (p === "/app")
        return [
          makeDirent("users", true),
          makeDirent("posts", true),
          makeDirent("layout.ts", false),
        ] as never;
      if (p === join("/app", "users"))
        return [makeDirent("route.ts", false)] as never;
      if (p === join("/app", "posts"))
        return [makeDirent("route.tsx", false)] as never;
      return [] as never;
    });
    const result = await findRouteFiles("/app");
    expect(result).toContain(join("/app", "users", "route.ts"));
    expect(result).toContain(join("/app", "posts", "route.tsx"));
    expect(result).toHaveLength(2);
  });
});
