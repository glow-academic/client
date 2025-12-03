import { INTERNAL_HTTP_BASE } from "@/lib/api/config";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ upload_id: string }> }
) {
  // Proxy finalize upload request to backend
  try {
    const { upload_id } = await params;

    // Get request body (should be empty object {} based on current usage)
    const body = await request.json().catch(() => ({}));

    const response = await fetch(
      `${INTERNAL_HTTP_BASE}/api/v3/uploads/upload/${upload_id}/finalize`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    // Parse JSON response
    const responseData = await response.json();

    // Forward response headers (especially cache invalidation headers)
    const headers = new Headers();
    response.headers.forEach((value, key) => {
      headers.set(key, value);
    });

    return NextResponse.json(responseData, {
      status: response.status,
      headers,
    });
  } catch (error) {
    return NextResponse.json(
      { 
        error: "Internal server error", 
        message: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    );
  }
}

