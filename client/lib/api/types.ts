// lib/api/types.ts
import type { paths } from "@/lib/api/schema";
import type { Version } from "./config";

type M = "get" | "post" | "put" | "patch" | "delete";
export type PathKey = Extract<keyof paths, string>;

// Version-aware full path union: "/api/v5/..."
export type VersionedPath<V extends Version> = Extract<
  PathKey,
  `/api/${V}/${string}`
>;

// App-level short path: "/personas/list"
export type ShortPath<V extends Version> =
  VersionedPath<V> extends `/api/${V}/${infer R}` ? `/${R}` : never;

// If the method is missing on this path, resolve to undefined (not never)
type Op<P extends PathKey, Meth extends M> = P extends keyof paths
  ? Meth extends keyof paths[P]
    ? paths[P][Meth]
    : undefined
  : undefined;

// ---- helpers to make a field disappear when its type is never ----

type OptField<K extends string, T> = [T] extends [never]
  ? object
  : { [P in K]: T };

// ---------- InputOf (fields omitted if not present in OpenAPI) ----------
export type InputOf<P extends PathKey, Meth extends M> =
  // path params
  OptField<
    "path",
    Op<P, Meth> extends { parameters?: { path?: infer PP } } ? PP : never
  > &
    // query params
    OptField<
      "query",
      Op<P, Meth> extends { parameters?: { query?: infer QQ } } ? QQ : never
    > &
    // JSON body
    OptField<
      "body",
      Op<P, Meth> extends {
        requestBody?: { content: { "application/json": infer B } };
      }
        ? B
        : never
    > &
    // multipart/form-data
    OptField<
      "formData",
      Op<P, Meth> extends {
        requestBody?: { content: { "multipart/form-data": infer F } };
      }
        ? F
        : never
    >;

// ---------- OutputOf (resilient to numeric or string status keys) ----------
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

// Accept both numeric 200 and string "200"
type Preferred = 200 | 201 | 202 | 204 | "200" | "201" | "202" | "204";

// If generator emits numeric keys, keyof R could be 200 | 422; include numbers & stringified numbers
type AnySuccessCode<R> = Extract<keyof R, number | `${number}`>;

// Pick preferred if present, otherwise any numeric success
type PickSuccess<R> =
  Extract<keyof R, Preferred> extends never
    ? AnySuccessCode<R>
    : Extract<keyof R, Preferred>;

export type OutputOf<P extends PathKey, Meth extends M> = [
  Responses<P, Meth>,
] extends [never]
  ? unknown // if we couldn’t see responses at all, don’t collapse to never
  : Content<Responses<P, Meth>[PickSuccess<Responses<P, Meth>>]>;
