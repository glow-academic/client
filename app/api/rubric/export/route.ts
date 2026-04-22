/**
 * BFF passthrough for POST /rubric/export on the core API.
 *
 * The core route returns a raw `application/pdf` body (base64 envelope
 * is used only on the websocket completed event). This route forwards
 * auth headers, POSTs the JSON body, and streams the PDF response back
 * to the browser with its original Content-Disposition preserved so
 * the browser's "save as" filename matches the rubric name.
 */

import { getAuthHeaders } from "@/lib/api/auth-headers";
import { INTERNAL_HTTP_BASE } from "@/lib/api/config";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const endpoint = `${INTERNAL_HTTP_BASE}/rubric/export`;

    const authHeaders = await getAuthHeaders();
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        ...authHeaders,
        "Content-Type": "application/json",
        Cookie: request.headers.get("cookie") || "",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: errorText || "Failed to generate rubric PDF" },
        { status: response.status },
      );
    }

    const contentType =
      response.headers.get("content-type") || "application/pdf";
    const contentDisposition = response.headers.get("content-disposition");

    const responseHeaders = new Headers();
    responseHeaders.set("Content-Type", contentType);
    if (contentDisposition) {
      responseHeaders.set("Content-Disposition", contentDisposition);
    }
    // PDFs are generated fresh each time — never serve a stale blob.
    responseHeaders.set(
      "Cache-Control",
      "no-cache, no-store, must-revalidate",
    );

    if (response.body) {
      return new NextResponse(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    const pdfBuffer = await response.arrayBuffer();
    return new NextResponse(pdfBuffer, {
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
