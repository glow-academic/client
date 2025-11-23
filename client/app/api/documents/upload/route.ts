import { INTERNAL_HTTP_BASE } from "@/lib/api/config";
import { NextRequest, NextResponse } from "next/server";

export async function OPTIONS(request: NextRequest) {
  // Proxy TUS OPTIONS request to backend
  try {
    const response = await fetch(
      `${INTERNAL_HTTP_BASE}/upload`,
      {
        method: "OPTIONS",
        headers: {
          "Tus-Resumable": request.headers.get("Tus-Resumable") || "1.0.0",
          "Tus-Version": request.headers.get("Tus-Version") || "1.0.0",
        },
      }
    );

    // Forward all TUS headers
    const headers = new Headers();
    response.headers.forEach((value, key) => {
      headers.set(key, value);
    });

    return new NextResponse(null, {
      status: response.status,
      headers,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Proxy TUS POST request to backend
  try {
    // Get all TUS headers
    const tusHeaders: HeadersInit = {};
    const tusHeaderNames = [
      "Tus-Resumable",
      "Upload-Length",
      "Upload-Metadata",
      "Content-Length",
    ];

    tusHeaderNames.forEach((headerName) => {
      const value = request.headers.get(headerName);
      if (value) {
        tusHeaders[headerName] = value;
      }
    });

    // Get request body if present (for creation-with-upload)
    const body =
      request.headers.get("Content-Length") !== "0"
        ? await request.arrayBuffer()
        : null;

    const response = await fetch(
      `${INTERNAL_HTTP_BASE}/upload`,
      {
        method: "POST",
        headers: tusHeaders,
        body: body || null,
      }
    );

    // Forward all TUS response headers, but rewrite Location to use BFF route
    const headers = new Headers();
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === "location") {
        // Rewrite backend location to BFF location
        // Handle both with and without app prefix: /upload/... or /prefix/upload/...
        const location = value.replace(
          /\/upload\//,
          "/api/documents/upload/"
        );
        headers.set(key, location);
      } else {
        headers.set(key, value);
      }
    });

    // TUS responses typically don't have a body, but handle it if present
    const responseBody = response.status === 201 ? null : await response.text();

    return new NextResponse(responseBody, {
      status: response.status,
      headers,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
