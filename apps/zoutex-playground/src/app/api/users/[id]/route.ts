import { z } from "zod";
import { defineRoute, noContent, notFound, ok } from "zoutex";
import { toNextHandlers } from "zoutex/next";
import { ErrorSchema, UserSchema } from "@/lib/schemas";
import { users } from "@/lib/store";

const idParams = z.object({ id: z.string() });

export const routeDefs = [
  defineRoute({
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
  }),
  defineRoute({
    method: "PUT",
    path: "/api/users/[id]",
    summary: "Update a user",
    tags: ["users"],
    params: idParams,
    body: z.object({
      name: z.string().min(1).max(100).optional(),
      email: z.email().optional(),
    }),
    responses: { 200: UserSchema, 404: ErrorSchema },
    async handler({ params, body }) {
      const user = users.get(params.id);
      if (!user) return notFound({ message: `User ${params.id} not found` });
      const updated = { ...user, ...body };
      users.set(params.id, updated);
      return ok(updated);
    },
  }),
  defineRoute({
    method: "DELETE",
    path: "/api/users/[id]",
    summary: "Delete a user",
    tags: ["users"],
    params: idParams,
    responses: { 204: z.void(), 404: ErrorSchema },
    async handler({ params }) {
      if (!users.has(params.id))
        return notFound({ message: `User ${params.id} not found` });
      users.delete(params.id);
      return noContent();
    },
  }),
] as const;

export const { GET, PUT, DELETE } = toNextHandlers(routeDefs);
