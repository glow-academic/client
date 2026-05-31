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

// Mirror Auth.js cookie naming. With an https app URL (production) Auth.js uses
// secure cookies named `__Secure-authjs.session-token` — and that exact name
// is also the JWE *salt*. If we write the plain `authjs.session-token`, the app
// looks for the `__Secure-` cookie, finds none, reads the session as null, and
// bounces to login. (http://127.0.0.1 is a secure context in Chromium, so the
// `Secure` flag is still storable there for the recorder.)
const APP_URL = process.env["AUTH_URL"] ?? process.env["NEXTAUTH_URL"] ?? ""
const USE_SECURE_COOKIES = APP_URL.startsWith("https://")
const COOKIE_NAME = USE_SECURE_COOKIES
  ? "__Secure-authjs.session-token"
  : "authjs.session-token"

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
    salt: COOKIE_NAME,
    secret: SECRET,
    token: { sub, id_token: token, email },
    maxAge: 60 * 60 * 24,
  })

  const res = NextResponse.json({ ok: true, profile_id: sub })
  res.cookies.set({
    name: COOKIE_NAME,
    value: sessionToken,
    httpOnly: true,
    secure: USE_SECURE_COOKIES,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  })
  return res
}
