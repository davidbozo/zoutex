import { ZodError } from "zod";
import { ResponseShapeError, ValidationError, ZouteXError } from "./errors";
import type { AnyRouteDef } from "./types";

export type NextRouteContext = {
  /** In Next.js 15+, params is a Promise. Older versions pass an object. We accept both. */
  params:
    | Promise<Record<string, string | string[]>>
    | Record<string, string | string[]>;
};

export type AdapterOptions = {
  /**
   * Whether to validate the response body against the declared response schema
   * at runtime. Defaults to true in development, false in production.
   */
  validateResponse?: boolean;
  /**
   * Custom error handler for unhandled exceptions. Receives the error and
   * returns a Response. By default, returns 500 with a generic message.
   */
  onError?: (error: unknown, req: Request) => Response | Promise<Response>;
};

/**
 * Convert a RouteDef into a Next.js App Router handler function.
 *
 * @example
 * ```ts
 * // app/api/users/[id]/route.ts
 * import { toNextHandler } from "zoutex/next";
 * import { getUserRoute } from "./route.def";
 *
 * export const GET = toNextHandler(getUserRoute);
 * ```
 */
export function toNextHandler(
  route: AnyRouteDef,
  options: AdapterOptions = {},
): (req: Request, ctx: NextRouteContext) => Promise<Response> {
  const shouldValidateResponse =
    options.validateResponse ?? process.env.NODE_ENV !== "production";

  return async (req: Request, ctx: NextRouteContext): Promise<Response> => {
    try {
      // 1. Resolve route params (await if Promise — Next.js 15+ style)
      const rawParams = await Promise.resolve(ctx.params);

      // 2. Parse and validate input
      const params = route.params
        ? safeParse(route.params, rawParams, "params")
        : ({} as Record<string, unknown>);

      const url = new URL(req.url);
      const queryObj = Object.fromEntries(url.searchParams);
      const query = route.query
        ? safeParse(route.query, queryObj, "query")
        : ({} as Record<string, unknown>);

      const body = route.body
        ? await parseBody(req, route.body)
        : (undefined as unknown);

      // 3. Run middleware to build context extension
      const extension = route.middleware ? await route.middleware({ req }) : {};

      // 4. Invoke the user's handler
      const result = await route.handler({
        params,
        query,
        body,
        req,
        ...extension,
      } as Parameters<typeof route.handler>[0]);

      // 5. Optionally validate the response shape against the declared schema
      if (shouldValidateResponse) {
        const responseSchema =
          route.responses[result.status as unknown as number];
        if (responseSchema && result.body !== undefined) {
          const parsed = responseSchema.safeParse(result.body);
          if (!parsed.success) {
            throw new ResponseShapeError(
              result.status as unknown as number,
              parsed.error.issues,
            );
          }
        }
      }

      // 6. Build the Response
      const headers = new Headers(result.headers);
      const status = result.status as unknown as number;

      // No-body statuses
      if (result.body === undefined || status === 204 || status === 304) {
        return new Response(null, { status, headers });
      }

      headers.set("content-type", "application/json");
      return new Response(JSON.stringify(result.body), { status, headers });
    } catch (error) {
      if (options.onError) {
        return options.onError(error, req);
      }
      return defaultErrorHandler(error);
    }
  };
}

function safeParse(
  schema: { safeParse: (data: unknown) => any },
  data: unknown,
  source: "params" | "query" | "body",
) {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(source, result.error.issues);
  }
  return result.data;
}

async function parseBody(
  req: Request,
  schema: { safeParse: (data: unknown) => any },
) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new ValidationError("body", [
      { code: "invalid_json", message: "Request body is not valid JSON" },
    ]);
  }
  return safeParse(schema, json, "body");
}

function defaultErrorHandler(error: unknown): Response {
  if (error instanceof ZouteXError) {
    const body = error.body ?? { message: error.message };
    return new Response(JSON.stringify(body), {
      status: error.status,
      headers: { "content-type": "application/json" },
    });
  }
  if (error instanceof ZodError) {
    return new Response(
      JSON.stringify({ message: "Validation failed", issues: error.issues }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }
  console.error("[zoutex] Unhandled error:", error);
  return new Response(JSON.stringify({ message: "Internal Server Error" }), {
    status: 500,
    headers: { "content-type": "application/json" },
  });
}

/**
 * Convenience helper: pass an object of HTTP method → RouteDef and get back
 * an object of HTTP method → Next.js handler, ready to spread into route.ts.
 *
 * @example
 * ```ts
 * export const { GET, POST } = toNextHandlers({
 *   GET: getUserRoute,
 *   POST: createUserRoute,
 * });
 * ```
 */
export function toNextHandlers<T extends Partial<Record<string, AnyRouteDef>>>(
  routes: T,
  options?: AdapterOptions,
): {
  [K in keyof T]: (req: Request, ctx: NextRouteContext) => Promise<Response>;
} {
  const out: Record<string, unknown> = {};
  for (const [method, route] of Object.entries(routes)) {
    if (route) out[method] = toNextHandler(route, options);
  }
  return out as {
    [K in keyof T]: (req: Request, ctx: NextRouteContext) => Promise<Response>;
  };
}
