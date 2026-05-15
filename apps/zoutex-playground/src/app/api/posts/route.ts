import { z } from "zod";
import { defineRoute, ok } from "zoutex";
import { toNextHandlers } from "zoutex/next";
import { PostSchema } from "../../../../tests/lib/schemas";
import { posts } from "../../../../tests/lib/store";

export const routeDefs = [
  defineRoute({
    method: "GET",
    path: "/api/posts",
    summary: "List posts with pagination",
    tags: ["posts"],
    query: z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(20),
    }),
    responses: {
      200: z.object({
        data: z.array(PostSchema),
        page: z.number(),
        pageSize: z.number(),
        total: z.number(),
      }),
    },
    async handler({ query }) {
      const all = [...posts.values()];
      const { page, pageSize } = query;
      const start = (page - 1) * pageSize;
      return ok({
        data: all.slice(start, start + pageSize),
        page,
        pageSize,
        total: all.length,
      });
    },
  }),
] as const;

export const { GET } = toNextHandlers(routeDefs);
