import { INTERNAL_HTTP_BASE } from "@/lib/api/config";
import { NextRequest, NextResponse } from "next/server";

export async function OPTIONS(request: NextRequest) {
  try {
    const response = await fetch(
      `${INTERNAL_HTTP_BASE}/uploads/discover`,
      {
        method: "OPTIONS",
        headers: {
          "Tus-Resumable": request.headers.get("Tus-Resumable") || "1.0.0",
          "Tus-Version": request.headers.get("Tus-Version") || "1.0.0",
        },
      },
    );

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
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
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

    const body =
      request.headers.get("Content-Length") !== "0"
        ? await request.arrayBuffer()
        : null;

    const response = await fetch(
      `${INTERNAL_HTTP_BASE}/uploads/create`,
      {
        method: "POST",
        headers: tusHeaders,
        body: body || null,
      },
    );

    const headers = new Headers();
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === "location") {
        // Rewrite backend location to BFF location
        const location = value.replace(/\/uploads\//, "/api/uploads/");
        headers.set(key, location);
      } else {
        headers.set(key, value);
      }
    });

    const responseBody = response.status === 201 ? null : await response.text();

    return new NextResponse(responseBody, {
      status: response.status,
      headers,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
