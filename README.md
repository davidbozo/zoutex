# ZouteX

> **⚠️ Work in progress.** ZouteX is under heavy development. APIs may change without notice and it is not yet suitable for production use.

Type-safe routes for Next.js App Router, powered by **Zod**. Define once — get types, runtime validation, and OpenAPI from a single declaration.

The name is **Z**od + r**out**e + n**ext**, smashed together.

## Why

Writing API routes for the Next.js App Router today usually means:

- One file defines the handler (untyped `request: Request`).
- Another file (or your head) defines the input shape.
- A third file (or none) defines the response shape.
- OpenAPI, if it exists, drifts from reality.

ZouteX collapses these into a single, type-checked declaration. The handler can only return status codes you declared. The body for each status is checked against its Zod schema. The OpenAPI spec is derived from the same declaration that drives the handler.

## Quick start

```ts
// app/api/users/[id]/route.ts
import { z } from "zod";
import { defineRoute, ok, notFound } from "zoutex";
import { toNextHandlers } from "zoutex/next";

const UserSchema = z.object({ id: z.string(), name: z.string() });
const ErrorSchema = z.object({ message: z.string() });

export const routeDefs = [
  defineRoute({
    method: "GET",
    path: "/api/users/[id]",
    summary: "Get a user by id",
    tags: ["users"],
    params: z.object({ id: z.string() }),
    responses: {
      200: UserSchema,
      404: ErrorSchema,
    },
    async handler({ params }) {
      const user = await db.users.find(params.id);
      if (!user) return notFound({ message: `user ${params.id} not found` });
      return ok(user);
    },
  }),
] as const;

export const { GET } = toNextHandlers(routeDefs);
```

That's it. You now have:

- A handler whose return type is constrained to `{ status: 200, body: User } | { status: 404, body: { message: string } }`.
- Automatic request validation (params, query, body).
- Automatic response validation in development.
- A route definition you can feed into the OpenAPI generator.

## The core guarantee

The `responses` map is the source of truth. Try to return an undeclared status — it doesn't compile:

```ts
defineRoute({
  responses: { 200: UserSchema, 404: ErrorSchema },
  async handler() {
    return { status: 500, body: { message: "boom" } };
    //       ^^^ Type error: 500 is not assignable to 200 | 404
  },
});
```

Try to return the wrong body for a declared status — it doesn't compile either:

```ts
defineRoute({
  responses: { 200: UserSchema },
  async handler() {
    return { status: 200, body: { wrong: "shape" } };
    //                          ^^^ Type error: body must match UserSchema
  },
});
```

## The input contract

ZouteX enforces the same rule on inputs. If you don't declare a schema for `params`, `query`, or `body`, those fields are typed `undefined` in the handler — and accessing them is a compile error.

This is intentional. A query parameter you read without a schema is invisible to the OpenAPI spec. ZouteX won't let you build a gap between what your handler reads and what your API declares.

Declare the schema, get the type. Don't declare it, don't access it.

## Result helpers

Optional sugar for common statuses:

```ts
import { ok, created, noContent, badRequest, notFound, conflict } from "zoutex";

return ok(user);                         // 200
return created(newUser);                 // 201
return noContent();                      // 204
return badRequest({ message: "..." });   // 400
return notFound({ message: "..." });     // 404
return conflict({ message: "..." });     // 409
```

These are typed such that using a helper for an undeclared status fails to compile.

## Middleware

Middleware can do two things: **inject typed values** into the handler context, or **return early** with a typed response. Both are checked against `responses` at compile time.

### Context injection

Return a plain object and its fields become available in the handler:

```ts
defineRoute({
  method: "GET",
  path: "/api/me",
  middleware: async ({ req }) => {
    const user = await verifyToken(req.headers.get("authorization"));
    return { user }; // typed as { user: User }
  },
  responses: { 200: UserSchema },
  async handler({ user }) {
    // `user` is fully typed here
    return ok(user);
  },
});
```

### Early return

