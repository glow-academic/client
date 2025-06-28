/**
 * app/api/upload/[upload_id]/route.ts
 *
 * Handles TUS requests with specific upload IDs
 * Proxies to FastAPI backend at /documents/tus/{upload_id}
 */

import { logError, logInfo } from "@/utils/logger";
import { getApiUrl } from "@/utils/api/url";
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
    const apiUrl = await getApiUrl();
    const targetUrl = `${apiUrl}/documents/tus/${upload_id}${url.search}`;

    logInfo(`[TUS proxy] ${req.method} ${url.pathname} -> ${targetUrl}`);

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
    logError(
      "[TUS proxy] Error:",
      error instanceof Error ? error.message : "Unknown error"
    );
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
