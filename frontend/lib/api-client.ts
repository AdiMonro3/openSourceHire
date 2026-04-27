const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly detail?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    let detail: unknown = undefined;
    try {
      const body = await res.json();
      if (body?.detail !== undefined) {
        detail = body.detail;
        if (typeof body.detail === "string") {
          message = body.detail;
        } else if (body.detail && typeof body.detail === "object") {
          message =
            (body.detail as Record<string, unknown>).conflict as string ??
            (body.detail as Record<string, unknown>).message as string ??
            message;
        }
      }
    } catch {
      /* ignore non-JSON error body */
    }
    throw new ApiError(res.status, message, detail);
  }
  return res.json() as Promise<T>;
}
