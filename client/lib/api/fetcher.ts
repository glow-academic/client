// lib/api/fetcher.ts
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(
  input: RequestInfo,
  init?: RequestInit,
): Promise<T> {
  // Prepend the basePath prefix to relative URLs
  const prefix = process.env["NEXT_PUBLIC_APP_PREFIX"] || "";
  const url =
    typeof input === "string" && input.startsWith("/")
      ? `${prefix}${input}`
      : input;

  // Don't set Content-Type header for FormData - browser will set it automatically
  const headers =
    init?.body instanceof FormData
      ? init?.headers || {}
      : { "Content-Type": "application/json", ...(init?.headers || {}) };

  const res = await fetch(url, {
    ...init,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body?.error || res.statusText);
  }
  return res.json() as Promise<T>;
}
