import { API_VERSION, INTERNAL_HTTP_BASE } from "@/lib/api/config";
import { toFull } from "@/lib/api/path";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Use typed path from api client for type safety
    const typedPath = toFull(API_VERSION, "/documents/certificate");

    // For binary responses (PDF), we need fetch directly
    // api.post would try to parse as JSON/text which fails for binary
    const response = await fetch(`${INTERNAL_HTTP_BASE}${typedPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: request.headers.get("cookie") || "",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        error: "Failed to generate certificate",
      }));
      return NextResponse.json(errorData, { status: response.status });
    }

    // Get content type and disposition from backend
    const contentType =
      response.headers.get("content-type") || "application/pdf";
    const contentDisposition = response.headers.get("content-disposition");

    // Stream the PDF back to the client
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
