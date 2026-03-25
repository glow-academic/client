import { INTERNAL_HTTP_BASE } from "@/lib/api/config";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ upload_id: string }> },
) {
  try {
    const { upload_id } = await params;
    const endpoint = `${INTERNAL_HTTP_BASE}/v5/scenarios/preview/${upload_id}`;

    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Cookie: request.headers.get("cookie") || "",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: errorText || "Failed to generate preview" },
        { status: response.status },
      );
    }

    const contentType =
      response.headers.get("content-type") || "image/png";

    const responseHeaders = new Headers();
    responseHeaders.set("Content-Type", contentType);
    responseHeaders.set("Cache-Control", "private, max-age=3600, must-revalidate");

    if (response.body) {
      return new NextResponse(response.body, {
        status: 200,
        headers: responseHeaders,
      });
    }

    const buffer = await response.arrayBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
