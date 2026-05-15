import { describe, it, expect } from "vitest";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:4321";

describe("GET /api/posts", () => {
  it("returns 200 with paginated response shape", async () => {
    const res = await fetch(`${BASE}/api/posts`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(typeof body.page).toBe("number");
    expect(typeof body.pageSize).toBe("number");
    expect(typeof body.total).toBe("number");
  });

  it("accepts valid pagination params", async () => {
    const res = await fetch(`${BASE}/api/posts?page=2&pageSize=5`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.page).toBe(2);
    expect(body.pageSize).toBe(5);
  });

  it("coerces numeric strings to numbers", async () => {
    const res = await fetch(`${BASE}/api/posts?page=1&pageSize=10`);
    expect(res.status).toBe(200);
  });

  it("returns 400 when page is not a number", async () => {
    const res = await fetch(`${BASE}/api/posts?page=abc`);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.source).toBe("query");
  });

  it("returns 400 when pageSize exceeds max (100)", async () => {
    const res = await fetch(`${BASE}/api/posts?pageSize=200`);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.source).toBe("query");
  });

  it("returns 400 when page is less than 1", async () => {
    const res = await fetch(`${BASE}/api/posts?page=0`);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.source).toBe("query");
  });
});
