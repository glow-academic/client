import { INTERNAL_HTTP_BASE } from "@/lib/api/config";
import { NextRequest, NextResponse } from "next/server";

export async function OPTIONS(
  request: NextRequest,
  { params }: { params: Promise<{ upload_id: string }> }
) {
  // Proxy TUS OPTIONS request for specific upload
  try {
    const { upload_id } = await params;
    const response = await fetch(`${INTERNAL_HTTP_BASE}/upload/${upload_id}`, {
      method: "OPTIONS",
      headers: {
        "Tus-Resumable": request.headers.get("Tus-Resumable") || "1.0.0",
        "Tus-Version": request.headers.get("Tus-Version") || "1.0.0",
      },
    });

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

export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ upload_id: string }> }
) {
  // Proxy TUS HEAD request to backend
  try {
    const { upload_id } = await params;

    // Get all TUS headers
    const tusHeaders: HeadersInit = {};
    const tusHeaderNames = ["Tus-Resumable"];

    tusHeaderNames.forEach((headerName) => {
      const value = request.headers.get(headerName);
      if (value) {
        tusHeaders[headerName] = value;
      }
    });

    const response = await fetch(`${INTERNAL_HTTP_BASE}/upload/${upload_id}`, {
      method: "HEAD",
      headers: tusHeaders,
    });

    // Forward all TUS response headers
    const headers = new Headers();
    response.headers.forEach((value, key) => {
      headers.set(key, value);
    });

    // TUS HEAD responses typically don't have a body
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ upload_id: string }> }
) {
  // Proxy TUS PATCH request to upload chunk
  try {
    const { upload_id } = await params;

    // Get all TUS headers
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

    // Get chunk data
    const body = await request.arrayBuffer();

    const response = await fetch(`${INTERNAL_HTTP_BASE}/upload/${upload_id}`, {
      method: "PATCH",
      headers: tusHeaders,
      body,
    });

    // Forward all TUS response headers
    const headers = new Headers();
    response.headers.forEach((value, key) => {
      headers.set(key, value);
    });

    // TUS PATCH responses typically don't have a body
    const responseBody = response.status === 204 ? null : await response.text();

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

