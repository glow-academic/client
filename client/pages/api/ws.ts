/**
 * pages/api/ws.ts
 * Socket.IO proxy for Pages Router in hybrid Next.js setup
 * Proxies Socket.IO connections to FastAPI backend
 */

import { logError, logInfo } from "@/utils/logger";
import type { NextApiRequest, NextApiResponse } from "next";

// Get the target URL for the proxy (server-side HTTP URL for Socket.IO)
function getProxyTargetUrl(): string {
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:8000";
  }
  return "http://server:8000";
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const originalUrl = req.url || "";

  // Rewrite URL: /api/ws/... -> /socket.io/...
  const targetPath = originalUrl.replace(/^\/api\/ws/, "/socket.io");
  const targetUrl = `${getProxyTargetUrl()}${targetPath}`;

  logInfo("[SocketIO-proxy] Proxying request", {
    method: req.method,
    originalUrl,
    targetUrl,
    headers: {
      upgrade: req.headers.upgrade,
      connection: req.headers.connection,
    },
  });

  try {
    // Handle WebSocket upgrade requests
    if (req.headers.upgrade?.toLowerCase() === "websocket") {
      logError(
        "[SocketIO-proxy] WebSocket upgrades not supported in fetch proxy"
      );
      return res.status(426).json({
        error: "WebSocket upgrade not supported",
        message: "Use polling transport initially",
      });
    }

    // Forward the request to the FastAPI server
    const requestHeaders: Record<string, string> = {};

    // Copy headers, excluding problematic ones
    Object.entries(req.headers).forEach(([key, value]) => {
      if (key !== "host" && value && typeof value === "string") {
        requestHeaders[key] = value;
      }
    });

    const requestBody =
      req.method !== "GET" && req.method !== "HEAD" && req.body
        ? JSON.stringify(req.body)
        : null;

    const response = await fetch(targetUrl, {
      method: req.method || "GET",
      headers: requestHeaders,
      body: requestBody,
    });

    // Copy response headers
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    // Set status and send response
    res.status(response.status);

    if (response.headers.get("content-type")?.includes("application/json")) {
      const data = await response.json();
      res.json(data);
    } else {
      const text = await response.text();
      res.send(text);
    }

    logInfo("[SocketIO-proxy] Request proxied successfully", {
      status: response.status,
      contentType: response.headers.get("content-type"),
    });
  } catch (error) {
    logError("[SocketIO-proxy] Proxy error:", error);
    res.status(500).json({
      error: "Proxy error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};
