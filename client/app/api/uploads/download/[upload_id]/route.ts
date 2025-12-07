import { INTERNAL_HTTP_BASE } from "@/lib/api/config";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ upload_id: string }> },
) {
  try {
    const { upload_id } = await params;
    const response = await fetch(
      `${INTERNAL_HTTP_BASE}/api/v3/uploads/download/${upload_id}`,
      {
        method: "GET",
        headers: {
          // Forward any auth headers if needed
          Cookie: request.headers.get("cookie") || "",
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: errorText || "Failed to download upload" },
        { status: response.status },
      );
    }

    // Get content type and disposition from backend
    const contentType =
      response.headers.get("content-type") || "application/octet-stream";
    const contentDisposition = response.headers.get("content-disposition");

    // Stream the file back to the client
    const fileBuffer = await response.arrayBuffer();

    const headers = new Headers();
    headers.set("Content-Type", contentType);
    if (contentDisposition) {
      headers.set("Content-Disposition", contentDisposition);
    }

    return new NextResponse(fileBuffer, {
      status: 200,
      headers,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
