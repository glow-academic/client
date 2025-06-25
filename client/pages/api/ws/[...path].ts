/**
 * pages/api/ws/[...path].ts
 * Catch-all Socket.IO proxy for Pages Router in hybrid Next.js setup
 * Proxies Socket.IO connections to FastAPI backend
 */

import { getApiUrl } from "@/lib/utils";
import { logError, logInfo } from "@/utils/logger";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { path } = req.query;
  const pathSegments = Array.isArray(path) ? path : [path];
  const originalUrl = req.url || "";

  // Reconstruct the Socket.IO path
  // /api/ws/socket.io/... -> /socket.io/...
  let targetPath: string;

  if (pathSegments[0] === "socket.io") {
    // This is a Socket.IO request
    targetPath = "/" + pathSegments.join("/");

    // Preserve query parameters
    const queryString = originalUrl.includes("?")
      ? originalUrl.split("?")[1]
      : "";
    if (queryString) {
      targetPath += "?" + queryString;
    }
  } else {
    // Fallback to root Socket.IO path
    targetPath = "/socket.io/";
  }

  const targetUrl = `${getApiUrl()}${targetPath}`;

  logInfo("[SocketIO-proxy] Proxying request", {
    method: req.method,
    originalUrl,
    pathSegments,
    targetPath,
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

    // Ensure proper content-type for Socket.IO requests
    if (!requestHeaders["content-type"] && req.method === "POST") {
      requestHeaders["content-type"] = "text/plain";
    }

    // Handle request body properly
    let requestBody = null;
    if (req.method === "POST" && req.body) {
      if (typeof req.body === "string") {
        requestBody = req.body;
      } else if (Buffer.isBuffer(req.body)) {
        requestBody = req.body;
      } else {
        requestBody = JSON.stringify(req.body);
      }
    }

    const response = await fetch(targetUrl, {
      method: req.method || "GET",
      headers: requestHeaders,
      body: requestBody,
      // Increase timeout for Socket.IO connections
      signal: AbortSignal.timeout(30000),
    });

    // Copy response headers, excluding problematic ones
    response.headers.forEach((value, key) => {
      // Skip headers that can cause conflicts
      if (
        key.toLowerCase() !== "content-length" &&
        key.toLowerCase() !== "transfer-encoding" &&
        key.toLowerCase() !== "connection"
      ) {
        res.setHeader(key, value);
      }
    });

    // Set status and send response
    res.status(response.status);

    // Get response body as buffer to handle binary data properly
    const responseData = await response.arrayBuffer();
    const buffer = Buffer.from(responseData);

    // Send the raw response data
    res.send(buffer);

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
    bodyParser: {
      sizeLimit: "1mb",
    },
    externalResolver: true,
    responseLimit: false,
  },
};
