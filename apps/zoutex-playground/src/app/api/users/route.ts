import { z } from "zod";
import { conflict, created, defineRoute, ok } from "zoutex";
import { toNextHandlers } from "zoutex/next";
import { ErrorSchema, UserSchema } from "@/lib/schemas";
import { users } from "@/lib/store";

export const routeDefs = [
  defineRoute({
    method: "GET",
    path: "/api/users",
    summary: "List all users",
    tags: ["users"],
    query: z.object({ search: z.string().optional() }),
    responses: { 200: z.array(UserSchema) },
    async handler({ query }) {
      const all = [...users.values()];
      const search = query.search;
      if (search) return ok(all.filter((u) => u.name.includes(search)));
      return ok(all);
    },
  }),
  defineRoute({
    method: "POST",
    path: "/api/users",
    summary: "Create a new user",
    tags: ["users"],
    body: z.object({
      name: z.string().min(1).max(100),
      email: z.email(),
    }),
    responses: { 201: UserSchema, 409: ErrorSchema },
    async handler({ body }) {
      const existing = [...users.values()].find((u) => u.email === body.email);
      if (existing) return conflict({ message: "Email already in use" });
      const user = { id: crypto.randomUUID(), ...body };
      users.set(user.id, user);
      return created(user);
    },
  }),
] as const;

export const { GET, POST } = toNextHandlers(routeDefs);
