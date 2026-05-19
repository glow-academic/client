// E2E auth bypass — forges a NextAuth session cookie for test recording.
//
// Gated by `E2E_BYPASS_TOKEN` env var. When unset, this route returns
// 404 — fully invisible in production. When set, POST with matching
// `Authorization: Bearer <token>` creates an encrypted NextAuth session
// pointing at the bootstrap superadmin (override with `X-E2E-Profile-Id`).
//
// The session's `id_token` is the bypass token itself, so any downstream
// API call that attaches `session.id_token` as Bearer is accepted by the
// API's bypass path. Same token across both surfaces.
//
// LOCAL DEV / PLAYWRIGHT ONLY. NEVER set `E2E_BYPASS_TOKEN` in production.

import { NextResponse } from "next/server"
import { encode } from "next-auth/jwt"

const TOKEN = process.env.E2E_BYPASS_TOKEN?.trim() ?? ""
const SECRET = process.env.AUTH_SECRET ?? process.env.SECRET_KEY ?? ""
const ENABLED = TOKEN.length > 0 && SECRET.length > 0
const DEFAULT_PROFILE_ID = "ef8ea508-9da8-56d0-8827-4419720bd4a8"

if (ENABLED) {
  // eslint-disable-next-line no-console
  console.warn(
    `[E2E_BYPASS] enabled — /api/e2e/login will forge sessions for any caller ` +
    `with the bypass token. NEVER ship this with E2E_BYPASS_TOKEN set in prod.`,
  )
}

export async function POST(req: Request) {
  if (!ENABLED) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const auth = req.headers.get("authorization") ?? ""
  const presented = auth.replace(/^Bearer\s+/i, "").trim()
  if (presented.length === 0 || presented !== TOKEN) {
    return NextResponse.json({ error: "Invalid bypass token" }, { status: 401 })
  }

  const profileId = (req.headers.get("x-e2e-profile-id") ?? "").trim() || DEFAULT_PROFILE_ID

  const sessionToken = await encode({
    salt: "authjs.session-token",
    secret: SECRET,
    token: {
      sub: profileId,
      id_token: TOKEN,
      email: "e2e-bypass@glow.local",
    },
    maxAge: 60 * 60 * 24,
  })

  const res = NextResponse.json({ ok: true, profile_id: profileId })
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
