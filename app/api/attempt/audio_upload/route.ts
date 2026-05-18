/**
 * BFF multipart proxy for attempt audio uploads.
 *
 * The browser ``MediaRecorder`` produces an audio Blob; the FE wraps
 * it in a ``FormData`` and POSTs here. We forward the multipart body
 * upstream to ``POST /attempt/audio_upload`` with the user's auth
 * headers attached server-side (so the JWT never reaches the browser).
 *
 * Upstream returns ``{ audio_id, audios_id, upload_id }``. We pass it
 * straight back as JSON — the FE only consumes ``audios_id``.
 *
 * This is the first multipart BFF in the FE; the realtime audio path
 * uploads PCM frames over the WS transport instead, not HTTP.
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

    const response = await fetch(`${INTERNAL_HTTP_BASE}/attempt/audio_upload`, {
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
      return new NextResponse(body || "Audio upload failed", {
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
