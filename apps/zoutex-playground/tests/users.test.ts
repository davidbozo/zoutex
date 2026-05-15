import { describe, it, expect, beforeAll } from "vitest";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:4321";

async function createUser(name: string, email: string) {
  const res = await fetch(`${BASE}/api/users`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, email }),
  });
  return res;
}

describe("GET /api/users", () => {
  it("returns 200 with an array", async () => {
    const res = await fetch(`${BASE}/api/users`);
    expect(res.status).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  it("filters by search query", async () => {
    await createUser("SearchableUser", `search-${Date.now()}@example.com`);
    const res = await fetch(`${BASE}/api/users?search=SearchableUser`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.every((u: { name: string }) => u.name.includes("SearchableUser"))).toBe(true);
  });
});

describe("POST /api/users", () => {
  it("creates a user and returns 201", async () => {
    const res = await createUser("New User", `new-${Date.now()}@example.com`);
    expect(res.status).toBe(201);
    const user = await res.json();
    expect(user).toMatchObject({ name: "New User" });
    expect(typeof user.id).toBe("string");
  });

  it("returns 400 when body is invalid (empty name)", async () => {
    const res = await createUser("", `bad-${Date.now()}@example.com`);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.source).toBe("body");
    expect(Array.isArray(body.issues)).toBe(true);
  });

  it("returns 400 when email is malformed", async () => {
    const res = await createUser("Test", "not-an-email");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.source).toBe("body");
  });

  it("returns 409 on duplicate email", async () => {
    const email = `dup-${Date.now()}@example.com`;
    await createUser("First", email);
    const res = await createUser("Second", email);
    expect(res.status).toBe(409);
    expect((await res.json()).message).toMatch(/email/i);
  });
});

describe("GET /api/users/:id", () => {
  let userId: string;

  beforeAll(async () => {
    const res = await createUser("CRUD User", `crud-${Date.now()}@example.com`);
    userId = (await res.json()).id;
  });

  it("returns 200 with the user", async () => {
    const res = await fetch(`${BASE}/api/users/${userId}`);
    expect(res.status).toBe(200);
    const user = await res.json();
    expect(user.id).toBe(userId);
    expect(user.name).toBe("CRUD User");
  });

  it("returns 404 for unknown id", async () => {
    const res = await fetch(`${BASE}/api/users/does-not-exist`);
    expect(res.status).toBe(404);
    expect(typeof (await res.json()).message).toBe("string");
  });
});

describe("PUT /api/users/:id", () => {
  let userId: string;

  beforeAll(async () => {
    const res = await createUser("Update Me", `update-${Date.now()}@example.com`);
    userId = (await res.json()).id;
  });

  it("updates the user name and returns 200", async () => {
    const res = await fetch(`${BASE}/api/users/${userId}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Updated Name" }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).name).toBe("Updated Name");
  });

  it("returns 404 for unknown id", async () => {
    const res = await fetch(`${BASE}/api/users/does-not-exist`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "X" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/users/:id", () => {
  it("deletes the user and returns 204 with no body", async () => {
    const createRes = await createUser("Delete Me", `delete-${Date.now()}@example.com`);
    const { id } = await createRes.json();

    const delRes = await fetch(`${BASE}/api/users/${id}`, { method: "DELETE" });
    expect(delRes.status).toBe(204);
    expect(await delRes.text()).toBe("");

    const getRes = await fetch(`${BASE}/api/users/${id}`);
    expect(getRes.status).toBe(404);
  });

  it("returns 404 for unknown id", async () => {
    const res = await fetch(`${BASE}/api/users/does-not-exist`, { method: "DELETE" });
    expect(res.status).toBe(404);
  });
});
