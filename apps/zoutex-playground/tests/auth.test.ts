import { describe, it, expect } from "vitest";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:4321";

describe("GET /api/auth/me", () => {
  it("returns 401 with no Authorization header", async () => {
    const res = await fetch(`${BASE}/api/auth/me`);
    expect(res.status).toBe(401);
    expect(typeof (await res.json()).message).toBe("string");
  });

  it("returns 401 with wrong token", async () => {
    const res = await fetch(`${BASE}/api/auth/me`, {
      headers: { authorization: "Bearer wrong-token" },
    });
    expect(res.status).toBe(401);
  });

  it("returns 200 with correct Bearer token", async () => {
    const res = await fetch(`${BASE}/api/auth/me`, {
      headers: { authorization: "Bearer secret-token" },
    });
    expect(res.status).toBe(200);
    const user = await res.json();
    expect(user).toMatchObject({ id: "user-1", name: "Alice", email: "alice@example.com" });
  });
});
