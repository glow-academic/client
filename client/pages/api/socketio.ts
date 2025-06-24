/**
 * pages/api/socketio.ts
 * Simple Socket.IO proxy without routing conflicts
 */

import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Simple test first
    const targetUrl =
      "http://localhost:8000/socket.io/" +
      (req.url?.replace("/api/socketio", "") || "");

    const response = await fetch(targetUrl, {
      method: req.method || "GET",
      headers: {
        "user-agent": req.headers["user-agent"] || "",
      },
    });

    const text = await response.text();
    res.status(response.status).send(text);
  } catch (error) {
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
