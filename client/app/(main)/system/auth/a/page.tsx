/**
 * app/(main)/system/auth/a/page.tsx
 * Auth edit page. Redirects to auth list page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { redirect } from "next/navigation";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Auth",
  description: `Auth in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default function AuthEditPage() {
  return redirect("/system/auth");
}

