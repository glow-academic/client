// lib/api/server-token.ts
//
// Server-only accessor for the raw API bearer (the Keycloak/Glow-signed
// `id_token`).
//
// SECURITY: the bearer is intentionally NOT exposed in the NextAuth
// `session()` callback output, so it never reaches `/api/auth/session`
// or client props (where any JS / XSS could read it). It lives ONLY in
// the encrypted, httpOnly session JWT. This helper decrypts that cookie
// server-side via `getToken()` (which also reassembles chunked session
// cookies) and returns the `id_token` claim.
//
// Consumers (all server-side): the server REST api (`lib/api/client.ts`
// via `auth-headers.ts`), the BFF proxy routes, the SSE watch proxy, and
// the WS-ticket route.
//
// SERVER/CLIENT BOUNDARY (#103/#105/#108): this module is the leaf that
// touches `next/headers`. It is marked `server-only`, so `next build`
// FAILS if any client component pulls it (transitively) into the browser
// bundle — that build-time guard is what enforces the boundary instead of
// the brittle `webpackIgnore` dynamic-import hack used in v1.0.32/33.
//
//   - v1.0.32 used a `webpackIgnore` dynamic `import("next/headers")` to
//     dodge the client-bundle build error. `@vercel/nft` could not trace
//     it, so the standalone output was missing `undici` → MODULE_NOT_FOUND
//     → null token → "Access Denied".
//   - v1.0.33 traced `undici` in, but the ambient (no-`req`) read STILL
//     returned null in the RSC server-component data path: a dynamic
//     `import("next/headers")` does not reliably resolve the per-request
//     async store there.
//
// The canonical fix (this file): a STATIC `import { cookies } from
// "next/headers"`. `cookies()` is the RSC-native per-request accessor — it
// works in Server Components, Server Actions, AND Route Handlers — so the
// ambient read is no longer null. Static imports also trace correctly into
// the standalone output (undici included), and the `server-only` marker +
// the clean client/server module split (see `lib/api/client.ts` and
// `lib/transport/commands-http.ts`) keep `next/headers` out of the client
// bundle without any bundler magic comment.

import "server-only";

import { cookies } from "next/headers";
import { getToken } from "next-auth/jwt";

const SECRET = process.env["AUTH_SECRET"] ?? process.env["SECRET_KEY"] ?? "";

/**
 * NextAuth/Auth.js session-cookie name. With an https app URL Auth.js
 * uses the `__Secure-` prefixed name (and that exact name is also the
 * JWE salt). Mirrors the logic in `app/api/session/adopt/route.ts` so
 * decode salt + cookie lookup stay in sync.
 */
function sessionCookieName(): string {
  const appUrl = process.env["AUTH_URL"] ?? process.env["NEXTAUTH_URL"] ?? "";
  return appUrl.startsWith("https://")
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";
}

/**
 * Reconstruct a `Cookie:` header string from the ambient request's cookie
 * store. We pass the full header (every cookie) so `getToken()` can
 * reassemble a CHUNKED session cookie (`…session-token.0`, `.1`, …).
 *
 * `cookies()` is the RSC-native accessor: it reads the current request's
 * async-context cookie store and works in Server Components, Server
 * Actions, and Route Handlers alike. This is the key correctness fix over
 * the v1.0.33 dynamic-import path, which returned null in the RSC
 * server-component data-fetch context.
 */
async function ambientCookieHeader(): Promise<string> {
  const store = await cookies();
  return store
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
}

/**
 * Read the raw API bearer (`id_token`) from the server-side session JWT.
 *
 * @param req Optional request (in a route handler, pass the incoming
 *   `Request`/`NextRequest`). When omitted, the cookie is read from the
 *   ambient request via `next/headers` `cookies()` (server components /
 *   actions / route handlers).
 * @returns the bearer string, or `null` if there is no valid session.
 */
export async function getServerIdToken(req?: Request): Promise<string | null> {
  const cookieName = sessionCookieName();
  const cookieHeader = req
    ? (req.headers.get("cookie") ?? "")
    : await ambientCookieHeader();

  try {
    const token = await getToken({
      req: { headers: { cookie: cookieHeader } },
      secret: SECRET,
      cookieName,
      salt: cookieName,
      secureCookie: cookieName.startsWith("__Secure-"),
    });
    const idToken = token?.["id_token"];
    return typeof idToken === "string" ? idToken : null;
  } catch {
    return null;
  }
}
