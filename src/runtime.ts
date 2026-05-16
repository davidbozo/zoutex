import { ZodError } from "zod";
import { ResponseShapeError, ValidationError, ZouteXError } from "./errors";
import type { AnyRouteDef } from "./types";

/**
 * Framework-agnostic route execution pipeline.
 *
 * Runs a route definition against an incoming request:
 * validates params, query, and body; invokes middleware; calls the handler;
 * optionally validates the response shape; and returns a serialized `Response`.
 *
 * Throws on validation errors or handler exceptions — callers are responsible
 * for catching and converting to an error response (e.g. via `defaultErrorHandler`).
 */
export async function executeRoute(
  route: AnyRouteDef,
  req: Request,
  rawParams: Record<string, string | string[]>,
  shouldValidateResponse: boolean,
): Promise<Response> {
  // 1. Parse and validate input
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

  // 2. Run middleware to build context extension
  const extension = route.middleware ? await route.middleware({ req }) : {};

  // 3. Invoke the user's handler
  const result = await route.handler({
    params,
    query,
    body,
    req,
    ...extension,
  } as Parameters<typeof route.handler>[0]);

  // 4. Optionally validate the response shape against the declared schema
  if (shouldValidateResponse) {
    const responseSchema = route.responses[result.status as unknown as number];
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

  // 5. Build the Response
  const headers = new Headers(result.headers);
  const status = result.status as unknown as number;

  // No-body statuses
  if (result.body === undefined || status === 204 || status === 304) {
    return new Response(null, { status, headers });
  }

  headers.set("content-type", "application/json");
  return new Response(JSON.stringify(result.body), { status, headers });
}

export function defaultErrorHandler(error: unknown): Response {
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
