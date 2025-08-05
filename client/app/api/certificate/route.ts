/**
 * app/api/certificate/route.ts
 * Backend for Frontend (BFF) route for certificate generation
 * Proxies requests to FastAPI backend while preserving server context
 */

import { getApiBase } from "@/lib/api-base";
import { logError, logInfo } from "@/utils/logger";
import type { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    logInfo("Generating certificate", {
      profileId: body.profileId,
      profileName: body.profileName,
    });

    // Forward the request to FastAPI backend
    const response = await fetch(`${getApiBase()}/documents/certificate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Forward relevant headers from the original request
        ...Object.fromEntries(
          [...req.headers.entries()].filter(([key]) =>
            ["authorization", "cookie", "user-agent"].includes(
              key.toLowerCase()
            )
          )
        ),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorMessage = `Failed to generate certificate: ${response.status} ${response.statusText}`;
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

    // Get the file content and headers from the FastAPI response
    const fileContent = await response.arrayBuffer();
    const contentType =
      response.headers.get("content-type") || "application/pdf";
    const contentDisposition =
      response.headers.get("content-disposition") ||
      'attachment; filename="certificate.pdf"';
    const cacheControl =
      response.headers.get("cache-control") ||
      "no-cache, no-store, must-revalidate";
    const pragma = response.headers.get("pragma") || "no-cache";
    const expires = response.headers.get("expires") || "0";

    logInfo("Certificate generated successfully", {
      contentType,
      contentDisposition,
    });

    // Return the file directly as a download response
    return new Response(fileContent, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": contentDisposition,
        "Cache-Control": cacheControl,
        Pragma: pragma,
        Expires: expires,
      },
    });
  } catch (error) {
    const errorMessage = `Error generating certificate: ${error instanceof Error ? error.message : "Unknown error"}`;
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
