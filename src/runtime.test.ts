/**
 * Runtime smoke test - exercises the Next.js adapter and OpenAPI generator
 * against a small set of routes. Run with `npx tsx src/runtime.test.ts`.
 */
import { z } from "zod";
import { badRequest, defineRoute, notFound, ok } from "./index.js";
import { toNextHandler } from "./next.js";
import { RouteRegistry } from "./openapi.js";

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
    return { status: 201, body: { id: crypto.randomUUID(), name: body.name } };
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

await testNextAdapter();
testOpenAPI();
