import { INTERNAL_HTTP_BASE } from "@/lib/api/config";
import { NextRequest, NextResponse } from "next/server";

const VALID_MODALITIES = new Set(["file", "image", "text"]);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ modality: string; upload_id: string }> },
) {
  try {
    const { modality, upload_id } = await params;

    if (!VALID_MODALITIES.has(modality)) {
      return NextResponse.json(
        { error: `Invalid modality: ${modality}` },
        { status: 400 },
      );
    }

    const { searchParams } = new URL(request.url);
    const preview = searchParams.get("preview") === "true";

    // Route to preview or download endpoint based on query param
    const action = preview && modality === "file" ? "preview" : "download";
    const endpoint = `${INTERNAL_HTTP_BASE}/api/v5/artifacts/documents/${modality}/${upload_id}/${action}`;

    const headers: HeadersInit = {
      Cookie: request.headers.get("cookie") || "",
    };

    const rangeHeader = request.headers.get("range");
    if (rangeHeader) {
      headers["Range"] = rangeHeader;
    }

    const response = await fetch(endpoint, {
      method: "GET",
      headers,
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
