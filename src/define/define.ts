import type { ZodType, z } from "zod";
import type {
  Flatten,
  HandlerContext,
  HttpMethod,
  Middleware,
  ResponseFor,
  ResponseMap,
  RouteDef,
  RouteDefError,
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
  responses: Exclude<
    Extract<TMiddlewareReturn, { status: number }>["status"],
    keyof TResponses
  > extends infer UndeclaredMiddlewareStatuses
    ? [UndeclaredMiddlewareStatuses] extends [never]
      ? Exclude<
          keyof TResponses,
          (
            | THandlerReturn
            | Extract<TMiddlewareReturn, { status: number }>
          )["status"]
        > extends infer UnimplementedStatuses
        ? [UnimplementedStatuses] extends [never]
          ? TResponses
          : RouteDefError<`Responses declares status(es) never returned by handler or middleware: ${UnimplementedStatuses & number}`>
        : never
      : RouteDefError<`Middleware returns status(es) not declared in responses: ${UndeclaredMiddlewareStatuses & number}`>
    : never;
  middleware?: Middleware<{}, TMiddlewareReturn>;
  handler: (
    ctx: Flatten<
      HandlerContext<
        z.infer<TParams>,
        z.infer<TQuery>,
        z.infer<TBody>,
        Exclude<TMiddlewareReturn, { status: number }>
      >
    >,
  ) => Promise<THandlerReturn> | THandlerReturn;
}): RouteDef<TParams, TQuery, TBody, TResponses, TMiddlewareReturn> {
  return def as unknown as RouteDef<
    TParams,
    TQuery,
    TBody,
    TResponses,
    TMiddlewareReturn
  >;
}
