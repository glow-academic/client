// lib/api/client.ts
import { API_VERSION, INTERNAL_HTTP_BASE, type Version } from "./config";
import { toFull, type ToFull } from "./path";
import { doRequest } from "./request-core";
import type { InputOf, OutputOf, PathKey, ShortPath } from "./types";

export function createApi<V extends Version>(ver: V) {
  const full = <P extends ShortPath<V>>(p: P) => toFull(ver, p) as ToFull<V, P>;
  const pickBase = () => INTERNAL_HTTP_BASE;

  // Helper type: the exact OpenAPI key for this short path
  type KeyFor<P extends ShortPath<V>> = Extract<PathKey, ToFull<V, P>>;

  function get<P extends ShortPath<V>>(
    p: P,
    a?: InputOf<KeyFor<P>, "get">,
    i?: RequestInit,
  ) {
    return doRequest<OutputOf<KeyFor<P>, "get">>(
      pickBase(),
      "GET",
      full(p),
      a,
      i,
    );
  }

  function post<P extends ShortPath<V>>(
    p: P,
    a: InputOf<KeyFor<P>, "post">,
    i?: RequestInit,
  ) {
    return doRequest<OutputOf<KeyFor<P>, "post">>(
      pickBase(),
      "POST",
      full(p),
      a,
      i,
    );
  }

  function put<P extends ShortPath<V>>(
    p: P,
    a: InputOf<KeyFor<P>, "put">,
    i?: RequestInit,
  ) {
    return doRequest<OutputOf<KeyFor<P>, "put">>(
      pickBase(),
      "PUT",
      full(p),
      a,
      i,
    );
  }

  function patch<P extends ShortPath<V>>(
    p: P,
    a: InputOf<KeyFor<P>, "patch">,
    i?: RequestInit,
  ) {
    return doRequest<OutputOf<KeyFor<P>, "patch">>(
      pickBase(),
      "PATCH",
      full(p),
      a,
      i,
    );
  }

  function del<P extends ShortPath<V>>(
    p: P,
    a?: InputOf<KeyFor<P>, "delete">,
    i?: RequestInit,
  ) {
    return doRequest<OutputOf<KeyFor<P>, "delete">>(
      pickBase(),
      "DELETE",
      full(p),
      a,
      i,
    );
  }

  return { get, post, put, patch, delete: del } as const;
}

export const api = createApi(API_VERSION);
