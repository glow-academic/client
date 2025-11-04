// lib/api/request-core.ts
function encodePath(
    path: string,
    params: Record<string, string | number | boolean> = {}
  ) {
    return path.replace(/\{(\w+)\}/g, (_, k) => encodeURIComponent(String(params[k])));
  }
  
  type ArgBag = {
    path?: unknown;
    query?: unknown;
    body?: unknown;
    formData?: unknown; // accept unknown; narrow at runtime
  };
  
  export async function doRequest<T>(
    baseUrl: string,
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
    path: string,
    args?: unknown,                // <— accept unknown to match generated unions
    init?: RequestInit
  ): Promise<T> {
    const bag = (args ?? {}) as ArgBag;
  
    const urlPathParams = (bag.path ?? {}) as Record<string, string | number | boolean>;
    let url = encodePath(path, urlPathParams);
  
    // Build query safely from unknown
    let qs = "";
    if (bag.query && typeof bag.query === "object") {
      const q = new URLSearchParams();
      for (const [k, v] of Object.entries(bag.query as Record<string, unknown>)) {
        if (v == null) continue;
        if (Array.isArray(v)) {
          for (const vv of v) q.append(k, String(vv));
        } else {
          q.append(k, String(v));
        }
      }
      qs = q.toString();
    }
    if (qs) url += `?${qs}`;
  
    let body: BodyInit | null = null;          // <— important: initialize as null (not undefined)
    let headers: HeadersInit = init?.headers ?? {};
  
    // Narrow formData at runtime
    if (bag.formData instanceof FormData) {
      body = bag.formData;
    } else if (bag.formData && typeof bag.formData === "object") {
      const fd = new FormData();
      for (const [k, v] of Object.entries(bag.formData as Record<string, unknown>)) {
        if (v === undefined || v === null) continue;
        // @ts-expect-error: FormData accepts many runtime types
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
      body,                           // <— now BodyInit | null, satisfies Next’s strict typing
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    if (res.status === 204) return undefined as T;
  
    const ct = res.headers.get("content-type") || "";
    return (ct.includes("application/json") ? res.json() : res.text()) as Promise<T>;
  }
  