import { INTERNAL_HTTP_BASE } from "@/lib/api/config";
import { NextRequest, NextResponse } from "next/server";

export async function OPTIONS(
  request: NextRequest,
  { params }: { params: Promise<{ upload_id: string }> },
) {
  try {
    const { upload_id } = await params;
    const response = await fetch(
      `${INTERNAL_HTTP_BASE}/api/v4/uploads/discover/${upload_id}`,
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

export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ upload_id: string }> },
) {
  try {
    const { upload_id } = await params;
    const response = await fetch(
      `${INTERNAL_HTTP_BASE}/api/v4/uploads/${upload_id}/status`,
      {
        method: "HEAD",
        headers: {
          "Tus-Resumable": request.headers.get("Tus-Resumable") || "1.0.0",
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ upload_id: string }> },
) {
  try {
    const { upload_id } = await params;

    const tusHeaders: HeadersInit = {
      "Content-Type": "application/offset+octet-stream",
    };
    const tusHeaderNames = ["Tus-Resumable", "Upload-Offset"];

    tusHeaderNames.forEach((headerName) => {
      const value = request.headers.get(headerName);
      if (value) {
        tusHeaders[headerName] = value;
      }
    });

    const body = await request.arrayBuffer();

    const response = await fetch(
      `${INTERNAL_HTTP_BASE}/api/v4/uploads/${upload_id}/chunk`,
      {
        method: "PATCH",
        headers: tusHeaders,
        body,
      },
    );

    const headers = new Headers();
    response.headers.forEach((value, key) => {
      headers.set(key, value);
    });

    const responseBody = response.status === 204 ? null : await response.text();

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
