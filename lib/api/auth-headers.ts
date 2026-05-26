// lib/api/auth-headers.ts
//
// Builds the auth headers for server-side API calls.
// The server uses these to resolve profile_id + session_id — the client
// never needs to send X-Profile-Id or X-Session-Id.

import { auth } from "@/auth";

/**
 * Get auth headers for server-to-server API calls.
 *
 * Returns:
 *   Authorization: Bearer <id_token> (JWT from Keycloak, for identity)
 *
 * The server resolves profile_id + session_id from the JWT. The legacy
 * X-Api-Key license header was removed — the backend no longer reads it.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};

  try {
    const session = await auth();
    if (session?.id_token) {
      headers["Authorization"] = `Bearer ${session.id_token}`;
    }
  } catch {
    // No session available — return without an Authorization header.
  }

  return headers;
}
