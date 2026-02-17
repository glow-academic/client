/**
 * app/login/page.tsx
 * This is the login page.
 * @AshokSaravanan222 & @siladiea
 * 05/14/2025
 */
import { getSession } from "@/auth";
import Login from "@/components/auth/Login";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Login",
  description: `Login to GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}`,
};

export default async function LoginPage() {
  const session = await getSession();
  const profileId = session?.user?.profileId;

  // If user has a real session with a profile, redirect to callback for role-based routing
  if (profileId) {
    redirect("/callback");
  }

  return <Login />;
}
