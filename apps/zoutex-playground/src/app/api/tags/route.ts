import { z } from "zod";
import { defineRoute, noContent, ok } from "zoutex";
import { toNextHandlers } from "zoutex/next";

const TagSchema = z.object({ id: z.string(), name: z.string() });

export const routeDefs = [
  defineRoute({
    method: "GET",
    path: "/api/tags",
    responses: { 200: z.array(TagSchema) },
    async handler() {
      return ok([]);
    },
  }),
  defineRoute({
    method: "DELETE",
    path: "/api/tags",
    responses: { 204: z.void() },
    async handler() {
      return noContent();
    },
  }),
] as const;

// Internationally missing DELETE export 
export const { GET } = toNextHandlers(routeDefs);
