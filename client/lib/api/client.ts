// lib/api/client.ts (no signature changes needed)
import { doRequest } from "./request-core";
import { toFull, type ToFull } from "./path";
import { API_VERSION, BFF_HTTP_BASE, INTERNAL_HTTP_BASE, type Version } from "./config";
import type { ShortPath, VersionedPath, InputOf, OutputOf } from "./types";

export function createApiForVersion<V extends Version>(ver: V) {
  const full = <P extends ShortPath<V>>(p: P) => toFull(ver, p) as ToFull<V, P>;

  function make(base: string) {
    return {
      get   : <P extends ShortPath<V>>(p: P, a?: InputOf<VersionedPath<V> & ToFull<V, P>, "get">,    i?: RequestInit) =>
        doRequest<OutputOf<VersionedPath<V> & ToFull<V, P>, "get">>   (base, "GET",    full(p), a, i),
      post  : <P extends ShortPath<V>>(p: P, a:  InputOf<VersionedPath<V> & ToFull<V, P>, "post">,   i?: RequestInit) =>
        doRequest<OutputOf<VersionedPath<V> & ToFull<V, P>, "post">>  (base, "POST",   full(p), a, i),
      put   : <P extends ShortPath<V>>(p: P, a:  InputOf<VersionedPath<V> & ToFull<V, P>, "put">,    i?: RequestInit) =>
        doRequest<OutputOf<VersionedPath<V> & ToFull<V, P>, "put">>   (base, "PUT",    full(p), a, i),
      patch : <P extends ShortPath<V>>(p: P, a:  InputOf<VersionedPath<V> & ToFull<V, P>, "patch">,  i?: RequestInit) =>
        doRequest<OutputOf<VersionedPath<V> & ToFull<V, P>, "patch">> (base, "PATCH",  full(p), a, i),
      delete: <P extends ShortPath<V>>(p: P, a?: InputOf<VersionedPath<V> & ToFull<V, P>, "delete">, i?: RequestInit) =>
        doRequest<OutputOf<VersionedPath<V> & ToFull<V, P>, "delete">>(base, "DELETE", full(p), a, i),
    };
  }

  return {
    bff:   make(BFF_HTTP_BASE),
    server: make(INTERNAL_HTTP_BASE),
  };
}

export const api = createApiForVersion(API_VERSION);
