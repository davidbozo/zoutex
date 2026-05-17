/**
 * Type-level tests for ZouteX.
 *
 * If this file compiles cleanly, the framework's core safety guarantees hold.
 * The @ts-expect-error directives mark cases that MUST be compile errors —
 * if they stop being errors, TypeScript fails the build.
 */
import { z } from "zod";
import { badRequest, defineRoute, notFound, ok } from "./index";

const UserSchema = z.object({ id: z.string(), name: z.string() });
const ErrorSchema = z.object({ message: z.string() });

// ─────────────────────────────────────────────────────────────────────────────
// Test 1: Handler can return declared statuses (200, 404, 400) — ALL OK
// ─────────────────────────────────────────────────────────────────────────────
defineRoute({
  method: "GET",
  path: "/users/{id}",
  params: z.object({ id: z.string() }),
  responses: {
    200: UserSchema,
    404: ErrorSchema,
    400: ErrorSchema,
  },
  async handler({ params }) {
    if (!params.id)
      return { status: 400 as const, body: { message: "id required" } };
    if (params.id === "missing")
      return { status: 404 as const, body: { message: "not found" } };
    return { status: 200 as const, body: { id: params.id, name: "Alice" } };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 2: Handler CANNOT return undeclared status
// ─────────────────────────────────────────────────────────────────────────────
defineRoute({
  method: "GET",
  path: "/users/{id}",
  responses: {
    200: UserSchema,
    404: ErrorSchema,
  },
  // @ts-expect-error — 500 is not declared in responses (200, 404 only)
  handler: async () => ({ status: 500, body: { message: "server error" } }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 3: Handler CANNOT return wrong body shape for a declared status
// ─────────────────────────────────────────────────────────────────────────────
defineRoute({
  method: "GET",
  path: "/users/{id}",
  responses: {
    200: UserSchema, // { id: string, name: string }
  },
  // @ts-expect-error — body must match UserSchema, not ErrorSchema shape
  handler: async () => ({ status: 200, body: { message: "wrong shape" } }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 4: Result helpers (ok, notFound, badRequest) produce correct types
// ─────────────────────────────────────────────────────────────────────────────
defineRoute({
  method: "GET",
  path: "/users/{id}",
  params: z.object({ id: z.string() }),
  responses: {
    200: UserSchema,
    404: ErrorSchema,
    400: ErrorSchema,
  },
  async handler({ params }) {
    if (!params.id) return badRequest({ message: "id required" });
    if (params.id === "missing") return notFound({ message: "not found" });
    return ok({ id: params.id, name: "Alice" });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 5: Helpers used for an UNDECLARED status fail to compile
// ─────────────────────────────────────────────────────────────────────────────
defineRoute({
  method: "GET",
  path: "/users/{id}",
  responses: { 200: UserSchema },
  // @ts-expect-error — notFound returns status 404, not declared
  handler: async () => notFound({ message: "nope" }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 6: Query and body parsing — inferred types reach the handler
// ─────────────────────────────────────────────────────────────────────────────
defineRoute({
  method: "POST",
  path: "/users",
  query: z.object({ source: z.enum(["web", "mobile"]) }),
  body: z.object({ name: z.string(), age: z.number() }),
  responses: {
    201: UserSchema,
    400: ErrorSchema,
  },
  async handler({ query, body }) {
    const _source: "web" | "mobile" = query.source; // narrowed enum
    const _age: number = body.age; // inferred as number
    if (!body.name)
      return { status: 400 as const, body: { message: "name required" } };
    return { status: 201 as const, body: { id: "1", name: body.name } };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 7: 204 No Content — body is optional when schema is z.void()
// ─────────────────────────────────────────────────────────────────────────────
defineRoute({
  method: "DELETE",
  path: "/users/{id}",
  params: z.object({ id: z.string() }),
  responses: {
    204: z.void(),
    404: ErrorSchema,
  },
  async handler({ params }) {
    if (params.id === "missing")
      return { status: 404 as const, body: { message: "not found" } };
    return { status: 204 as const }; // no body required
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 8: Undeclared schemas — params, query, body are typed as undefined
// ─────────────────────────────────────────────────────────────────────────────
defineRoute({
  method: "GET",
  path: "/ping",
  responses: { 200: z.object({ ok: z.boolean() }) },
  handler({ params, query, body }) {
    params satisfies undefined;
    query satisfies undefined;
    body satisfies undefined;
    return { status: 200 as const, body: { ok: true } };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 10: responses CANNOT declare a status the handler never returns
// ─────────────────────────────────────────────────────────────────────────────
defineRoute({
  method: "GET",
  path: "/users/{id}",
  // @ts-expect-error — 404 is declared in responses but handler never returns it
  responses: {
    200: UserSchema,
    404: ErrorSchema,
  },
  handler: async () => ok({ id: "1", name: "Alice" }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 11: handler covering all declared statuses compiles cleanly
// ─────────────────────────────────────────────────────────────────────────────
defineRoute({
  method: "GET",
  path: "/users/{id}",
  params: z.object({ id: z.string() }),
  responses: {
    200: UserSchema,
    404: ErrorSchema,
  },
  async handler({ params }) {
    if (params.id === "missing") return notFound({ message: "not found" });
    return ok({ id: params.id, name: "Alice" });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 12: Middleware returning an undeclared status is a compile error
// ─────────────────────────────────────────────────────────────────────────────
defineRoute({
  method: "GET",
  path: "/users/{id}",
  middleware: async ({ req }) => {
    if (!req.headers.get("authorization"))
      return { status: 401 as const, body: { message: "Unauthorized" } };
    return { currentUser: { id: "1" } };
  },
  // @ts-expect-error — middleware returns 401 but responses only declares 200
  responses: { 200: UserSchema },
  handler: async ({ currentUser }) => ok({ id: currentUser.id, name: "Alice" }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 13: Middleware covering some statuses + handler covering the rest compiles
// ─────────────────────────────────────────────────────────────────────────────
defineRoute({
  method: "GET",
  path: "/users/{id}",
  params: z.object({ id: z.string() }),
  middleware: async ({ req }) => {
    const token = req.headers.get("authorization");
    if (!token)
      return { status: 401 as const, body: { message: "Unauthorized" } };
    return { currentUser: { id: "1", name: "Alice" } };
  },
  responses: {
    200: UserSchema,
    401: ErrorSchema,
  },
  async handler({ params, currentUser }) {
    const _id: string = currentUser.id;
    return ok({ id: params.id, name: _id });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 9: Accessing properties on undeclared schemas is a compile error
// ─────────────────────────────────────────────────────────────────────────────
defineRoute({
  method: "GET",
  path: "/ping",
  responses: { 200: z.object({ ok: z.boolean() }) },
  handler({ params, query, body }) {
    // @ts-expect-error — params is undefined, no properties accessible
    params.id;
    // @ts-expect-error — query is undefined, no properties accessible
    query.page;
    // @ts-expect-error — body is undefined, no properties accessible
    body.name;
    return { status: 200 as const, body: { ok: true } };
  },
});
