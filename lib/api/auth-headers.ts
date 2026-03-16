// lib/api/auth-headers.ts
//
// Builds the auth headers for server-side API calls.
// The server uses these to resolve profile_id + session_id — the client
// never needs to send X-Profile-Id or X-Session-Id.

import { auth } from "@/auth";

// Hardcoded for development — in production this would come from env:
// process.env.GLOW_API_KEY
const API_KEY = "glw_dev_test_key_123";

/**
 * Get auth headers for server-to-server API calls.
 *
 * Returns:
 *   X-Api-Key: license key (for billing/usage tracking)
 *   Authorization: Bearer <id_token> (JWT from Keycloak, for identity)
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "X-Api-Key": API_KEY,
  };

  try {
    const session = await auth();
    if (session?.id_token) {
      headers["Authorization"] = `Bearer ${session.id_token}`;
    }
  } catch {
    // No session available — headers will have API key only
  }

  return headers;
}
