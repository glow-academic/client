import { INTERNAL_HTTP_BASE } from "@/lib/api/config";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ upload_id: string }> },
) {
  try {
    const { upload_id } = await params;
    // Extract preview query parameter
    const { searchParams } = new URL(request.url);
    const preview = searchParams.get("preview") === "true";

    // Build URL with preview parameter if present
    const url = new URL(
      `${INTERNAL_HTTP_BASE}/api/v4/uploads/get/${upload_id}`,
    );
    if (preview) {
      url.searchParams.set("preview", "true");
    }

    // Build headers - forward Range header for video seeking support
    const headers: HeadersInit = {
      Cookie: request.headers.get("cookie") || "",
    };

    // Forward Range header if present (enables video seeking)
    const rangeHeader = request.headers.get("range");
    if (rangeHeader) {
      headers["Range"] = rangeHeader;
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers,
    });

    if (!response.ok && response.status !== 206) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: errorText || "Failed to download upload" },
        { status: response.status },
      );
    }

    // Get headers from backend
    const contentType =
      response.headers.get("content-type") || "application/octet-stream";
    const contentDisposition = response.headers.get("content-disposition");
    const acceptRanges = response.headers.get("accept-ranges");
    const contentRange = response.headers.get("content-range");
    const contentLength = response.headers.get("content-length");

    // Build response headers
    const responseHeaders = new Headers();
    responseHeaders.set("Content-Type", contentType);
    if (contentDisposition) {
      responseHeaders.set("Content-Disposition", contentDisposition);
    }
    if (acceptRanges) {
      responseHeaders.set("Accept-Ranges", acceptRanges);
    }
    if (contentRange) {
      responseHeaders.set("Content-Range", contentRange);
    }
    if (contentLength) {
      responseHeaders.set("Content-Length", contentLength);
    }

    // Stream the response body directly without buffering
    // This enables seeking for large video files
    if (response.body) {
      return new NextResponse(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    // Fallback for responses without body stream
    const fileBuffer = await response.arrayBuffer();
    return new NextResponse(fileBuffer, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
