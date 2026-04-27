/**
 * BFF stream endpoint — same-origin SSE proxy.
 *
 * The browser's ``EventSource`` API cannot set request headers, so the
 * only ways to authenticate are (a) put the token in the URL query
 * string or (b) put it in a cookie. (a) leaks the JWT through server
 * logs, browser history, and Referer headers. (b) requires shipping
 * the token to JS where XSS can read it. Neither is acceptable.
 *
 * Solution: this Next.js route runs server-side, reads the user's
 * Auth.js session, attaches ``X-Api-Key`` + ``Authorization: Bearer``,
 * and pipes the upstream SSE response straight back to the browser.
 * The JWT never leaves the Next.js process.
 *
 * Usage:
 *   new EventSource("/api/stream/attempt?group_id=...")
 *   new EventSource("/api/stream/persona")
 *
 * Path shape: ``/api/stream/{artifact}``. The ``/stream`` suffix on
 * the upstream (``:8000/{artifact}/stream``) is implicit — callers
 * already know they're opening a stream from the route name, so we
 * don't make them repeat it.
 */

import type { NextRequest } from "next/server";

import { auth } from "@/auth";
import { INTERNAL_HTTP_BASE } from "@/lib/api/config";

export const runtime = "nodejs";
// SSE streams must not be buffered. ``force-dynamic`` opts the route
// out of Next.js fetch caching entirely.
export const dynamic = "force-dynamic";

// Hardcoded for development — production should pull from env.
// Mirrors lib/api/auth-headers.ts so SSR and BFF paths agree.
const API_KEY = "glw_dev_test_key_123";

const STRIP_RESPONSE_HEADERS = new Set([
  "content-length", // streaming — let the connection handle framing
  "content-encoding", // upstream gzip/br is decoded by the proxy fetch
  "transfer-encoding",
  "connection",
]);

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ artifact: string }> },
): Promise<Response> {
  const { artifact } = await ctx.params;
  if (!artifact || artifact.includes("/")) {
    return new Response(
      JSON.stringify({ detail: "Invalid artifact segment" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const upstreamUrl = `${INTERNAL_HTTP_BASE}/${artifact}/stream${req.nextUrl.search}`;

  const session = await auth();
  if (!session?.id_token) {
    return new Response(
      JSON.stringify({ detail: "Not authenticated" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        Accept: "text/event-stream",
        "X-Api-Key": API_KEY,
        Authorization: `Bearer ${session.id_token}`,
      },
      redirect: "manual",
      // ``cache: "no-store"`` doubles down on the route-level
      // ``force-dynamic`` — Node ``fetch`` caches by default.
      cache: "no-store",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ detail: `Upstream fetch failed: ${message}` }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  const responseHeaders = new Headers();
  for (const [key, value] of upstream.headers.entries()) {
    if (STRIP_RESPONSE_HEADERS.has(key.toLowerCase())) continue;
    responseHeaders.set(key, value);
  }
  // Belt-and-suspenders: if upstream forgot the SSE content type but
  // the body is still a stream, default it so the browser picks the
  // EventSource parser.
  if (!responseHeaders.has("content-type")) {
    responseHeaders.set("content-type", "text/event-stream");
  }
  responseHeaders.set("cache-control", "no-cache, no-transform");

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}
