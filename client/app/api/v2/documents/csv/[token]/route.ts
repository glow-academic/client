/**
 * app/api/v2/documents/csv/[token]/route.ts
 * Server-side API route for downloading CSV files
 * Proxies requests to FastAPI backend while preserving server context
 */

import { getApiBase } from "@/lib/api-base";
import { log } from "@/utils/server-logger";
import type { NextRequest } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Parse query params for optional filename
    const { searchParams } = new URL(req.url);
    const name = searchParams.get("name");

    await log.info("download.csv.start", {
      message: `Downloading csv ${token}`,
      subject: { entityType: "csv", entityId: token },
      context: {
        function: "GET",
        file: "app/api/v2/documents/csv/[token]/route.ts",
        requestedName: name ?? undefined,
      },
    });

    // Forward the request to FastAPI backend
    const response = await fetch(
      `${getApiBase()}/api/v2/documents/csv/${token}`,
      {
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
      }
    );

    if (!response.ok) {
      const errorMessage = `Failed to download csv ${token}: ${response.status} ${response.statusText}`;
      await log.error("download.csv.failed", {
        message: errorMessage,
        subject: { entityType: "csv", entityId: token },
        context: {
          function: "GET",
          file: "app/api/v2/documents/csv/[token]/route.ts",
          status: response.status,
        },
      });

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
    const contentDispositionFromBackend = response.headers.get(
      "content-disposition"
    );
    const contentLength = response.headers.get("content-length");

    await log.info("download.csv.success", {
      message: `CSV ${token} downloaded successfully`,
      subject: { entityType: "csv", entityId: token },
      context: {
        function: "GET",
        file: "app/api/v2/documents/csv/[token]/route.ts",
        contentType,
        contentLength,
        usedName: name ?? undefined,
        backendContentDisposition: contentDispositionFromBackend ?? undefined,
      },
    });

    // Create response headers
    const responseHeaders = new Headers();
    responseHeaders.set("Content-Type", contentType);

    // Set Content-Disposition based on query param or backend header
    if (name) {
      // Properly encode filename for HTTP headers to handle Unicode characters
      const encodedName = encodeURIComponent(name);
      responseHeaders.set(
        "Content-Disposition",
        `attachment; filename="${encodedName}.csv"; filename*=UTF-8''${encodedName}.csv`
      );
    } else if (contentDispositionFromBackend) {
      responseHeaders.set("Content-Disposition", contentDispositionFromBackend);
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
    await log.error("download.csv.error", {
      message: errorMessage,
      subject: { entityType: "csv" },
      context: {
        function: "GET",
        file: "app/api/v2/documents/csv/[token]/route.ts",
      },
      error,
    });

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
