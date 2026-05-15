import { defineRoute, ok, ZouteXError } from "zoutex";
import { toNextHandlers } from "zoutex/next";
import { ErrorSchema, UserSchema } from "../../../../../tests/lib/schemas";

export const routeDefs = [
  defineRoute({
    method: "GET",
    path: "/api/auth/me",
    summary: "Get the current authenticated user",
    tags: ["auth"],
    middleware: async ({ req }) => {
      const token = req.headers.get("authorization")?.replace("Bearer ", "");
      if (token !== "secret-token") {
        throw new ZouteXError("Unauthorized", 401, { message: "Unauthorized" });
      }
      return { currentUser: { id: "user-1", name: "Alice", email: "alice@example.com" } };
    },
    responses: { 200: UserSchema, 401: ErrorSchema },
    async handler({ currentUser }) {
      return ok(currentUser);
    },
  }),
] as const;

export const { GET } = toNextHandlers(routeDefs);
