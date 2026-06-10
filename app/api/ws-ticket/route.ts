/**
 * BFF WS-ticket endpoint — hands the browser the API bearer for the two
 * legitimate client-side credential needs that cannot use a same-origin
 * server proxy: the Socket.IO handshake (`auth.token`) and the OIDC
 * logout `id_token_hint`.
 *
 * Why this exists:
 *   The raw bearer (`id_token`) is deliberately kept OUT of the NextAuth
 *   `session()` output, so it is no longer broadly JS-readable app-wide
 *   via `/api/auth/session` / client props. This route is the narrow,
 *   intentional, cookie-authenticated path the client uses to obtain the
 *   bearer right before it needs it — instead of holding it for the whole
 *   session lifetime.
 *
 * Auth: the caller is authenticated purely by the httpOnly session cookie
 *   (read server-side via `getServerIdToken`). No session cookie → 401.
 *
 * BACKLOG (residual): ideally the API would mint a SHORT-LIVED, narrowly-
 *   scoped WS ticket (separate from the long-lived `id_token`) so the
 *   client never touches the real bearer at all. The Socket.IO server
 *   currently validates the same Keycloak/Glow JWT, so until that
 *   API-side support exists this route returns the real `id_token`. The
 *   net win remains: the bearer is no longer in the broadly-exposed
 *   session — only fetched on demand for the WS handshake / logout hint.
 */

import { NextResponse, type NextRequest } from "next/server";

import { getServerIdToken } from "@/lib/api/server-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const token = await getServerIdToken(req);
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  return NextResponse.json(
    { token },
    { headers: { "Cache-Control": "no-store" } },
  );
}
