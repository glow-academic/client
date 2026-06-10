// lib/api/client.ts
//
// SERVER-ONLY REST api. Used by Server Components (the `(main)/**/page.tsx`
// SSR data fetches), Server Actions (`lib/api/ack.ts`, `lib/actions/*`),
// and any other server-side caller. It augments the client-safe transport
// (`request-core.ts`) with the `Authorization: Bearer <id_token>` header,
// read server-side from the httpOnly session cookie via the server-only
// token module (`auth-headers.ts` → `server-token.ts`).
//
// The `server-only` import below makes `next build` FAIL if a CLIENT
// component imports this module (which would drag `next/headers` into the
// browser bundle and re-expose the bearer). The browser's command path
// uses the client-safe sender in `lib/transport/commands-http.ts` instead,
// which imports `request-core` directly and never this module.
import "server-only";

import { getAuthHeaders } from "./auth-headers";
import { INTERNAL_HTTP_BASE } from "./config";
import { toFull } from "./path";
import { doRequest, type DoRequestInit } from "./request-core";
import type { InputOf, OutputOf, PathKey, ShortPath } from "./types";

function createApi() {
  const full = (p: ShortPath) => toFull(p);
  const pickBase = () => INTERNAL_HTTP_BASE;

  /**
   * Merge the server-side auth header into the per-call init. Auth wins
   * over any caller-supplied header of the same name (matching the prior
   * behavior, where request-core spread auth headers last). Failure to
   * resolve the session degrades to no `Authorization` header rather than
   * throwing — the API then returns 401, surfaced to the caller.
   */
  async function withAuth(i?: DoRequestInit): Promise<DoRequestInit> {
    let auth: Record<string, string> = {};
    try {
      auth = await getAuthHeaders();
    } catch {
      // No session available — proceed without an Authorization header.
    }
    const callerHeaders = (i?.headers ?? {}) as Record<string, string>;
    return { ...i, headers: { ...callerHeaders, ...auth } };
  }

  async function get<P extends ShortPath>(
    p: P,
    a?: InputOf<Extract<PathKey, P>, "get">,
    i?: DoRequestInit,
  ) {
    return doRequest<OutputOf<Extract<PathKey, P>, "get">>(
      pickBase(),
      "GET",
      full(p),
      a,
      await withAuth(i),
    );
  }

  async function post<P extends ShortPath>(
    p: P,
    a: InputOf<Extract<PathKey, P>, "post">,
    i?: DoRequestInit,
  ) {
    return doRequest<OutputOf<Extract<PathKey, P>, "post">>(
      pickBase(),
      "POST",
      full(p),
      a,
      await withAuth(i),
    );
  }

  async function put<P extends ShortPath>(
    p: P,
    a: InputOf<Extract<PathKey, P>, "put">,
    i?: DoRequestInit,
  ) {
    return doRequest<OutputOf<Extract<PathKey, P>, "put">>(
      pickBase(),
      "PUT",
      full(p),
      a,
      await withAuth(i),
    );
  }

  async function patch<P extends ShortPath>(
    p: P,
    a: InputOf<Extract<PathKey, P>, "patch">,
    i?: DoRequestInit,
  ) {
    return doRequest<OutputOf<Extract<PathKey, P>, "patch">>(
      pickBase(),
      "PATCH",
      full(p),
      a,
      await withAuth(i),
    );
  }

  async function del<P extends ShortPath>(
    p: P,
    a?: InputOf<Extract<PathKey, P>, "delete">,
    i?: DoRequestInit,
  ) {
    return doRequest<OutputOf<Extract<PathKey, P>, "delete">>(
      pickBase(),
      "DELETE",
      full(p),
      a,
      await withAuth(i),
    );
  }

  return { get, post, put, patch, delete: del } as const;
}

export const api = createApi();
