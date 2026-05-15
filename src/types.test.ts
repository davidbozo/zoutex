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
    if (!params.id) return { status: 400, body: { message: "id required" } };
    if (params.id === "missing")
      return { status: 404, body: { message: "not found" } };
    return { status: 200, body: { id: params.id, name: "Alice" } };
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
    return { status: 201, body: { id: "1", name: body.name } };
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
      return { status: 404, body: { message: "not found" } };
    return { status: 204 }; // no body required
  },
});
