// lib/api/client.ts
import { INTERNAL_HTTP_BASE } from "./config";
import { toFull } from "./path";
import { doRequest } from "./request-core";
import type { InputOf, OutputOf, PathKey, ShortPath } from "./types";

function createApi() {
  const full = (p: ShortPath) => toFull(p);
  const pickBase = () => INTERNAL_HTTP_BASE;

  function get<P extends ShortPath>(
    p: P,
    a?: InputOf<Extract<PathKey, P>, "get">,
    i?: RequestInit,
  ) {
    return doRequest<OutputOf<Extract<PathKey, P>, "get">>(
      pickBase(),
      "GET",
      full(p),
      a,
      i,
    );
  }

  function post<P extends ShortPath>(
    p: P,
    a: InputOf<Extract<PathKey, P>, "post">,
    i?: RequestInit,
  ) {
    return doRequest<OutputOf<Extract<PathKey, P>, "post">>(
      pickBase(),
      "POST",
      full(p),
      a,
      i,
    );
  }

  function put<P extends ShortPath>(
    p: P,
    a: InputOf<Extract<PathKey, P>, "put">,
    i?: RequestInit,
  ) {
    return doRequest<OutputOf<Extract<PathKey, P>, "put">>(
      pickBase(),
      "PUT",
      full(p),
      a,
      i,
    );
  }

  function patch<P extends ShortPath>(
    p: P,
    a: InputOf<Extract<PathKey, P>, "patch">,
    i?: RequestInit,
  ) {
    return doRequest<OutputOf<Extract<PathKey, P>, "patch">>(
      pickBase(),
      "PATCH",
      full(p),
      a,
      i,
    );
  }

  function del<P extends ShortPath>(
    p: P,
    a?: InputOf<Extract<PathKey, P>, "delete">,
    i?: RequestInit,
  ) {
    return doRequest<OutputOf<Extract<PathKey, P>, "delete">>(
      pickBase(),
      "DELETE",
      full(p),
      a,
      i,
    );
  }

  return { get, post, put, patch, delete: del } as const;
}

export const api = createApi();
