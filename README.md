# ZouteX

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
// app/api/users/[id]/route.def.ts
import { z } from "zod";
import { defineRoute, ok, notFound } from "zoutex";

const UserSchema = z.object({ id: z.string(), name: z.string() });
const ErrorSchema = z.object({ message: z.string() });

export const getUserRoute = defineRoute({
  method: "GET",
  path: "/users/[id]",
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
});
```

```ts
// app/api/users/[id]/route.ts
import { toNextHandler } from "zoutex/next";
import { getUserRoute } from "./route.def";

export const GET = toNextHandler(getUserRoute);
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

Middleware extends the handler context with typed values:

```ts
const authedRoute = defineRoute({
  method: "GET",
  path: "/me",
  middleware: async ({ req }) => {
    const user = await verifyToken(req.headers.get("authorization"));
    return { user }; // typed as { user: User }
  },
  responses: { 200: UserSchema, 401: ErrorSchema },
  async handler({ user }) {
    // `user` is fully typed here
    return ok(user);
  },
});
```

## OpenAPI generation

Collect routes into a registry, then emit a spec:

```ts
// scripts/generate-openapi.ts
import { RouteRegistry } from "zoutex/openapi";
import { getUserRoute, createUserRoute } from "@/app/api/...";

const registry = new RouteRegistry();
registry.add(getUserRoute, createUserRoute);

const spec = registry.toOpenAPI({
  info: { title: "My API", version: "1.0.0" },
  servers: [{ url: "https://api.example.com" }],
});

await fs.writeFile("openapi.json", JSON.stringify(spec, null, 2));
```

ZouteX uses Zod 4's built-in `z.toJSONSchema()` — no extra dependencies, no schema drift.

## Multiple methods per route

For `route.ts` files that handle multiple methods:

```ts
// app/api/users/[id]/route.ts
import { toNextHandlers } from "zoutex/next";
import { getUserRoute, updateUserRoute, deleteUserRoute } from "./route.def";

export const { GET, PUT, DELETE } = toNextHandlers({
  GET: getUserRoute,
  PUT: updateUserRoute,
  DELETE: deleteUserRoute,
});
```

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
