import { ZodNever, type ZodType, ZodVoid } from "zod";
import {
  createDocument,
  type ZodObjectInput,
  type ZodOpenApiOperationObject,
  type ZodOpenApiParameters,
  type ZodOpenApiPathsObject,
  type ZodOpenApiRequestBodyObject,
  type ZodOpenApiResponseObject,
  type ZodOpenApiResponsesObject,
} from "zod-openapi";
import type { ResponseMap, RouteDefMeta } from "./types.js";

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

type HttpMethodKey =
  | "delete"
  | "get"
  | "head"
  | "options"
  | "patch"
  | "post"
  | "put";

/**
 * Generate an OpenAPI 3.1 document from a list of RouteDefs.
 *
 * Converts Next.js-style `[param]` path segments to OpenAPI `{param}` form.
 * Schemas annotated with `.meta({ id: 'Name' })` are extracted to
 * `components/schemas` and referenced via `$ref` wherever they appear.
 */
export function generateOpenAPI(
  routes: RouteDefMeta[],
  options: GenerateOptions,
): ReturnType<typeof createDocument> {
  const paths: ZodOpenApiPathsObject = {};

  for (const route of routes) {
    const openApiPath = normalizePath(route.path);
    paths[openApiPath] ??= {};
    paths[openApiPath]![route.method.toLowerCase() as HttpMethodKey] =
      buildOperation(route, options.defaultResponses);
  }

  return createDocument({
    openapi: "3.1.0",
    info: options.info,
    servers: options.servers,
    paths,
  });
}

function normalizePath(path: string): string {
  return path.replace(/\[(\.\.\.)?(\w+)\]/g, "{$2}");
}

function buildOperation(
  route: RouteDefMeta,
  defaultResponses?: ResponseMap,
): ZodOpenApiOperationObject {
  const operation: ZodOpenApiOperationObject = {
    responses: buildResponses(route.responses, defaultResponses),
  };
  if (route.summary) operation.summary = route.summary;
  if (route.description) operation.description = route.description;
  if (route.tags) operation.tags = [...route.tags];

  const requestParams = buildRequestParams(route);
  if (requestParams) operation.requestParams = requestParams;
  if (route.body) operation.requestBody = buildRequestBody(route.body);

  return operation;
}

function buildRequestParams(
  route: RouteDefMeta,
): ZodOpenApiParameters | undefined {
  const params: ZodOpenApiParameters = {};
  // params/query are ZodObjects in practice; cast to the narrower ZodObjectInput
  if (route.params) params.path = route.params as ZodObjectInput;
  if (route.query) params.query = route.query as ZodObjectInput;
  return Object.keys(params).length > 0 ? params : undefined;
}

function buildRequestBody(schema: ZodType): ZodOpenApiRequestBodyObject {
  return {
    required: true,
    content: { "application/json": { schema } },
  };
}

function buildResponses(
  responses: ResponseMap,
  defaults?: ResponseMap,
): ZodOpenApiResponsesObject {
  const merged: ResponseMap = { ...defaults, ...responses };
  const out: ZodOpenApiResponsesObject = {};

  for (const [status, schema] of Object.entries(merged)) {
    const key = status as `${1 | 2 | 3 | 4 | 5}${string}`;
    const response: ZodOpenApiResponseObject = {
      description: descriptionForStatus(Number(status)),
    };
    if (!isVoidZodSchema(schema)) {
      response.content = { "application/json": { schema } };
    }
    out[key] = response;
  }

  return out;
}

function isVoidZodSchema(schema: ZodType): boolean {
  return schema instanceof ZodVoid || schema instanceof ZodNever;
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
 * A registry that collects route definitions for later OpenAPI generation.
 * Useful when routes are spread across many files — import each route file
 * for its side effect, or push routes explicitly.
 */
export class RouteRegistry {
  private routes: RouteDefMeta[] = [];

  add(...routes: RouteDefMeta[]): this {
    this.routes.push(...routes);
    return this;
  }

  list(): readonly RouteDefMeta[] {
    return this.routes;
  }

  toOpenAPI(options: GenerateOptions): ReturnType<typeof createDocument> {
    return generateOpenAPI(this.routes, options);
  }
}
