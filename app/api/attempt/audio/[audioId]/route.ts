/**
 * BFF audio download for attempts.
 *
 * GET ``/api/attempt/audio/{audioId}`` proxies to upstream
 * ``POST /attempt/audio_download``. ``audioId`` may be either an
 * audios_entry id or an audios_resource id — the impl reconciles both
 * (chat MV surfaces ``audios_id`` (resource) on user messages, so the
 * audio bubble's playback URL will typically use the resource id).
 *
 * Mirrors ``app/api/system/audio/[audioId]/route.ts`` but artifact-
 * scoped so the upstream audit emits ``attempt.audio_download.*``
 * events, and any access policy lives on the artifact route.
 */

import { getAuthHeaders } from "@/lib/api/auth-headers";
import { INTERNAL_HTTP_BASE } from "@/lib/api/config";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ audioId: string }> },
) {
  try {
    const { audioId } = await params;
    const authHeaders = await getAuthHeaders();

    const response = await fetch(`${INTERNAL_HTTP_BASE}/attempt/audio_download`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ audio_id: audioId }),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: (await response.text()) || "Failed to fetch audio" },
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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
