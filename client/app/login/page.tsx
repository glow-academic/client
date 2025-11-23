/**
 * app/login/page.tsx
 * This is the login page.
 * @AshokSaravanan222 & @siladiea
 * 05/14/2025
 */
import Login from "@/components/auth/Login";
import { api } from "@/lib/api/client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login",
  description: `Login to GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}`,
};

async function getLoginProviders(): Promise<string[]> {
  try {
    const response = await api.get("/auth/login");
    return response.providers || [];
  } catch {
    // Return empty array if endpoint fails
    return [];
  }
}

export default async function LoginPage() {
  const providers = await getLoginProviders();
  return <Login providers={providers} />;
}
