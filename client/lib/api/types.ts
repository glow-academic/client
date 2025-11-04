// lib/api/types.ts
import type { paths } from "@/lib/api-types"; // from openapi-typescript
import type { Version } from "./config";

type M = "get" | "post" | "put" | "patch" | "delete";
export type PathKey = Extract<keyof paths, string>;

// All paths for a given version: `/api/vX/...`
export type VersionedPath<V extends Version> = Extract<
  PathKey,
  `/api/${V}/${string}`
>;

// Short form exposed to your app: `/profile/...`
export type ShortPath<V extends Version> =
  VersionedPath<V> extends `/api/${V}/${infer R}` ? `/${R}` : never;

// Operation for a (method, path)
type Op<P extends PathKey, Meth extends M> = paths[P][Meth];

// Inferred input bag (path/query/body/formData)
export type InputOf<P extends PathKey, Meth extends M> = (Op<P, Meth> extends {
  parameters: { path: infer PP };
}
  ? { path: PP }
  : object) &
  (Op<P, Meth> extends { parameters: { query: infer QQ } }
    ? { query: QQ }
    : object) &
  (Op<P, Meth> extends {
    requestBody: { content: { "application/json": infer B } };
  }
    ? { body: B }
    : object) &
  (Op<P, Meth> extends {
    requestBody: { content: { "multipart/form-data": infer F } };
  }
    ? { formData: F }
    : object);

// Successful response payload
type Responses<P extends PathKey, Meth extends M> =
  Op<P, Meth> extends { responses: infer R } ? R : never;
type Content<T> = T extends { content: infer C }
  ? C extends { "application/json": infer A }
    ? A
    : C extends { "text/plain": infer T }
      ? T
      : C extends { "*/*": infer U }
        ? U
        : unknown
  : unknown;
type Success = "200" | "201" | "202" | "204";
export type OutputOf<P extends PathKey, Meth extends M> = Content<
  Responses<P, Meth>[Extract<Success, keyof Responses<P, Meth>>]
>;
