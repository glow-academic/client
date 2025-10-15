/**
 * app/api/v2/documents/upload/[upload_id]/route.ts
 *
 * Handles TUS requests with specific upload IDs
 * Proxies to FastAPI backend at /api/v2/documents/upload/{upload_id}
 */

import { getApiBase } from "@/lib/api-base";
import { log } from "@/lib/api/v2/server/logs";
import type { NextRequest } from "next/server";

// Helper function to handle proxy requests using fetch
async function handleProxyRequest(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ upload_id: string }>;
  }
) {
  try {
    const { upload_id } = await params;
    const url = new URL(req.url);
    const targetUrl = `${getApiBase()}/api/v2/documents/upload/${upload_id}${url.search}`;

    await log.info("upload.tus.proxy", {
      message: `${req.method} ${url.pathname} -> ${targetUrl}`,
      subject: { entityType: "upload", entityId: upload_id },
      context: {
        function: "handleProxyRequest",
        file: "app/api/v2/documents/upload/[upload_id]/route.ts",
      },
    });

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
    await log.error("upload.tus.proxy.error", {
      message: "TUS proxy error",
      subject: { entityType: "upload" },
      context: {
        function: "handleProxyRequest",
        file: "app/api/v2/documents/upload/[upload_id]/route.ts",
      },
      error,
    });
    return new Response("Proxy Error", { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ upload_id: string }> }
) {
  return handleProxyRequest(req, { params });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ upload_id: string }> }
) {
  return handleProxyRequest(req, { params });
}

export async function HEAD(
  req: NextRequest,
  { params }: { params: Promise<{ upload_id: string }> }
) {
  return handleProxyRequest(req, { params });
}

export async function OPTIONS(
  req: NextRequest,
  { params }: { params: Promise<{ upload_id: string }> }
) {
  return handleProxyRequest(req, { params });
}

/* App-router specific tweaks */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
