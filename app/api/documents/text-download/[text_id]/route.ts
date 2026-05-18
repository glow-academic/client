import { getAuthHeaders } from "@/lib/api/auth-headers";
import { INTERNAL_HTTP_BASE } from "@/lib/api/config";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ text_id: string }> },
) {
  try {
    const { text_id } = await params;
    const endpoint = `${INTERNAL_HTTP_BASE}/document/text_download`;

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
      body: JSON.stringify({ text_id }),
    });

    if (!response.ok && response.status !== 206) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: errorText || "Failed to download text" },
        { status: response.status },
      );
    }

    const contentType =
      response.headers.get("content-type") || "text/plain";
    const contentDisposition = response.headers.get("content-disposition");
    const contentLength = response.headers.get("content-length");

    const responseHeaders = new Headers();
    responseHeaders.set("Content-Type", contentType);
    if (contentDisposition) {
      responseHeaders.set("Content-Disposition", contentDisposition);
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
