/**
 * app/api/download/csv/token/[tokenId]/route.ts
 * Server-side API route for downloading csv
 * Proxies requests to FastAPI backend while preserving server context
 */

import { getApiBase } from "@/lib/api-base";
import { logError, logInfo } from "@/utils/logger";
import type { NextRequest } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tokenId: string }> }
) {
  try {
    const { tokenId } = await params;

    logInfo(`Downloading csv ${tokenId}`, { tokenId });

    // Forward the request to FastAPI backend
    const response = await fetch(`${getApiBase()}/csv/token/${tokenId}`, {
      method: "GET",
      headers: {
        // Forward relevant headers from the original request
        ...Object.fromEntries(
          [...req.headers.entries()].filter(([key]) =>
            ["authorization", "cookie", "user-agent"].includes(
              key.toLowerCase()
            )
          )
        ),
      },
    });

    if (!response.ok) {
      const errorMessage = `Failed to download csv ${tokenId}: ${response.status} ${response.statusText}`;
      logError(errorMessage);

      return new Response(
        JSON.stringify({
          success: false,
          message: errorMessage,
          status: "error",
        }),
        {
          status: response.status,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Get content type and other headers from the backend response
    const contentType =
      response.headers.get("content-type") || "application/octet-stream";
    const contentDisposition = response.headers.get("content-disposition");
    const contentLength = response.headers.get("content-length");

    logInfo(`CSV ${tokenId} downloaded successfully`, {
      tokenId,
      contentType,
      contentLength,
    });

    // Create response headers
    const responseHeaders = new Headers();
    responseHeaders.set("Content-Type", contentType);

    if (contentDisposition) {
      responseHeaders.set("Content-Disposition", contentDisposition);
    }

    if (contentLength) {
      responseHeaders.set("Content-Length", contentLength);
    }

    // Add CORS headers if needed
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Methods", "GET");

    // Return the file content directly
    return new Response(response.body, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    const errorMessage = `Error downloading csv: ${error instanceof Error ? error.message : "Unknown error"}`;
    logError(errorMessage, error);

    return new Response(
      JSON.stringify({
        success: false,
        message: errorMessage,
        status: "error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}

// Add OPTIONS for CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

/* App-router specific tweaks */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
