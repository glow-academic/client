// lib/api/config.ts
import { env } from "./env";

export type Version = "v3";
export const API_VERSION = "v3" as const satisfies Version;

// Prefix you already use for multi-tenant paths (may be empty: "")
const APP_PREFIX = env("NEXT_PUBLIC_APP_PREFIX", ""); // e.g. "" or "/glow"

// --- HTTP bases ---
/**
 * Browser/RSC → call the Next.js BFF proxy (same-origin, cookies, no CORS)
 * This lives under /api/proxy (keeps /api/* free for NextAuth & legacy v2).
 */
export const BFF_HTTP_BASE = join(APP_PREFIX, "/api/proxy");

/**
 * Server (Route Handlers / Server Actions) → call FastAPI directly.
 * In dev: http://localhost:8000
 * In prod: http://server:8000 (Docker service)
 * Can be overridden via INTERNAL_API_BASE.
 */
export const INTERNAL_HTTP_BASE =
  env("INTERNAL_API_BASE") ||
  (process.env.NODE_ENV === "development"
    ? "http://localhost:8000"
    : "http://server:8000");

// --- WS bases & socket path ---
/** Build WS base by swapping scheme for HTTP base. */
function httpToWs(base: string) {
  if (!base) return ""; // same-origin
  return base.replace(/^http(s?):/i, (_, s) => (s ? "wss:" : "ws:"));
}

/** Socket.IO path matches your FastAPI `socketio_path` = `${APP_PREFIX}/socket.io` */
export const SOCKET_PATH = join(APP_PREFIX, "/socket.io");

// Browser WS to FastAPI (same origin is fine if you terminate at proxy; you currently connect to backend directly)
export const BFF_WS_BASE = httpToWs(BFF_HTTP_BASE);
// Direct WS to backend (mirrors INTERNAL_HTTP_BASE behavior)
export const INTERNAL_WS_BASE = httpToWs(INTERNAL_HTTP_BASE);

// tiny local helper
function join(a: string, b: string) {
  if (!a) return b;
  return `${a.replace(/\/+$/, "")}/${b.replace(/^\/+/, "")}`;
}
