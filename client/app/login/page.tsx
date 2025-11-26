/**
 * app/login/page.tsx
 * This is the login page.
 * @AshokSaravanan222 & @siladiea
 * 05/14/2025
 */
import { getSession } from "@/auth";
import Login from "@/components/auth/Login";
import { api } from "@/lib/api/client";
import type { OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "guest-profile-id";

  let organizationName = "";
  let organizationDescription = "";
  try {
    const activeSettings = await api.post("/settings/active", {
      body: { profileId },
    });
    organizationName = activeSettings.organization_name || "";
    organizationDescription = activeSettings.organization_description || "";
  } catch {
    // If settings unavailable, organizationName and organizationDescription will be empty
  }

  const orgPart = organizationName
    ? ` at ${organizationName}${organizationDescription ? ` - ${organizationDescription}` : ""}`
    : "";

  return {
    title: "Login",
    description: `Login to GLOW${orgPart}.`,
  };
}

/** ---- Strong types from OpenAPI ---- */
type LoginProvidersOut = OutputOf<"/api/v3/auth/login", "get">;

async function getLoginProviders(): Promise<LoginProvidersOut> {
  try {
    const response = await api.get("/auth/login");
    return response;
  } catch {
    // Return empty array and default guest_login_enabled if endpoint fails
    return { providers: [], guest_login_enabled: true };
  }
}

export default async function LoginPage() {
  const loginData = await getLoginProviders();
  return (
    <Login
      providers={loginData.providers}
      guest_login_enabled={loginData.guest_login_enabled}
    />
  );
}
