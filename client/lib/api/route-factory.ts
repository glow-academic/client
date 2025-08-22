function ensureJson<T>(fn: () => Promise<T>): Promise<Response> { return Promise.resolve().then(fn).then((data) => Response.json(data)); }

export async function handle<T>(fn: () => Promise<T>, onError?: (e: unknown) => void): Promise<Response> {
  try {
    return await ensureJson(fn);
  } catch (e: unknown) {
    onError?.(e);
    const err = e as { statusCode?: number; status?: number; message?: string; name?: string; flatten?: () => unknown };
    const status = (err?.statusCode || err?.status || 500) as number;
    const msg = (err?.message || "Internal Server Error") as string;
    const body = err?.name === "ZodError" ? { error: err.flatten?.() ?? msg } : { error: msg };
    return Response.json(body, { status });
  }
}
