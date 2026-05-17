import { defaultErrorHandler, executeRoute } from "../runtime/runtime";
import type { AnyRouteDef } from "../define/types";

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
      // Resolve route params (await if Promise — Next.js 15+ style)
      const rawParams = await Promise.resolve(ctx.params);
      return await executeRoute(route, req, rawParams, shouldValidateResponse);
    } catch (error) {
      if (options.onError) return options.onError(error, req);
      return defaultErrorHandler(error);
    }
  };
}

type NextHandler = (req: Request, ctx: NextRouteContext) => Promise<Response>;

export function toNextHandlers<T extends { method: string }>(
  routes: readonly T[],
  options?: AdapterOptions,
): { [K in T["method"]]: NextHandler };

export function toNextHandlers<T extends Partial<Record<string, AnyRouteDef>>>(
  routes: T,
  options?: AdapterOptions,
): { [K in keyof T]: NextHandler };

export function toNextHandlers(
  routes: readonly AnyRouteDef[] | Partial<Record<string, AnyRouteDef>>,
  options?: AdapterOptions,
): Record<string, NextHandler> {
  const out: Record<string, NextHandler> = {};
  if (Array.isArray(routes)) {
    for (const route of routes) {
      out[route.method] = toNextHandler(route, options);
    }
  } else {
    for (const [method, route] of Object.entries(routes)) {
      if (route) out[method] = toNextHandler(route, options);
    }
  }
  return out;
}
