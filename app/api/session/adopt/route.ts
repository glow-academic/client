// Session adoption — establish a NextAuth session from an already-valid API
// bearer token (the one `glow login` holds). This replaces the old static
// E2E_BYPASS_TOKEN: there is NO shared secret.
//
// The presented token must be a well-formed, unexpired JWT. The API
// independently re-validates it (real signature + identity) on every
// downstream call, so this route grants no new privilege — a caller holding
// such a token is already authenticated to the API. It just mints the
// matching browser session (SSO-with-existing-token) so `glow record` can
// drive the UI as the CLI's logged-in identity. The session's `id_token` is
// the real token, so `lib/api/auth-headers.ts` sends it straight through to
// the API's real `resolve_identity`.
//
// Kill-switch: set DISABLE_SESSION_ADOPT=1 to forbid token→cookie exchange.

import { NextResponse } from "next/server"
import { encode } from "next-auth/jwt"

const SECRET = process.env["AUTH_SECRET"] ?? process.env["SECRET_KEY"] ?? ""
const DISABLED = process.env["DISABLE_SESSION_ADOPT"] === "1" || SECRET.length === 0

/** Decode a JWT payload (no signature check — the API verifies on use). */
function decodeJwt(token: string): Record<string, unknown> | null {
  const parts = token.split(".")
  const payload = parts[1]
  if (parts.length !== 3 || !payload) return null
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
  } catch {
    return null
  }
}

export async function POST(req: Request) {
  if (DISABLED) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const auth = req.headers.get("authorization") ?? ""
  const token = auth.replace(/^Bearer\s+/i, "").trim()
  const claims = token ? decodeJwt(token) : null
  if (!claims) {
    return NextResponse.json(
      { error: "Missing or malformed Bearer JWT" },
      { status: 401 },
    )
  }
  const exp = typeof claims["exp"] === "number" ? (claims["exp"] as number) : 0
  if (exp > 0 && exp * 1000 < Date.now()) {
    return NextResponse.json({ error: "Token expired" }, { status: 401 })
  }

  const sub = String(claims["profile_id"] ?? claims["sub"] ?? "")
  const email =
    typeof claims["email"] === "string" ? (claims["email"] as string) : undefined

  const sessionToken = await encode({
    salt: "authjs.session-token",
    secret: SECRET,
    token: { sub, id_token: token, email },
    maxAge: 60 * 60 * 24,
  })

  const res = NextResponse.json({ ok: true, profile_id: sub })
  res.cookies.set({
    name: "authjs.session-token",
    value: sessionToken,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  })
  return res
}
