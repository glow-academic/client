import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side federated logout — redirects browser to OIDC provider's
 * end_session_endpoint. This route runs server-side where AUTH_ISSUER
 * is available, so the client never needs to know the API URL.
 */
export async function GET(request: NextRequest) {
  const appPrefix = process.env["APP_PREFIX"] || "";
  const issuer =
    process.env["AUTH_ISSUER"] ||
    process.env["INTERNAL_API_BASE"] ||
    "http://localhost:8000";
  const clientId = process.env["AUTH_CLIENT_ID"] || "glow-client";

  const { searchParams } = new URL(request.url);
  const idTokenHint = searchParams.get("id_token_hint");

  // Build the return URL (back to the client's home page)
  const origin = request.headers.get("x-forwarded-host")
    ? `${request.headers.get("x-forwarded-proto") || "https"}://${request.headers.get("x-forwarded-host")}`
    : new URL(request.url).origin;
  const returnTo = encodeURIComponent(`${origin}${appPrefix}/`);

  let logoutUrl = `${issuer}/logout?post_logout_redirect_uri=${returnTo}&client_id=${clientId}`;
  if (idTokenHint) {
    logoutUrl += `&id_token_hint=${idTokenHint}`;
  }

  return NextResponse.redirect(logoutUrl);
}
