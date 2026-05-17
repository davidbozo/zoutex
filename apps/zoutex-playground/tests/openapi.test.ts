import { describe, it, expect } from "vitest";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:4321";

describe("GET /api/openapi.json", () => {
  it("returns 200 with content-type application/json", async () => {
    const res = await fetch(`${BASE}/api/openapi.json`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
  });

  it("returns a valid OpenAPI 3.1.0 document", async () => {
    const res = await fetch(`${BASE}/api/openapi.json`);
    const spec = await res.json();
    expect(spec.openapi).toBe("3.1.0");
    expect(spec.info.title).toBe("ZouteX Playground API");
  });

  it("includes all registered routes as paths", async () => {
    const res = await fetch(`${BASE}/api/openapi.json`);
    const spec = await res.json();
    const paths = Object.keys(spec.paths ?? {});
    expect(paths).toContain("/api/users");
    expect(paths).toContain("/api/users/{id}");
    expect(paths).toContain("/api/posts");
    expect(paths).toContain("/api/auth/me");
  });

  it("extracts named schemas into components.schemas", async () => {
    const res = await fetch(`${BASE}/api/openapi.json`);
    const spec = await res.json();
    const schemas = Object.keys(spec.components?.schemas ?? {});
    expect(schemas).toContain("User");
    expect(schemas).toContain("Post");
    expect(schemas).toContain("Error");
  });

  it("uses $ref for named schemas in responses", async () => {
    const res = await fetch(`${BASE}/api/openapi.json`);
    const spec = await res.json();
    const get200 =
      spec.paths["/api/users/{id}"]?.get?.responses?.["200"]?.content?.[
        "application/json"
      ]?.schema;
    expect(get200?.$ref).toBe("#/components/schemas/User");
  });

  it("applies defaultResponses (400, 500) to routes that don't override them", async () => {
    const res = await fetch(`${BASE}/api/openapi.json`);
    const spec = await res.json();
    const usersGetResponses = spec.paths["/api/users"]?.get?.responses;
    expect(usersGetResponses?.["400"]).toBeDefined();
    expect(usersGetResponses?.["500"]).toBeDefined();
  });
});
