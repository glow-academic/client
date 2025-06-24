/**
 * app/api/upload/route.ts
 *
 * Streams every TUS request (POST / PATCH / HEAD / OPTIONS)
 * to the internal FastAPI service running at ws://fastapi:8000/documents/tus
 * without exposing that host to the public internet.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { createProxyServer } from 'http-proxy';
import { getApiUrl } from '@/lib/utils';
import { logError } from '@/utils/logger';

/* Singleton proxy so hot-reloads don’t leak sockets */
const proxy = createProxyServer({
  target: `${getApiUrl()}/documents/tus`,
  changeOrigin: true,     // rewrite Host header
  secure: false,          // FastAPI is plain HTTP in Docker
  selfHandleResponse: false, // let http-proxy stream everything
});

/* Optional: surface errors */
proxy.on("error", (err) => logError("[TUS proxy] ", err.message));

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // TUS uses POST, PATCH, HEAD, OPTIONS
  const { method } = req;
  if (!["POST", "PATCH", "HEAD", "OPTIONS"].includes(method ?? "")) {
    res.status(405).end("Method Not Allowed");
    return;
  }

  // Keep the original path (/api/upload) out front,
  // but forward *everything* to /documents/tus inside FastAPI.
  // No special rewrite needed; http-proxy keeps the sub-path.
  proxy.web(req, res);
}

/* App-router specific tweaks */
export const config = {
  api: { bodyParser: false, externalResolver: true },
  runtime: "nodejs",
};
export const dynamic = "force-dynamic";
