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
type DepartmentsLoginOut = OutputOf<"/api/v3/departments/login", "get">;

async function getLoginProviders(departmentId?: string): Promise<LoginProvidersOut> {
  try {
    const url = departmentId 
      ? `/auth/login?department_id=${departmentId}`
      : "/auth/login";
    const response = await api.get(url);
    return response;
  } catch {
    // Return empty array and default guest_login_enabled if endpoint fails
    return { providers: [], guest_login_enabled: true, show_default_account: false };
  }
}

async function getDepartments(): Promise<DepartmentsLoginOut> {
  try {
    const response = await api.get("/departments/login");
    return response;
  } catch {
    // Return empty array if endpoint fails
    return { departments: [] };
  }
}

export default async function LoginPage() {
  const [loginData, departmentsData] = await Promise.all([
    getLoginProviders(),
    getDepartments(),
  ]);
  
  return (
    <Login
      providers={loginData.providers}
      guest_login_enabled={loginData.guest_login_enabled}
      show_default_account={loginData.show_default_account}
      departments={departmentsData.departments}
    />
  );
}
