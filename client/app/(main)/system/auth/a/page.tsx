/**
 * app/(main)/system/auth/a/page.tsx
 * Auth edit page. Redirects to auth list page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { redirect } from "next/navigation";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Auth",
    description:
      "Manage authentication methods and identity providers for teaching assistant training platform. Configure SSO, OAuth, and other authentication mechanisms for secure access to educational institutions and L&D programs.",
  };
}

export default function AuthEditPage() {
  return redirect("/system/auth");
}
