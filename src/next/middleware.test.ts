import { z } from "zod";
import { describe, expect, it } from "vitest";
import { defineRoute, ok } from "../define";
import { toNextHandler } from "./index";

const UserSchema = z.object({ id: z.string(), name: z.string() });
const ErrorSchema = z.object({ message: z.string() });

const protectedRoute = defineRoute({
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

describe("middleware", () => {
  const handler = toNextHandler(protectedRoute);

  it("returns 401 when authorization header is missing or wrong", async () => {
    const res = await handler(new Request("http://localhost/protected"), {
      params: {},
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.message).toBe("Unauthorized");
  });

  it("returns 200 with user data when token is valid", async () => {
    const res = await handler(
      new Request("http://localhost/protected", {
        headers: { authorization: "Bearer secret" },
      }),
      { params: {} },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ id: "1", name: "Alice" });
  });
});
