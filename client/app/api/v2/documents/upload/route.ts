/**
 * app/api/v2/documents/upload/route.ts
 *
 * Streams every TUS request (POST / PATCH / HEAD / OPTIONS)
 * to the internal FastAPI service at /api/v2/documents/upload
 */

import { getApiBase } from "@/lib/api-base";
import { log } from "@/lib/api/v2/server/logs";
import type { NextRequest } from "next/server";

// Helper function to handle proxy requests using fetch
async function handleProxyRequest(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const targetUrl = `${getApiBase()}/api/v2/documents/upload${url.search}`;

    // Prepare fetch options
    const fetchOptions: RequestInit = {
      method: req.method,
      headers: Object.fromEntries(req.headers.entries()),
    };

    // Add body and duplex option for requests that have a body
    if (req.method === "POST" || req.method === "PATCH") {
      fetchOptions.body = req.body;
      // @ts-expect-error - duplex is required for streaming bodies in Node.js fetch
      fetchOptions.duplex = "half";
    }

    // Forward the request to FastAPI
    const response = await fetch(targetUrl, fetchOptions);

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
    log.error("upload.tus.proxy.error", {
      message: "[TUS proxy] Error",
      error: error instanceof Error ? error : String(error),
      context: { function: "handleProxyRequest" },
    });
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
