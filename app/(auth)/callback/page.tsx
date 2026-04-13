/**
 * app/(auth)/callback/page.tsx
 * Post-login routing page — fetches profile and redirects based on role.
 * Lives in (auth) group to bypass the (main) layout.
 */

import { api } from "@/lib/api/client";
import { redirect } from "next/navigation";

/** Client-owned routing: role → default landing page */
const ROLE_REDIRECT: Record<string, string> = {
  superadmin: "/home",
  admin: "/home",
  instructional: "/home",
  member: "/home",
  guest: "/practice",
};

export default async function CallbackPage() {
  let redirectPath = "/home";

  try {
    const profile = await api.post("/profiles/context", { body: {} });
    const role = profile?.role ?? "guest";
    redirectPath = ROLE_REDIRECT[role] ?? "/home";
  } catch {
    // Fallback to /home if profile fetch fails
  }

  redirect(redirectPath);
}
