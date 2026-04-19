import { readConfig } from "./config.js";

export class CliApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "CliApiError";
  }
}

export async function api<T>(
  path: string,
  init?: RequestInit & { auth?: boolean },
): Promise<T> {
  const cfg = readConfig();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  const needsAuth = init?.auth !== false;
  if (needsAuth) {
    if (!cfg.token) {
      throw new CliApiError(
        401,
        'Not authenticated. Run "osh login" first.',
      );
    }
    headers["Authorization"] = `Bearer ${cfg.token}`;
  }

  const res = await fetch(`${cfg.apiUrl}${path}`, { ...init, headers });
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as { detail?: string };
      if (body?.detail) detail = body.detail;
    } catch {
      /* non-JSON error body */
    }
    throw new CliApiError(res.status, detail);
  }
  return (await res.json()) as T;
}
