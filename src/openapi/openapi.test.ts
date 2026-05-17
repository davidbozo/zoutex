import { z } from "zod";
import { describe, expect, it } from "vitest";
import { badRequest, defineRoute, notFound, ok } from "../define";
import { RouteRegistry } from "./index";

const UserSchema = z
  .object({ id: z.string(), name: z.string() })
  .meta({ id: "User" });
const ErrorSchema = z.object({ message: z.string() }).meta({ id: "Error" });

const getUserRoute = defineRoute({
  method: "GET",
  path: "/users/[id]",
  summary: "Get a user by id",
  tags: ["users"],
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
  summary: "Create a new user",
  tags: ["users"],
  body: z.object({ name: z.string().min(1) }),
  responses: { 201: UserSchema, 400: ErrorSchema },
  async handler({ body }) {
    if (body.name.length > 100) return badRequest({ message: "name too long" });
    return {
      status: 201 as const,
      body: { id: crypto.randomUUID(), name: body.name },
    };
  },
});

describe("RouteRegistry / toOpenAPI", () => {
  const registry = new RouteRegistry();
  registry.add(getUserRoute, createUserRoute);
  const spec = registry.toOpenAPI({
    info: { title: "Demo API", version: "1.0.0" },
    servers: [{ url: "https://api.example.com" }],
  });

  const schemas = (spec.components as Record<string, unknown> | undefined)
    ?.schemas as Record<string, unknown> | undefined;

  it("extracts User into components/schemas", () => {
    expect(schemas).toBeDefined();
    expect(schemas).toHaveProperty("User");
  });

  it("extracts Error into components/schemas", () => {
    expect(schemas).toBeDefined();
    expect(schemas).toHaveProperty("Error");
  });

  it("references User schema via $ref on GET /users/{id} 200 response", () => {
    const paths = spec.paths as Record<string, Record<string, unknown>>;
    const content = (
      (
        (paths["/users/{id}"]?.get as Record<string, unknown>)
          ?.responses as Record<string, unknown>
      )?.["200"] as Record<string, unknown>
    )?.content as Record<string, unknown>;
    const schema = (content?.["application/json"] as Record<string, unknown>)
      ?.schema as Record<string, unknown>;
    expect(schema?.$ref).toBe("#/components/schemas/User");
  });
});
