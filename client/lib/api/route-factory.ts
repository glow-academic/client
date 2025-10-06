function toPlainJson(value: unknown): unknown {
  if (value === null || value === undefined) return value as null | undefined;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((v) => toPlainJson(v));
  if (typeof value === "object") {
    // Sanitize nested Response objects to plain info
    if (value instanceof Response)
      return { ok: value.ok, status: value.status };
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = toPlainJson(v);
    }
    return out;
  }
  return value;
}

function ensureJson<T>(fn: () => Promise<T>): Promise<Response> {
  return Promise.resolve()
    .then(fn)
    .then((data) => {
      if (data instanceof Response) return data;
      const sanitized = toPlainJson(data);
      try {
        return Response.json(sanitized);
      } catch {
        return new Response(JSON.stringify(sanitized), {
          headers: { "content-type": "application/json" },
        });
      }
    });
}

export async function handle<T>(
  fn: () => Promise<T>,
  onError?: (e: unknown) => void,
): Promise<Response> {
  try {
    return await ensureJson(fn);
  } catch (e: unknown) {
    onError?.(e);
    const err = e as {
      statusCode?: number;
      status?: number;
      message?: string;
      name?: string;
      flatten?: () => unknown;
    };
    const status = (err?.statusCode || err?.status || 500) as number;
    const msg = (err?.message || "Internal Server Error") as string;
    const body =
      err?.name === "ZodError"
        ? { error: err.flatten?.() ?? msg }
        : { error: msg };
    return Response.json(body, { status });
  }
}
