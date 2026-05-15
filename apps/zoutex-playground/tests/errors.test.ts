import { describe, it, expect } from "vitest";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:4321";

describe("Error handling", () => {
  it("returns 400 with ValidationError shape for invalid JSON body", async () => {
    const res = await fetch(`${BASE}/api/users`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json{",
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.source).toBe("body");
    expect(Array.isArray(body.issues)).toBe(true);
  });

  it("returns 400 with ValidationError shape for missing required body fields", async () => {
    const res = await fetch(`${BASE}/api/users`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Missing Email" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.source).toBe("body");
  });

  it("returns JSON content-type on all error responses", async () => {
    const res = await fetch(`${BASE}/api/users/does-not-exist`);
    expect(res.headers.get("content-type")).toContain("application/json");
  });
});
