/**
 * app/api/download/report/[profileId]/route.ts
 * Server-side API route for downloading TA reports as PDF
 * Proxies requests to FastAPI backend while preserving server context
 */

import { getApiUrl } from "@/lib/utils";
import { logError, logInfo } from "@/utils/logger";
import type { NextRequest } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  try {
    const { profileId } = await params;
    const { searchParams } = new URL(req.url);

    logInfo(`Downloading report for profile ${profileId}`, {
      profileId,
      searchParams: Object.fromEntries(searchParams.entries()),
    });

    // Build query parameters from the request
    const queryParams = new URLSearchParams();

    // Extract report options from search params
    const reportOptions = [
      "includeStudentTypeChart",
      "includePerformanceChart",
      "includeRadarChart",
      "includeTimeChart",
      "includeDetailedScores",
      "includeFeedback",
    ];

    reportOptions.forEach((option) => {
      const value = searchParams.get(option);
      if (value !== null) {
        queryParams.set(option, value);
      }
    });

    const url = `${getApiUrl()}/profiles/${profileId}${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;

    // Forward the request to FastAPI backend
    const response = await fetch(url, {
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
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = {};
      }

      const errorMessage =
        errorData.message ||
        `Failed to download report: ${response.status} ${response.statusText}`;
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

    // Extract filename from Content-Disposition header
    const contentDisposition = response.headers.get("content-disposition");
    const filename = contentDisposition
      ? contentDisposition.split("filename=")[1]?.replace(/"/g, "") ||
        `TA_Report_${profileId}.pdf`
      : `TA_Report_${profileId}.pdf`;

    const contentType =
      response.headers.get("content-type") || "application/pdf";
    const contentLength = response.headers.get("content-length");

    logInfo(`Report downloaded successfully for profile ${profileId}`, {
      profileId,
      filename,
      contentType,
      contentLength,
    });

    // Create response headers
    const responseHeaders = new Headers();
    responseHeaders.set("Content-Type", contentType);
    responseHeaders.set(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );

    if (contentLength) {
      responseHeaders.set("Content-Length", contentLength);
    }

    // Add CORS headers if needed
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Methods", "GET");

    // Return the PDF content directly
    return new Response(response.body, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    const errorMessage = `Error downloading report: ${error instanceof Error ? error.message : "Unknown error"}`;
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
