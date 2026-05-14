import type { ZodType, z } from "zod";

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
 * Context passed to a middleware function. Returns a context extension
 * that will be merged into the handler's `ctx`.
 */
export type Middleware<TContext = {}, TExtension = {}> = (
  ctx: {
    req: Request;
  } & TContext,
) => Promise<TExtension> | TExtension;

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
  TParams extends ZodType = ZodType<unknown>,
  TQuery extends ZodType = ZodType<unknown>,
  TBody extends ZodType = ZodType<unknown>,
  TResponses extends ResponseMap = ResponseMap,
  TExtension = {},
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
  middleware?: Middleware<{}, TExtension>;
  handler: (
    ctx: HandlerContext<
      z.infer<TParams>,
      z.infer<TQuery>,
      z.infer<TBody>,
      TExtension
    >,
  ) => Promise<ResponseFor<TResponses>> | ResponseFor<TResponses>;
};

/** A route definition with all generics erased — used in registries and OpenAPI generation. */
export type AnyRouteDef = RouteDef<any, any, any, ResponseMap, any>;
