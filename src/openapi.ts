import { z, type ZodType } from "zod";
import type { AnyRouteDef, ResponseMap } from "./types.js";

export type OpenAPIInfo = {
  title: string;
  version: string;
  description?: string;
};

export type OpenAPIServer = {
  url: string;
  description?: string;
};

export type GenerateOptions = {
  info: OpenAPIInfo;
  servers?: OpenAPIServer[];
  /**
   * Default response schemas merged into every route's responses (e.g. for
   * framework-injected 400 and 500). Per-route declarations override these.
   */
  defaultResponses?: ResponseMap;
};

/**
 * Generate an OpenAPI 3.1 document from a list of RouteDefs.
 *
 * Converts Next.js-style `[param]` path segments to OpenAPI `{param}` form.
 * Uses Zod's built-in `z.toJSONSchema()` for schema conversion (requires Zod 3.25+).
 */
export function generateOpenAPI(
  routes: AnyRouteDef[],
  options: GenerateOptions,
): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const route of routes) {
    const openApiPath = normalizePath(route.path);
    paths[openApiPath] ??= {};

    const operation: Record<string, unknown> = {
      summary: route.summary,
      description: route.description,
      tags: route.tags ? [...route.tags] : undefined,
      parameters: buildParameters(route),
      requestBody: route.body ? buildRequestBody(route.body) : undefined,
      responses: buildResponses(route.responses, options.defaultResponses),
    };

    // Strip undefined fields for a cleaner document
    paths[openApiPath]![route.method.toLowerCase()] = stripUndefined(operation);
  }

  return stripUndefined({
    openapi: "3.1.0",
    info: options.info,
    servers: options.servers,
    paths,
  });
}

function normalizePath(path: string): string {
  // /users/[id]/posts/[postId] -> /users/{id}/posts/{postId}
  return path.replace(/\[(\.\.\.)?(\w+)\]/g, "{$2}");
}

function buildParameters(route: AnyRouteDef): unknown[] | undefined {
  const parameters: unknown[] = [];

  if (route.params) {
    for (const param of extractObjectFields(route.params, "path")) {
      parameters.push(param);
    }
  }
  if (route.query) {
    for (const param of extractObjectFields(route.query, "query")) {
      parameters.push(param);
    }
  }

  return parameters.length > 0 ? parameters : undefined;
}

function extractObjectFields(
  schema: ZodType,
  location: "path" | "query",
): Array<Record<string, unknown>> {
  const jsonSchema = zodToJsonSchema(schema);
  if (
    typeof jsonSchema !== "object" ||
    jsonSchema === null ||
    !("properties" in jsonSchema)
  ) {
    return [];
  }

  const properties = (jsonSchema as { properties?: Record<string, unknown> }).properties ?? {};
  const required = ((jsonSchema as { required?: string[] }).required ?? []) as string[];

  return Object.entries(properties).map(([name, propSchema]) => ({
    name,
    in: location,
    required: location === "path" ? true : required.includes(name),
    schema: propSchema,
  }));
}

function buildRequestBody(schema: ZodType): Record<string, unknown> {
  return {
    required: true,
    content: {
      "application/json": {
        schema: zodToJsonSchema(schema),
      },
    },
  };
}

function buildResponses(
  responses: ResponseMap,
  defaults?: ResponseMap,
): Record<string, unknown> {
  const merged: ResponseMap = { ...defaults, ...responses };
  const out: Record<string, unknown> = {};

  for (const [status, schema] of Object.entries(merged)) {
    const jsonSchema = zodToJsonSchema(schema);
    const isVoid = isVoidSchema(jsonSchema);

    out[status] = isVoid
      ? { description: descriptionForStatus(Number(status)) }
      : {
          description: descriptionForStatus(Number(status)),
          content: {
            "application/json": {
              schema: jsonSchema,
            },
          },
        };
  }

  return out;
}

function isVoidSchema(jsonSchema: unknown): boolean {
  if (typeof jsonSchema !== "object" || jsonSchema === null) return false;
  const s = jsonSchema as { type?: unknown; not?: unknown };
  // Zod's z.void() becomes either `{ not: {} }` or similar; be permissive
  return s.type === "null" || (s.not !== undefined && Object.keys(s).length === 1);
}

function descriptionForStatus(status: number): string {
  const map: Record<number, string> = {
    200: "OK",
    201: "Created",
    202: "Accepted",
    204: "No Content",
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    409: "Conflict",
    422: "Unprocessable Entity",
    429: "Too Many Requests",
    500: "Internal Server Error",
  };
  return map[status] ?? `Response ${status}`;
}

/**
 * Convert a Zod schema to JSON Schema. Uses `z.toJSONSchema` if available
 * (Zod 3.25+); throws a helpful error if not.
 */
function zodToJsonSchema(schema: ZodType): unknown {
  const fn = (z as unknown as { toJSONSchema?: (s: ZodType) => unknown }).toJSONSchema;
  if (typeof fn !== "function") {
    throw new Error(
      "[zoutex] z.toJSONSchema is not available. Upgrade to Zod 3.25+ or install @zod/to-json-schema.",
    );
  }
  return fn(schema);
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      out[key] = stripUndefined(value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out as T;
}

/**
 * A registry that collects route definitions for later OpenAPI generation.
 * Useful when routes are spread across many files — import each route file
 * for its side effect, or push routes explicitly.
 */
export class RouteRegistry {
  private routes: AnyRouteDef[] = [];

  add(...routes: AnyRouteDef[]): this {
    this.routes.push(...routes);
    return this;
  }

  list(): readonly AnyRouteDef[] {
    return this.routes;
  }

  toOpenAPI(options: GenerateOptions): Record<string, unknown> {
    return generateOpenAPI(this.routes, options);
  }
}
