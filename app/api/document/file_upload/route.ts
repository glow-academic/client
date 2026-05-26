/**
 * BFF multipart proxy for document file uploads.
 *
 * The FE wraps a chosen File in a FormData and POSTs here. We forward
 * the multipart body upstream to ``POST /document/file_upload`` with
 * the user's auth headers attached server-side (so the JWT never
 * reaches the browser).
 *
 * Upstream returns ``{ file_id, upload_id, idempotency_key }``. We
 * pass it back as JSON.
 *
 * Modeled on ``app/api/attempt/audio_upload/route.ts`` — same shape,
 * different upstream target. Scenario siblings:
 * ``app/api/scenario/{image,video}_upload/route.ts``.
 */

import { getAuthHeaders } from "@/lib/api/auth-headers";
import { INTERNAL_HTTP_BASE } from "@/lib/api/config";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const authHeaders = await getAuthHeaders();

    // Re-parse incoming multipart and re-emit as fresh FormData so the
    // upstream fetch builds its own boundary + Content-Type.
    const inbound = await request.formData();
    const outbound = new FormData();
    inbound.forEach((value, key) => {
      outbound.append(key, value as Blob | string);
    });

    const response = await fetch(`${INTERNAL_HTTP_BASE}/document/file_upload`, {
      method: "POST",
      headers: { ...authHeaders },
      body: outbound,
    });

    const contentType = response.headers.get("content-type") || "application/json";
    const body = await response.text();
    if (!response.ok) {
      return new NextResponse(body || "File upload failed", {
        status: response.status,
        headers: { "Content-Type": contentType },
      });
    }
    return new NextResponse(body, {
      status: 200,
      headers: { "Content-Type": contentType },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
