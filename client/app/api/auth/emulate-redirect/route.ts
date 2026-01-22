import { NextRequest, NextResponse } from "next/server";

/**
 * Emulation redirect endpoint.
 *
 * This endpoint is used as an intermediate redirect after Keycloak logout
 * during the emulation flow. It receives the emulation grant ID and redirects
 * to Keycloak's authorization endpoint with the default-idp hint.
 *
 * Flow:
 * 1. User clicks "Emulate" -> creates grant
 * 2. Redirect to Keycloak logout with post_logout_redirect_uri = this endpoint
 * 3. Keycloak logs out and redirects here
 * 4. This endpoint redirects to Keycloak auth with IdP hint
 * 5. Emulation completes
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const grantId = searchParams.get("grant");

  if (!grantId) {
    return NextResponse.json({ error: "Missing grant parameter" }, { status: 400 });
  }

  const keycloakPublicUrl = process.env["KEYCLOAK_PUBLIC_URL"] || "http://localhost:8080";
  const keycloakClientId = process.env["AUTH_KEYCLOAK_ID"] || "glow-client";
  const appPrefix = process.env["APP_PREFIX"] || "";
  const normalizedPrefix = appPrefix ? `/${appPrefix.replace(/^\/+|\/+$/g, "")}` : "";

  // Build the callback URL for our app
  const origin = request.nextUrl.origin;
  const redirectUri = `${origin}${normalizedPrefix}/api/auth/callback/keycloak`;

  // Build Keycloak authorization URL
  const authUrl = new URL(`${keycloakPublicUrl}/realms/master/protocol/openid-connect/auth`);
  authUrl.searchParams.set("client_id", keycloakClientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid profile email");
  authUrl.searchParams.set("kc_idp_hint", "default-idp");
  authUrl.searchParams.set("login_hint", grantId);
  authUrl.searchParams.set("prompt", "login");

  return NextResponse.redirect(authUrl.toString());
}
