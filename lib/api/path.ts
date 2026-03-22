// lib/api/path.ts
// After removing the /v5/ version segment, paths are used as-is.

export function toFull(p: `/${string}`): string {
  return p;
}
