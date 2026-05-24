/**
 * BFF multipart proxy for scenario video uploads.
 *
 * The FE wraps a chosen video File in a ``FormData`` and POSTs here.
 * We forward the multipart body upstream to ``POST /scenario/video_upload``
 * with the user's auth headers attached server-side (so the JWT never
 * reaches the browser).
 *
 * Upstream returns ``{ video_id, upload_id, idempotency_key }``. We
 * pass it straight back as JSON.
 *
 * Modeled on ``app/api/attempt/audio_upload/route.ts`` — same shape,
 * different upstream target. Image sibling is at
 * ``app/api/scenario/image_upload/route.ts``.
 */

import { getAuthHeaders } from "@/lib/api/auth-headers";
import { INTERNAL_HTTP_BASE } from "@/lib/api/config";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const authHeaders = await getAuthHeaders();

    // Re-parse the incoming multipart and re-emit it as a fresh
    // FormData so the upstream fetch builds its own boundary +
    // Content-Type. Re-using the inbound body stream verbatim works in
    // some runtimes but breaks Edge — round-tripping through
    // ``request.formData()`` is the portable shape.
    const inbound = await request.formData();
    const outbound = new FormData();
    inbound.forEach((value, key) => {
      outbound.append(key, value as Blob | string);
    });

    const response = await fetch(`${INTERNAL_HTTP_BASE}/scenario/video_upload`, {
      method: "POST",
      // Do NOT set Content-Type — let fetch generate the multipart
      // boundary automatically. Forwarding the inbound boundary header
      // would mismatch the new FormData body.
      headers: { ...authHeaders },
      body: outbound,
    });

    const contentType = response.headers.get("content-type") || "application/json";
    const body = await response.text();
    if (!response.ok) {
      return new NextResponse(body || "Video upload failed", {
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
