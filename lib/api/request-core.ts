// lib/api/request-core.ts
//
// CLIENT-SAFE shared REST transport. This module is reachable from the
// CLIENT bundle (via `lib/transport/commands-http.ts` → `TransportProvider`),
// so it MUST NOT import any server-only module (`next/headers`,
// `lib/api/server-token.ts`, `lib/api/auth-headers.ts`). It deliberately
// does NOT attach any `Authorization` bearer: auth is injected one layer up
// by the SERVER api (`lib/api/client.ts`, server-only) for server-side
// callers, and the browser never holds the bearer (#103). Callers may still
// pass headers via `init.headers`.

/**
 * Default request timeout (ms) for the shared REST fetch.
 *
 * Deliberately GENEROUS: AI generation, exports, and document/video
 * processing legitimately take a while, so we cap at 120s rather than a
 * typical 15-30s so we don't abort slow-but-valid work. Callers that need
 * longer (or no) bound can override per-call via `init.timeoutMs`
 * (pass a larger number, or `null`/`0` to disable the timeout entirely).
 *
 * NOTE: this only guards `doRequest`, the fully-buffered JSON/text fetch
 * behind `api.get/post/...`. Long-lived streaming transports (SSE via
 * `EventSource` in `lib/transport/events-sse.ts`, WebSocket in
 * `lib/transport/*-ws.ts`) do NOT route through here and are intentionally
 * never timed out.
 */
export const DEFAULT_REQUEST_TIMEOUT_MS = 120_000;

/** `RequestInit` plus our per-call timeout override. */
export type DoRequestInit = RequestInit & {
  /**
   * Abort the request after this many ms. Defaults to
   * {@link DEFAULT_REQUEST_TIMEOUT_MS}. Pass `null` or `0` to disable.
   */
  timeoutMs?: number | null;
};

/**
 * Combine an optional caller signal with our timeout signal so either one
 * aborting aborts the fetch. Avoids relying on `AbortSignal.any` (only
 * available in very recent browsers).
 */
function combineSignals(
  caller: AbortSignal | null | undefined,
  timeout: AbortSignal
): AbortSignal {
  if (!caller) return timeout;
  const controller = new AbortController();
  const onAbort = (reason: unknown) => {
    if (!controller.signal.aborted) controller.abort(reason);
  };
  if (caller.aborted) onAbort(caller.reason);
  else caller.addEventListener("abort", () => onAbort(caller.reason));
  if (timeout.aborted) onAbort(timeout.reason);
  else timeout.addEventListener("abort", () => onAbort(timeout.reason));
  return controller.signal;
}

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
  init?: DoRequestInit
): Promise<T> {
  const { timeoutMs, signal: callerSignal, ...restInit } = init ?? {};
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
  // Auth (`Authorization: Bearer`) is injected by the SERVER api layer
  // (`lib/api/client.ts`) before calling here, arriving via `init.headers`.
  // This module never reads the session itself — see the boundary note above.
  let headers: HeadersInit = restInit.headers ?? {};

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

  // Generous AbortController-based timeout so a stalled backend rejects
  // (surfacing the caller's catch -> toast.error) instead of hanging the
  // awaiting mutation forever. `null`/`0` disables it; a caller signal is
  // combined so either source can abort.
  const effectiveTimeout =
    timeoutMs === undefined ? DEFAULT_REQUEST_TIMEOUT_MS : timeoutMs;
  let timeoutController: AbortController | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let signal: AbortSignal | null = callerSignal ?? null;

  if (effectiveTimeout != null && effectiveTimeout > 0) {
    timeoutController = new AbortController();
    timer = setTimeout(() => timeoutController!.abort(), effectiveTimeout);
    signal = combineSignals(callerSignal, timeoutController.signal);
  }

  let res: Response;
  try {
    res = await fetch(`${baseUrl}${url}`, {
      ...restInit,
      method,
      headers,
      body,
      signal,
    });
  } catch (err) {
    // Distinguish our timeout from a caller-initiated / network abort so the
    // catch handler shows a clear message rather than a generic AbortError.
    if (
      timeoutController?.signal.aborted &&
      !(callerSignal && callerSignal.aborted)
    ) {
      throw new Error(
        `Request timed out after ${effectiveTimeout}ms: ${method} ${path}`
      );
    }
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }

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
          } else if ("detail" in errorData && Array.isArray(errorData.detail)) {
            errorMessage = `${res.status} ${JSON.stringify(errorData.detail)}`;
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
