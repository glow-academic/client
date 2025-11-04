// lib/api/path.ts
import type { Version } from "./config";

export type ToFull<V extends Version, P extends `/${string}`> =
  P extends `/${infer R}` ? `/api/${V}/${R}` : never;

export function toFull<V extends Version>(ver: V, p: `/${string}`): ToFull<V, typeof p> {
  return (`/api/${ver}${p}`) as ToFull<V, typeof p>;
}
