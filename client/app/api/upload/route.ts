/**
 * app/api/upload/route.ts
 *
 * Streams every TUS request (POST / PATCH / HEAD / OPTIONS)
 * to the internal FastAPI service running at ws://fastapi:8000/documents/tus
 * without exposing that host to the public internet.
 */

import { getApiUrl } from "@/lib/utils";
import { logError } from "@/utils/logger";
import type { NextRequest } from "next/server";

// Helper function to handle proxy requests using fetch
async function handleProxyRequest(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const targetUrl = `${getApiUrl()}/documents/tus${url.pathname.replace("/api/upload", "")}${url.search}`;

    // Forward the request to FastAPI
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: Object.fromEntries(req.headers.entries()),
      body: req.body,
    });

    // Create response with same status, headers, and body
    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      responseHeaders.set(key, value);
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    logError(
      "[TUS proxy] Error:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return new Response("Proxy Error", { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return handleProxyRequest(req);
}

export async function PATCH(req: NextRequest) {
  return handleProxyRequest(req);
}

export async function HEAD(req: NextRequest) {
  return handleProxyRequest(req);
}

export async function OPTIONS(req: NextRequest) {
  return handleProxyRequest(req);
}

/* App-router specific tweaks */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
