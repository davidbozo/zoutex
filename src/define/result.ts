/**
 * Result helpers that produce correctly-typed `{ status, body }` objects.
 *
 * These are optional sugar — you can always return the object literal directly.
 * Use them for readability when you want named constructors.
 *
 * @example
 * ```ts
 * if (!user) return notFound({ message: "user not found" });
 * return ok(user);
 * ```
 */

export const ok = <T>(body: T, headers?: Record<string, string>) =>
  ({ status: 200, body, headers }) as const;

export const created = <T>(body: T, headers?: Record<string, string>) =>
  ({ status: 201, body, headers }) as const;

export const accepted = <T>(body: T, headers?: Record<string, string>) =>
  ({ status: 202, body, headers }) as const;

export const noContent = (headers?: Record<string, string>) =>
  ({ status: 204, headers }) as const;

export const badRequest = <T>(body: T, headers?: Record<string, string>) =>
  ({ status: 400, body, headers }) as const;

export const unauthorized = <T>(body: T, headers?: Record<string, string>) =>
  ({ status: 401, body, headers }) as const;

export const forbidden = <T>(body: T, headers?: Record<string, string>) =>
  ({ status: 403, body, headers }) as const;

export const notFound = <T>(body: T, headers?: Record<string, string>) =>
  ({ status: 404, body, headers }) as const;

export const conflict = <T>(body: T, headers?: Record<string, string>) =>
  ({ status: 409, body, headers }) as const;

export const unprocessable = <T>(body: T, headers?: Record<string, string>) =>
  ({ status: 422, body, headers }) as const;

export const tooManyRequests = <T>(body: T, headers?: Record<string, string>) =>
  ({ status: 429, body, headers }) as const;

export const serverError = <T>(body: T, headers?: Record<string, string>) =>
  ({ status: 500, body, headers }) as const;
