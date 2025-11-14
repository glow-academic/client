// lib/api/request-core.ts
function encodePath(
  path: string,
  params: Record<string, string | number | boolean> = {}
) {
  return path.replace(/\{(\w+)\}/g, (_, k) =>
    encodeURIComponent(String(params[k]))
  );
}

type ArgBag = {
  path?: unknown;
  query?: unknown;
  body?: unknown;
  formData?: unknown;
};

export async function doRequest<T>(
  baseUrl: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  args?: unknown,
  init?: RequestInit
): Promise<T> {
  const bag = (args ?? {}) as ArgBag;

  const urlPathParams = (bag.path ?? {}) as Record<
    string,
    string | number | boolean
  >;
  let url = encodePath(path, urlPathParams);

  let qs = "";
  if (bag.query && typeof bag.query === "object") {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(bag.query as Record<string, unknown>)) {
      if (v == null) continue;
      if (Array.isArray(v)) v.forEach((vv) => q.append(k, String(vv)));
      else q.append(k, String(v));
    }
    qs = q.toString();
  }
  if (qs) url += `?${qs}`;

  let body: BodyInit | null = null;
  let headers: HeadersInit = init?.headers ?? {};

  if (bag.formData instanceof FormData) {
    body = bag.formData;
  } else if (bag.formData && typeof bag.formData === "object") {
    const fd = new FormData();
    for (const [k, v] of Object.entries(
      bag.formData as Record<string, unknown>
    )) {
      if (v == null) continue;
      // @ts-expect-error: FormData accepts various runtime types
      fd.append(k, v);
    }
    body = fd;
  } else if (bag.body !== undefined) {
    headers = { "Content-Type": "application/json", ...headers };
    body = JSON.stringify(bag.body);
  }

  const res = await fetch(`${baseUrl}${url}`, {
    ...init,
    method,
    headers,
    body,
  });

  if (!res.ok) {
    // Try to extract error details from FastAPI error response
    const contentType = res.headers.get("content-type") || "";
    let errorMessage = `${res.status} ${res.statusText}`;

    if (contentType.includes("application/json")) {
      try {
        const errorData = await res.json().catch(() => null);
        if (errorData && typeof errorData === "object") {
          // FastAPI returns {"detail": "..."} for errors
          if ("detail" in errorData && typeof errorData.detail === "string") {
            errorMessage = `${res.status} ${errorData.detail}`;
          } else if (
            "message" in errorData &&
            typeof errorData.message === "string"
          ) {
            errorMessage = `${res.status} ${errorData.message}`;
          } else if (
            "error" in errorData &&
            typeof errorData.error === "string"
          ) {
            errorMessage = `${res.status} ${errorData.error}`;
          }
        }
      } catch {
        // If JSON parsing fails, fall back to status text
      }
    }

    const error = new Error(errorMessage) as Error & {
      status: number;
      statusText: string;
    };
    // Attach status code and original response for debugging
    error.status = res.status;
    error.statusText = res.statusText;
    throw error;
  }

  if (res.status === 204) return undefined as T;

  const ct = res.headers.get("content-type") || "";
  return (
    ct.includes("application/json") ? res.json() : res.text()
  ) as Promise<T>;
}
