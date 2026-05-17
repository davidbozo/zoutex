import type { ZodType, z } from "zod";
import type {
  HandlerContext,
  HttpMethod,
  Middleware,
  ResponseFor,
  ResponseMap,
  RouteDef,
} from "./types";

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
 *     if (!user) return { status: 404 as const, body: { message: "not found" } };
 *     return { status: 200 as const, body: user };
 *   },
 * });
 * ```
 */
export function defineRoute<
  const TResponses extends ResponseMap,
  TParams extends ZodType = ZodType<undefined>,
  TQuery extends ZodType = ZodType<undefined>,
  TBody extends ZodType = ZodType<undefined>,
  TMiddlewareReturn = {},
  THandlerReturn extends ResponseFor<TResponses> = ResponseFor<TResponses>,
>(def: {
  method: HttpMethod;
  path: string;
  summary?: string;
  description?: string;
  tags?: readonly string[];
  params?: TParams;
  query?: TQuery;
  body?: TBody;
  responses: [
    | Exclude<
        keyof TResponses,
        (
          | THandlerReturn
          | Extract<TMiddlewareReturn, { status: number }>
        )["status"]
      >
    | Exclude<
        Extract<TMiddlewareReturn, { status: number }>["status"],
        keyof TResponses
      >,
  ] extends [never]
    ? TResponses
    : never;
  middleware?: Middleware<{}, TMiddlewareReturn>;
  handler: (
    ctx: HandlerContext<
      z.infer<TParams>,
      z.infer<TQuery>,
      z.infer<TBody>,
      Exclude<TMiddlewareReturn, { status: number }>
    >,
  ) => Promise<THandlerReturn> | THandlerReturn;
}): RouteDef<TParams, TQuery, TBody, TResponses, TMiddlewareReturn> {
  return def as RouteDef<TParams, TQuery, TBody, TResponses, TMiddlewareReturn>;
}
