import { getAuthHeaders } from "@/lib/api/auth-headers";
import { INTERNAL_HTTP_BASE } from "@/lib/api/config";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> },
) {
  try {
    const { callId } = await params;
    const authHeaders = await getAuthHeaders();

    const response = await fetch(`${INTERNAL_HTTP_BASE}/department/call_download`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ call_id: callId }),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: (await response.text()) || "Failed to fetch call" },
        { status: response.status },
      );
    }

    const headers = new Headers();
    const contentType =
      response.headers.get("content-type") || "application/octet-stream";
    headers.set("Content-Type", contentType);
    const cd = response.headers.get("content-disposition");
    if (cd) headers.set("Content-Disposition", cd);
    const cl = response.headers.get("content-length");
    if (cl) headers.set("Content-Length", cl);

    return new NextResponse(response.body, { status: 200, headers });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
