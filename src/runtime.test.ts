/**
 * Runtime smoke test - exercises the Next.js adapter and OpenAPI generator
 * against a small set of routes. Run with `npx tsx src/runtime.test.ts`.
 */
import { z } from "zod";
import { badRequest, defineRoute, notFound, ok } from "./index";
import { toNextHandler } from "./next";
import { RouteRegistry } from "./openapi";

const UserSchema = z
  .object({ id: z.string(), name: z.string() })
  .meta({ id: "User" });
const ErrorSchema = z.object({ message: z.string() }).meta({ id: "Error" });

// Define a couple of routes
const getUserRoute = defineRoute({
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
    if (params.id === "missing")
      return notFound({ message: `user ${params.id} not found` });
    return ok({ id: params.id, name: "Alice" });
  },
});

const createUserRoute = defineRoute({
  method: "POST",
  path: "/users",
  summary: "Create a new user",
  tags: ["users"],
  body: z.object({ name: z.string().min(1) }),
  query: z.object({ source: z.enum(["web", "mobile"]) }),
  responses: {
    201: UserSchema,
    400: ErrorSchema,
  },
  async handler({ body }) {
    if (body.name.length > 100) return badRequest({ message: "name too long" });
    return {
      status: 201 as const,
      body: { id: crypto.randomUUID(), name: body.name },
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Test the Next.js adapter
// ─────────────────────────────────────────────────────────────────────────────
async function testNextAdapter() {
  console.log("=== Next.js adapter tests ===\n");
  const getHandler = toNextHandler(getUserRoute);

  // Test 1: successful GET
  const okReq = new Request("http://localhost/users/42");
  const okRes = await getHandler(okReq, { params: { id: "42" } });
  console.log(`GET /users/42  →  ${okRes.status}`, await okRes.json());

  // Test 2: 404 path
  const missingReq = new Request("http://localhost/users/missing");
  const missingRes = await getHandler(missingReq, {
    params: { id: "missing" },
  });
  console.log(
    `GET /users/missing  →  ${missingRes.status}`,
    await missingRes.json(),
  );

  // Test 3: validation failure on POST
  const postHandler = toNextHandler(createUserRoute);
  const badReq = new Request("http://localhost/users", {
    method: "POST",
    body: JSON.stringify({ name: 123 }),
  });
  const badRes = await postHandler(badReq, { params: {} });
  console.log(
    `POST /users (invalid body)  →  ${badRes.status}`,
    await badRes.json(),
  );

  // Test 4: successful POST
  const goodReq = new Request("http://localhost/users", {
    method: "POST",
    body: JSON.stringify({ name: "Bob" }),
  });
  const goodRes = await postHandler(goodReq, { params: {} });
  console.log(
    `POST /users (valid)  →  ${goodRes.status}`,
    await goodRes.json(),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Test OpenAPI generation
// ─────────────────────────────────────────────────────────────────────────────
function testOpenAPI() {
  console.log("\n=== OpenAPI generation ===\n");
  const registry = new RouteRegistry();
  registry.add(getUserRoute, createUserRoute);

  const spec = registry.toOpenAPI({
    info: { title: "Demo API", version: "1.0.0" },
    servers: [{ url: "https://api.example.com" }],
  });

  const components = (spec.components as Record<string, unknown> | undefined)
    ?.schemas as Record<string, unknown> | undefined;
  console.assert(
    components && "User" in components,
    "Expected User in components/schemas",
  );
  console.assert(
    components && "Error" in components,
    "Expected Error in components/schemas",
  );
  const paths = spec.paths as Record<string, Record<string, unknown>>;
  const get200 = (
    (
      (
        (paths["/users/{id}"]?.get as Record<string, unknown>)
          ?.responses as Record<string, unknown>
      )?.["200"] as Record<string, unknown>
    )?.content as Record<string, unknown>
  )?.["application/json"] as Record<string, unknown>;
  console.assert(
    (get200?.schema as Record<string, unknown>)?.$ref ===
      "#/components/schemas/User",
    "Expected $ref to User",
  );
  console.log(JSON.stringify(spec, null, 2));
}

// ─────────────────────────────────────────────────────────────────────────────
// Test undeclared schemas are undefined at runtime
// ─────────────────────────────────────────────────────────────────────────────
async function testUndeclaredSchemasAreUndefined() {
  console.log("\n=== Undeclared schema defaults ===\n");

  const captured: { params?: unknown; query?: unknown; body?: unknown } = {};

  const route = defineRoute({
    method: "GET",
    path: "/ping",
    responses: { 200: z.object({ ok: z.boolean() }) },
    async handler(ctx) {
      captured.params = ctx.params;
      captured.query = ctx.query;
      captured.body = ctx.body;
      return ok({ ok: true });
    },
  });

  const handler = toNextHandler(route);
  const req = new Request("http://localhost/ping?foo=bar");
  await handler(req, { params: { id: "42" } });

  console.assert(
    captured.params === undefined,
    "params should be undefined when no schema declared",
  );
  console.assert(
    captured.query === undefined,
    "query should be undefined when no schema declared",
  );
  console.assert(
    captured.body === undefined,
    "body should be undefined when no schema declared",
  );
  console.log(
    "params:",
    captured.params,
    "query:",
    captured.query,
    "body:",
    captured.body,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Test middleware early return
// ─────────────────────────────────────────────────────────────────────────────
async function testMiddlewareEarlyReturn() {
  console.log("\n=== Middleware early return ===\n");

  const route = defineRoute({
    method: "GET",
    path: "/protected",
    responses: { 200: UserSchema, 401: ErrorSchema },
    middleware: async ({ req }) => {
      const token = req.headers.get("authorization");
      if (token !== "Bearer secret")
        return { status: 401 as const, body: { message: "Unauthorized" } };
      return { currentUser: { id: "1", name: "Alice" } };
    },
    async handler({ currentUser }) {
      return ok({ id: currentUser.id, name: currentUser.name });
    },
  });

  const handler = toNextHandler(route);

  const authedRes = await handler(
    new Request("http://localhost/protected", {
      headers: { authorization: "Bearer secret" },
    }),
    { params: {} },
  );
  const authedBody = await authedRes.json();
  console.log(`authed  →  ${authedRes.status}`, authedBody);
  console.assert(authedRes.status === 200, "Expected 200 for valid token");
  console.assert(authedBody.id === "1", "Expected id '1' in authed response");
  console.assert(
    authedBody.name === "Alice",
    "Expected name 'Alice' in authed response",
  );

  const unauthRes = await handler(new Request("http://localhost/protected"), {
    params: {},
  });
  const unauthBody = await unauthRes.json();
  console.log(`unauthed  →  ${unauthRes.status}`, unauthBody);
  console.assert(unauthRes.status === 401, "Expected 401 for missing token");
  console.assert(
    unauthBody.message === "Unauthorized",
    "Expected 'Unauthorized' message in 401 response",
  );
}

await testNextAdapter();
await testUndeclaredSchemasAreUndefined();
await testMiddlewareEarlyReturn();
testOpenAPI();
