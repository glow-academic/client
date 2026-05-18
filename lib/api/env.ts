// lib/api/env.ts
export const isBrowser = typeof window !== "undefined";

export function env(name: string, fallback = ""): string {
  const v = process.env[name];
  return v === undefined || v === null ? fallback : v;
}

export function joinUrl(base: string, path: string) {
  if (!base) return path;
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}
