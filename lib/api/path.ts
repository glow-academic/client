// lib/api/path.ts
// After removing the /v5/ version segment, paths are used as-is.
// Also strip the /artifacts/ prefix — API serves at root.

export function toFull(p: `/${string}`): string {
  if (p.startsWith("/artifacts/")) {
    return p.replace("/artifacts/", "/");
  }
  return p;
}
