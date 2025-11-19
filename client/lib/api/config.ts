// lib/api/config.ts
import { env } from "./env";

export type Version = "v3";
export const API_VERSION = "v3" as const satisfies Version;

// Prefix you already use for multi-tenant paths (may be empty: "")
const APP_PREFIX = env("NEXT_PUBLIC_APP_PREFIX", ""); // e.g. "" or "/glow"

// --- HTTP base ---
/**
 * All API calls go directly to FastAPI server.
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

/**
 * WebSocket base URL for browser connections.
 * In dev: connects directly to backend (ws://localhost:8000)
 * In prod: uses same-origin (empty string) to connect through nginx proxy
 *
 * Note: Since nginx only listens on port 80 (HTTP), WS is fine.
 * If you add HTTPS/SSL later, you'll need WSS (browsers require secure WebSocket
 * when page is served over HTTPS).
 */
export const INTERNAL_WS_BASE =
  process.env.NODE_ENV === "development"
    ? httpToWs(INTERNAL_HTTP_BASE) // Direct to backend in dev
    : ""; // Same-origin in prod (goes through nginx proxy)

// tiny local helper
function join(a: string, b: string) {
  if (!a) return b;
  return `${a.replace(/\/+$/, "")}/${b.replace(/^\/+/, "")}`;
}
