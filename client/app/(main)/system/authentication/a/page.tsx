/**
 * app/(main)/system/authentication/a/page.tsx
 * Authentication edit page. Redirects to authentication list page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { redirect } from "next/navigation";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Authentication",
  description: `Authentication in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default function AuthEditPage() {
  return redirect("/system/authentication");
}
