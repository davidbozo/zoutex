import type { ZodType, z } from "zod";

/** Produces a compile-time error with a readable message. Assignments to this type always fail. */
export type RouteDefError<Msg extends string> = {
  readonly __error: never & Msg;
};

/** Merges an intersection of objects into a single flat object for cleaner error messages. */
export type Flatten<T> = { [K in keyof T]: T[K] } & {};

/**
 * A map from HTTP status codes to Zod schemas describing the response body.
 * Use `z.void()` for responses with no body (e.g. 204 No Content).
 */
export type ResponseMap = Record<number, ZodType>;

/**
 * Given a ResponseMap, produces a discriminated union of all valid
 * `{ status, body }` shapes a handler may return.
 *
 * If the schema's inferred type is `void` or `undefined`, `body` is optional.
 */
export type ResponseFor<R extends ResponseMap> = {
  [S in keyof R]: R[S] extends ZodType
    ? z.infer<R[S]> extends void | undefined
      ? { status: S; body?: undefined; headers?: Record<string, string> }
      : { status: S; body: z.infer<R[S]>; headers?: Record<string, string> }
    : never;
}[keyof R];

export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "OPTIONS"
  | "HEAD";

/**
 * A middleware function. `TReturn` is the full union of what the middleware
 * may return: either a plain injection object (merged into handler context)
 * or a `{ status, body }` response object (short-circuits the handler).
 * The runtime discriminates by checking for a numeric `status` field.
 */
export type Middleware<TContext = {}, TReturn = {}> = (
  ctx: {
    req: Request;
  } & TContext,
) => Promise<TReturn> | TReturn;

/**
 * The context object passed to a route handler.
 */
export type HandlerContext<TParams, TQuery, TBody, TExtension> = {
  params: TParams;
  query: TQuery;
  body: TBody;
  req: Request;
} & TExtension;

/**
 * A complete route definition.
 *
 * The handler's return type is constrained by the `responses` map:
 * it must return one of `{ status: K, body: z.infer<responses[K]> }`
 * for each K declared in responses.
 */
export type RouteDef<
  TParams extends ZodType = ZodType<undefined>,
  TQuery extends ZodType = ZodType<undefined>,
  TBody extends ZodType = ZodType<undefined>,
  TResponses extends ResponseMap = ResponseMap,
  TMiddlewareReturn = {},
> = {
  method: HttpMethod;
  /** OpenAPI-style path (e.g. "/users/{id}"). Next.js bracket form also accepted. */
  path: string;
  summary?: string;
  description?: string;
  tags?: readonly string[];
  params?: TParams;
  query?: TQuery;
  body?: TBody;
  responses: TResponses;
  middleware?: Middleware<{}, TMiddlewareReturn>;
  handler: (
    ctx: HandlerContext<
      z.infer<TParams>,
      z.infer<TQuery>,
      z.infer<TBody>,
      Exclude<TMiddlewareReturn, { status: number }>
    >,
  ) => Promise<ResponseFor<TResponses>> | ResponseFor<TResponses>;
};

/** Metadata-only shape — no handler, no generics. Safe for OpenAPI generation and registries. */
export type RouteDefMeta = {
  method: HttpMethod;
  path: string;
  summary?: string;
  description?: string;
  tags?: readonly string[];
  params?: ZodType;
  query?: ZodType;
  body?: ZodType;
  responses: ResponseMap;
};

/** A route definition with all generics erased — used where the handler must be invoked at runtime. */
export type AnyRouteDef = RouteDefMeta & {
  // biome-ignore lint/suspicious/noExplicitAny: intentional type erasure for heterogeneous route collections
  middleware?: Middleware<{}, any>;
  // biome-ignore lint/suspicious/noExplicitAny: intentional type erasure for heterogeneous route collections
  handler: (ctx: any) => any;
};
