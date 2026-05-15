# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ZouteX is a TypeScript library providing type-safe routing for Next.js App Router with automatic OpenAPI 3.1 spec generation. It relies on TypeScript 5.4's `const` generic modifier to preserve literal type keys, and Zod 4 for runtime validation.

## Commands

```sh
npm run build       # Bundle with tsdown (outputs dist/)
npm run typecheck   # tsc --noEmit (type-check only)
npm run check       # Biome lint + format validation
npm run fix         # Biome auto-fix (lint + format)
npm run format      # Biome format only

# Run runtime smoke tests (no test runner — executed directly)
npx tsx src/runtime.test.ts
```

Type-level tests (`src/types.test.ts`) are validated by `npm run typecheck` — they use `@ts-expect-error` comments to assert compile-time errors.

## Architecture

Three published entry points, each a separate bundle:

- `.` (`src/index.ts`) — `defineRoute`, result helpers (`ok`, `notFound`, etc.), types, errors
- `/next` (`src/next.ts`) — `toNextHandler` / `toNextHandlers` adapter for Next.js App Router
- `/openapi` (`src/openapi.ts`) — `generateOpenAPI`, `RouteRegistry` for OpenAPI 3.1 spec generation

**Core flow:**
1. `defineRoute<const TDef>(def)` in [src/define.ts](src/define.ts) captures a route definition with response types keyed by HTTP status code. The `const` modifier is essential — it preserves literal keys like `200 | 404` rather than widening to `number`.
2. `toNextHandler(route)` in [src/next.ts](src/next.ts) wraps the handler, validates request/response with Zod schemas, and maps results to `NextResponse`. Handles both Next.js 14 (params as object) and 15+ (params as Promise).
3. `RouteRegistry` in [src/openapi.ts](src/openapi.ts) collects registered routes and `generateOpenAPI()` produces an OpenAPI 3.1 document via `zod-openapi`.

**Key types** ([src/types.ts](src/types.ts)):
- `RouteDef` — the shape of a route definition (method, path, schemas, handler, middleware)
- `ResponseMap` — maps status codes to Zod schemas
- `HandlerContext` — what the handler receives (parsed body, params, query, headers, middleware output)
- `RouteResult<TDef>` — the union of valid return values constrained by the route's `ResponseMap`

**Result helpers** ([src/result.ts](src/result.ts)) return typed `RouteResult` objects (e.g. `ok(data)` → `{ status: 200, body: data }`).

## Tooling Notes

- **Biome** replaces ESLint + Prettier. Config in [biome.json](biome.json).
- **tsdown** replaces tsc/rollup for bundling. Config in [tsdown.config.ts](tsdown.config.ts) — three entry points, ESM only, external peer deps.
- `noUncheckedIndexedAccess` is enabled — always guard array/object access.
- `moduleResolution: "Bundler"` — use `.js` extensions are not required in imports.
