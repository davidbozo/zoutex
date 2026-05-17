import { z } from "zod";
import { describe, expect, it } from "vitest";
import { badRequest, defineRoute, notFound, ok } from "../define";
import { toNextHandler } from "./index";

const UserSchema = z.object({ id: z.string(), name: z.string() });
const ErrorSchema = z.object({ message: z.string() });

const getUserRoute = defineRoute({
  method: "GET",
  path: "/users/[id]",
  params: z.object({ id: z.string() }),
  responses: { 200: UserSchema, 404: ErrorSchema },
  async handler({ params }) {
    if (params.id === "missing")
      return notFound({ message: `user ${params.id} not found` });
    return ok({ id: params.id, name: "Alice" });
  },
});

const createUserRoute = defineRoute({
  method: "POST",
  path: "/users",
  body: z.object({ name: z.string().min(1) }),
  responses: { 201: UserSchema, 400: ErrorSchema },
  async handler({ body }) {
    if (body.name.length > 100) return badRequest({ message: "name too long" });
    return { status: 201 as const, body: { id: crypto.randomUUID(), name: body.name } };
  },
});

describe("toNextHandler", () => {
  const getHandler = toNextHandler(getUserRoute);
  const postHandler = toNextHandler(createUserRoute);

  it("returns 200 with user data on successful GET", async () => {
    const res = await getHandler(new Request("http://localhost/users/42"), {
      params: { id: "42" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ id: "42", name: "Alice" });
  });

  it("returns 404 when handler returns notFound", async () => {
    const res = await getHandler(
      new Request("http://localhost/users/missing"),
      { params: { id: "missing" } },
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.message).toContain("missing");
  });

  it("returns 400 on invalid POST body", async () => {
    const res = await postHandler(
      new Request("http://localhost/users", {
        method: "POST",
        body: JSON.stringify({ name: 123 }),
      }),
      { params: {} },
    );
    expect(res.status).toBe(400);
  });

  it("returns 201 on valid POST body", async () => {
    const res = await postHandler(
      new Request("http://localhost/users", {
        method: "POST",
        body: JSON.stringify({ name: "Bob" }),
      }),
      { params: {} },
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("Bob");
    expect(typeof body.id).toBe("string");
  });
});

describe("undeclared schemas", () => {
  it("params, query, and body are undefined when no schema is declared", async () => {
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

    await toNextHandler(route)(
      new Request("http://localhost/ping?foo=bar"),
      { params: { id: "42" } },
    );

    expect(captured.params).toBeUndefined();
    expect(captured.query).toBeUndefined();
    expect(captured.body).toBeUndefined();
  });
});
