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
// Consumers (all server-side): the BFF proxy routes, the shared REST
// request layer (`lib/api/request-core.ts` via `auth-headers.ts`), the
// SSE watch proxy, and the WS-ticket route.
//
// SERVER/CLIENT BOUNDARY (#103 build fix): this module is transitively
// reachable from the CLIENT component graph —
//   request-core.ts → auth-headers.ts → server-token.ts
// and request-core is pulled into client components via the transport
// (`lib/transport/*`) and `lib/api/ack.ts`. A STATIC `import … from
// "next/headers"` therefore poisons the client bundle: `next build`
// fails with "You're importing a component that needs next/headers …
// only works in a Server Component". (tsc does not catch this — only
// `next build` does.) To keep `next/headers` out of the client module
// graph WITHOUT re-exposing the bearer to the browser, the ambient
// cookie read uses a `webpackIgnore` runtime import below. It only ever
// executes server-side: every caller of `getServerIdToken()` without a
// `req` runs on the server (server components, and `request-core` gates
// its call behind `typeof window === "undefined"`). The bearer thus
// stays server-only (#103 intact) and the build stays green.

import { getToken } from "next-auth/jwt";

/**
 * Read the ambient request's `cookie` header via `next/headers`, WITHOUT
 * a static import (which would drag the server-only `next/headers` module
 * into the client bundle — see the boundary note above). The
 * `webpackIgnore` magic comment + computed specifier keep the bundler
 * from adding `next/headers` to the client graph; this only ever runs
 * server-side.
 */
async function ambientCookieHeader(): Promise<string> {
  const specifier = "next/headers";
  const mod = (await import(/* webpackIgnore: true */ specifier)) as {
    headers: () => Promise<{ get: (name: string) => string | null }>;
  };
  return (await mod.headers()).get("cookie") ?? "";
}

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
 * Read the raw API bearer (`id_token`) from the server-side session JWT.
 *
 * @param req Optional request (in a route handler, pass the incoming
 *   `Request`/`NextRequest`). When omitted, the cookie is read from the
 *   ambient request via `next/headers` (server components / actions).
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