Return a `{ status, body }` object (or a result helper) to short-circuit the handler. The middleware's early-return statuses count toward the exhaustiveness check — the handler and middleware together must cover every status declared in `responses`:

```ts
import { unauthorized } from "zoutex";

defineRoute({
  method: "GET",
  path: "/api/me",
  middleware: async ({ req }) => {
    const token = req.headers.get("authorization");
    if (!token) return unauthorized({ message: "Unauthorized" }); // 401
    return { user: await verifyToken(token) };
  },
  responses: {
    200: UserSchema,
    401: ErrorSchema, // covered by middleware — compile error if removed
  },
  async handler({ user }) {
    return ok(user); // 200
  },
});
```

The same rules that apply to the handler apply to middleware:

- Returning a status not in `responses` is a compile error.
- Declaring a status in `responses` that neither the handler nor middleware can return is a compile error.

## OpenAPI generation

Import the `routeDefs` arrays from your route files, spread them into a `RouteRegistry`, then call `toOpenAPI`:

```ts
// lib/registry.ts
import { RouteRegistry } from "zoutex/openapi";
import { routeDefs as usersRouteDefs } from "@/app/api/users/route";
import { routeDefs as userIdRouteDefs } from "@/app/api/users/[id]/route";

export const registry = new RouteRegistry();
registry.add(...usersRouteDefs, ...userIdRouteDefs);
```

Serve the spec from an API route, or write it to disk:

```ts
// app/api/openapi.json/route.ts
import { registry } from "@/lib/registry";
import { ErrorSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export function GET() {
  const spec = registry.toOpenAPI({
    info: { title: "My API", version: "1.0.0" },
    servers: [{ url: "https://api.example.com" }],
    defaultResponses: { 400: ErrorSchema, 500: ErrorSchema },
  });
  return new Response(JSON.stringify(spec, null, 2), {
    headers: { "content-type": "application/json" },
  });
}
```

`defaultResponses` injects shared error schemas into every operation — useful for validation errors or unexpected failures you don't want to repeat per route.

ZouteX uses [`zod-openapi`](https://github.com/samchungy/zod-openapi) to convert Zod schemas to OpenAPI 3.1. The same schemas that drive runtime validation produce the spec — no drift.

## Multiple methods per route

Add more `defineRoute` calls to the same array. `toNextHandlers` dispatches by the `method` field on each definition, so there is no separate API for multi-method files — the pattern is identical to the quick start example above, just with more entries in `routeDefs`.

## Configuration

```ts
toNextHandler(route, {
  // Validate response bodies against declared schemas. Defaults to true in dev.
  validateResponse: false,

  // Custom error handler for unhandled exceptions.
  onError: (err, req) => new Response("Custom error", { status: 500 }),
});
```

## Requirements

- Next.js 14+
- Zod 4+
- TypeScript 5+ (for the `const` generic modifier)

## Development

The repo contains an integration testing playground at `apps/zoutex-playground` — a real Next.js app that exercises every library feature against a live server.

**First-time setup:**

```sh
npm install
npm run build                                    # compile library → dist/
npm -w apps/zoutex-playground run build          # Next.js production build (required before tests)
```

**Run integration tests:**

```sh
npm -w apps/zoutex-playground run test
```

Vitest starts a `next start` server on port 4321, waits for it to be ready, runs all HTTP-level tests, then tears the server down. The library must be built (`npm run build`) before each test run if you changed library source.

**Convenience scripts (build library + run tests in one command):**

```sh
npm run test:integration    # npm run build && npm -w apps/zoutex-playground run test
npm run playground          # npm run build && npm -w apps/zoutex-playground run dev
```

**Testing the CLI locally:**

```sh
npm run build                                    # compile CLI → dist/cli.mjs
node dist/cli.mjs discover --root apps/zoutex-playground
```

Run without `--root` to scan the current directory:

```sh
node dist/cli.mjs discover
```

**Other commands:**

```sh
npm run typecheck           # tsc --noEmit
npm run check               # Biome lint + format check
npm run fix                 # Biome auto-fix
```

## License

MIT
