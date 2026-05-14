/**
 * Base error class for errors thrown by ZouteX or intentionally thrown
 * from handlers to short-circuit with an HTTP response.
 */
export class ZouteXError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "ZouteXError";
  }
}

/** Thrown when input validation (params/query/body) fails. */
export class ValidationError extends ZouteXError {
  constructor(
    public readonly source: "params" | "query" | "body",
    public readonly issues: unknown,
  ) {
    super(`Validation failed for ${source}`, 400, {
      message: `Validation failed for ${source}`,
      source,
      issues,
    });
    this.name = "ValidationError";
  }
}

/** Thrown when a handler returns a response that doesn't match the declared schema. */
export class ResponseShapeError extends ZouteXError {
  constructor(status: number, public readonly issues: unknown) {
    super(`Response body for status ${status} did not match declared schema`, 500, {
      message: "Internal response shape error",
    });
    this.name = "ResponseShapeError";
  }
}
