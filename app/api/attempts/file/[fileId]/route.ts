import { getAuthHeaders } from "@/lib/api/auth-headers";
import { INTERNAL_HTTP_BASE } from "@/lib/api/config";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  try {
    const { fileId } = await params;
    const authHeaders = await getAuthHeaders();

    const response = await fetch(`${INTERNAL_HTTP_BASE}/attempt/file/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ file_id: fileId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: errorText || "Failed to fetch file" },
        { status: response.status },
      );
    }

    const contentType =
      response.headers.get("content-type") || "application/octet-stream";
    const contentDisposition = response.headers.get("content-disposition");
    const acceptRanges = response.headers.get("accept-ranges");
    const contentRange = response.headers.get("content-range");
    const contentLength = response.headers.get("content-length");

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

    return new NextResponse(response.body, {
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
