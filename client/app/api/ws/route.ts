/**
 * app/api/ws/route.ts
 * Transparent WebSocket proxy → FastAPI (or any target returned by getWebSocketUrl()).
 *
 * Requirements
 * ──────────────────────────────────────────────────────────────────────────────
 * 1. Runs ONLY on the “nodejs” runtime.  (Edge runtime can’t proxy raw sockets.)
 * 2. Your Docker Compose must set FASTAPI_INTERNAL_WS (or similar) so that
 *    getWebSocketUrl() can resolve to something like "ws://fastapi:8000".
 *
 * Usage
 * ──────────────────────────────────────────────────────────────────────────────
 * Browser connects to:  `wss://<your-site>/api/ws`
 * Next.js upgrades the request → pipes it to FastAPI → streams frames unchanged.
 */

import { logError } from "@/utils/logger";
import { createProxyServer } from "http-proxy";
import type { NextApiRequest, NextApiResponse } from "next";

function getWebSocketUrl(): string {
  if (process.env["NODE_ENV"] === "development") {
    return "ws://localhost:8000";
  } else {
    return "ws://server:8000";
  }
}

/* ─── Singleton proxy (reuse across hot-reloads) ───────────────────────────── */
const proxy = createProxyServer({
  target: getWebSocketUrl(),
  ws: true, // Enable WebSocket tunnelling
  changeOrigin: true, // Spoof Host header → helps if FastAPI checks it
  secure: false, // Don’t verify TLS when target is plain WS
});

/* Optional: log proxy errors so they’re not swallowed silently */
proxy.on("error", (err: Error) => logError("[WS-proxy] error:", err.message));

/* ─── Unified handler for all HTTP methods ─────────────────────────────────── */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const url = new URL(req.url || "", `http://${req.headers.host}`);
  const pathname = url.pathname;

  /* 1️⃣ Accept ONLY the WebSocket handshake (GET + Upgrade: websocket). */
  if (
    req.method !== "GET" ||
    req.headers.upgrade?.toLowerCase() !== "websocket"
  ) {
    res
      .status(400)
      .end(`Use WebSocket Upgrade to ${pathname}; got ${req.method} instead`);
    return;
  }

  /* 2️⃣ Forward the connection to FastAPI (or whatever target). */
  proxy.ws(req, req.socket, Buffer.alloc(0));
}

/* ─── App Router-specific config tweaks ─────────────────────────────────────── */
export const config = {
  // Disable the default body parser ⇒ keeps the raw socket intact
  api: { bodyParser: false, externalResolver: true },

  // Make sure this route runs in a traditional Node.js context (not Edge)
  runtime: "nodejs",
};

// These suppress App Router’s route “naming” rules; not strictly required
export const dynamic = "force-dynamic";
