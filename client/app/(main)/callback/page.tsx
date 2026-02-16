/**
 * app/(main)/callback/page.tsx
 * Post-login routing page — resolves redirect_path via lightweight endpoint and redirects.
 * Only runs once after auth; users are free to navigate anywhere after.
 */

import { api } from "@/lib/api/client";
import { redirect } from "next/navigation";

export default async function CallbackPage() {
  let redirectPath = "/home";

  try {
    const res = await api.post("/auth/callback", { body: {} });
    if (res?.redirect_path) {
      redirectPath = res.redirect_path;
    }
  } catch {
    // Fallback to /home if endpoint fails
  }

  redirect(redirectPath);
}
