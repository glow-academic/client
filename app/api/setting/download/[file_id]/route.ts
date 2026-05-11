import { getAuthHeaders } from "@/lib/api/auth-headers";
import { INTERNAL_HTTP_BASE } from "@/lib/api/config";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ file_id: string }> },
) {
  try {
    const { file_id } = await params;
    const endpoint = `${INTERNAL_HTTP_BASE}/setting/file/download`;

    const authHeaders = await getAuthHeaders();
    const headers: HeadersInit = {
      ...authHeaders,
      "Content-Type": "application/json",
      Cookie: request.headers.get("cookie") || "",
    };

    const rangeHeader = request.headers.get("range");
    if (rangeHeader) {
      headers["Range"] = rangeHeader;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ file_id }),
    });

    if (!response.ok && response.status !== 206) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: errorText || "Failed to download file" },
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

    if (response.body) {
      return new NextResponse(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    }

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
