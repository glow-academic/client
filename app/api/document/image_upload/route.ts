/**
 * BFF multipart proxy for document image uploads.
 *
 * The FE wraps a chosen image File in a ``FormData`` and POSTs here.
 * We forward the multipart body upstream to ``POST /document/image_upload``
 * with the user's auth headers attached server-side (so the JWT never
 * reaches the browser).
 *
 * Upstream returns ``{ image_id, upload_id, idempotency_key }``. We
 * pass it straight back as JSON.
 *
 * Modeled on ``app/api/attempt/audio_upload/route.ts`` — same shape,
 * different upstream target. Sibling routes:
 * ``app/api/document/file_upload/route.ts``,
 * ``app/api/scenario/image_upload/route.ts``.
 */

import { getAuthHeaders } from "@/lib/api/auth-headers";
import { INTERNAL_HTTP_BASE } from "@/lib/api/config";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const authHeaders = await getAuthHeaders();

    const inbound = await request.formData();
    const outbound = new FormData();
    inbound.forEach((value, key) => {
      outbound.append(key, value as Blob | string);
    });

    const response = await fetch(`${INTERNAL_HTTP_BASE}/document/image_upload`, {
      method: "POST",
      headers: { ...authHeaders },
      body: outbound,
    });

    const contentType = response.headers.get("content-type") || "application/json";
    const body = await response.text();
    if (!response.ok) {
      return new NextResponse(body || "Image upload failed", {
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
