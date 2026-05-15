import { defineRoute, ok, notFound, noContent } from "zoutex";
import { z } from "zod";
import { ErrorSchema, UserSchema } from "../../../../../tests/lib/schemas";
import { users } from "../../../../../tests/lib/store";

const idParams = z.object({ id: z.string() });

export const getUserRoute = defineRoute({
  method: "GET",
  path: "/api/users/[id]",
  summary: "Get a user by ID",
  tags: ["users"],
  params: idParams,
  responses: { 200: UserSchema, 404: ErrorSchema },
  async handler({ params }) {
    const user = users.get(params.id);
    if (!user) return notFound({ message: `User ${params.id} not found` });
    return ok(user);
  },
});

export const updateUserRoute = defineRoute({
  method: "PUT",
  path: "/api/users/[id]",
  summary: "Update a user",
  tags: ["users"],
  params: idParams,
  body: z.object({ name: z.string().min(1).max(100).optional(), email: z.string().email().optional() }),
  responses: { 200: UserSchema, 404: ErrorSchema },
  async handler({ params, body }) {
    const user = users.get(params.id);
    if (!user) return notFound({ message: `User ${params.id} not found` });
    const updated = { ...user, ...body };
    users.set(params.id, updated);
    return ok(updated);
  },
});

export const deleteUserRoute = defineRoute({
  method: "DELETE",
  path: "/api/users/[id]",
  summary: "Delete a user",
  tags: ["users"],
  params: idParams,
  responses: { 204: z.void(), 404: ErrorSchema },
  async handler({ params }) {
    if (!users.has(params.id)) return notFound({ message: `User ${params.id} not found` });
    users.delete(params.id);
    return noContent();
  },
});
