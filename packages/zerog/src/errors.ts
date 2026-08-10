export class FailClosedError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 503) {
    super(message);
    this.name = "FailClosedError";
    this.code = code;
    this.status = status;
  }
}

export function isFailClosedError(err: unknown): err is FailClosedError {
  if (err instanceof FailClosedError) return true;
  if (typeof err !== "object" || err === null) return false;
  const rec = err as { name?: string; code?: string; status?: number };
  return rec.name === "FailClosedError" && typeof rec.code === "string";
}
