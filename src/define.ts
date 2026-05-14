import type { ZodType, z } from "zod";
import type {
  HandlerContext,
  HttpMethod,
  Middleware,
  ResponseFor,
  ResponseMap,
  RouteDef,
} from "./types.js";

/**
 * Define a type-safe route.
 *
 * The `const` generic modifier on `TResponses` preserves the literal status
 * code keys, so the handler's return type is constrained to exactly those
 * statuses. Returning any other status code is a compile error.
 *
 * @example
 * ```ts
 * const getUser = defineRoute({
 *   method: "GET",
 *   path: "/users/{id}",
 *   params: z.object({ id: z.string() }),
 *   responses: {
 *     200: UserSchema,
 *     404: ErrorSchema,
 *   },
 *   async handler({ params }) {
 *     const user = await db.users.find(params.id);
 *     if (!user) return { status: 404, body: { message: "not found" } };
 *     return { status: 200, body: user };
 *   },
 * });
 * ```
 */
export function defineRoute<
  const TResponses extends ResponseMap,
  TParams extends ZodType = ZodType<unknown>,
  TQuery extends ZodType = ZodType<unknown>,
  TBody extends ZodType = ZodType<unknown>,
  TExtension = {},
>(def: {
  method: HttpMethod;
  path: string;
  summary?: string;
  description?: string;
  tags?: readonly string[];
  params?: TParams;
  query?: TQuery;
  body?: TBody;
  responses: TResponses;
  middleware?: Middleware<{}, TExtension>;
  handler: (
    ctx: HandlerContext<
      z.infer<TParams>,
      z.infer<TQuery>,
      z.infer<TBody>,
      TExtension
    >,
  ) => Promise<ResponseFor<TResponses>> | ResponseFor<TResponses>;
}): RouteDef<TParams, TQuery, TBody, TResponses, TExtension> {
  return def as RouteDef<TParams, TQuery, TBody, TResponses, TExtension>;
}
