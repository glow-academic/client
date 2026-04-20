import { getAuthHeaders } from "@/lib/api/auth-headers";
import { INTERNAL_HTTP_BASE } from "@/lib/api/config";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> },
) {
  try {
    const { videoId } = await params;
    const authHeaders = await getAuthHeaders();

    const rangeHeader = request.headers.get("range");
    const forwardHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...authHeaders,
    };
    if (rangeHeader) forwardHeaders["Range"] = rangeHeader;

    const response = await fetch(`${INTERNAL_HTTP_BASE}/system/video/download`, {
      method: "POST",
      headers: forwardHeaders,
      body: JSON.stringify({ video_id: videoId }),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: (await response.text()) || "Failed to fetch video" },
        { status: response.status },
      );
    }

    const responseHeaders = new Headers();
    const contentType =
      response.headers.get("content-type") || "application/octet-stream";
    responseHeaders.set("Content-Type", contentType);

    const cd = response.headers.get("content-disposition");
    if (cd) responseHeaders.set("Content-Disposition", cd);
    const cl = response.headers.get("content-length");
    if (cl) responseHeaders.set("Content-Length", cl);
    const ar = response.headers.get("accept-ranges");
    if (ar) responseHeaders.set("Accept-Ranges", ar);
    const cr = response.headers.get("content-range");
    if (cr) responseHeaders.set("Content-Range", cr);

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
