/**
 * pages/api/ws/socket.io/[...path].ts
 * Catch-all route for Socket.IO client requests with custom path
 */

import type { NextApiRequest, NextApiResponse } from "next";
import handler from "../../ws";

export default function socketIOCatchAll(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // The request comes as /api/ws/socket.io/...
  // We need to rewrite it to look like /api/ws/...
  const originalUrl = req.url || "";
  req.url = originalUrl.replace("/socket.io", "");

  // Forward to the main WebSocket handler
  return handler(req, res);
}

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};
