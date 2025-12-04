/**
 * app/login/page.tsx
 * This is the login page.
 * Follows dashboard pattern: query params determine logic, server-side data fetching.
 * @AshokSaravanan222 & @siladiea
 * 05/14/2025
 */
import { getSession } from "@/auth";
import Login from "@/components/auth/Login";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
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
type LoginDataIn = InputOf<"/api/v3/auth/login", "post">;
type LoginDataOut = OutputOf<"/api/v3/auth/login", "post">;
type SettingsActiveOut = OutputOf<"/api/v3/settings/active", "post">;

interface LoginPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

/** ---- Direct fetch for login data (consolidated endpoint) ---- */
async function getLoginData(departmentId?: string): Promise<LoginDataOut> {
  try {
    const input: LoginDataIn = {
      body: {
        departmentId: departmentId || null,
      },
    };
    // Type assertion needed - TypeScript can't infer generic return type from api.post
    // The schema is correct, but the type system needs help resolving the generic types
    return (await api.post("/auth/login", input)) as LoginDataOut;
  } catch {
    // Return empty arrays and defaults if endpoint fails
    return {
      providers: [],
      departments: [],
      guest_login_enabled: true,
      show_default_account: false,
      default_department_id: null,
    } as LoginDataOut;
  }
}

/** ---- Direct fetch for settings (separate call, like settings page pattern) ---- */
async function getActiveSettings(
  departmentId?: string
): Promise<SettingsActiveOut | null> {
  try {
    // Type assertion needed because departmentId is optional in the API
    return (await api.post(
      "/settings/active",
      {
        body: {
          profileId: "guest-profile-id",
          ...(departmentId ? { departmentId } : {}),
        },
      },
      {
        cache: "no-store",
        headers: {
          "X-Bypass-Cache": "1",
        },
      }
    )) as SettingsActiveOut;
  } catch {
    // If settings fetch fails, return null - theme will use defaults
    return null;
  }
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  // Parse search params (following dashboard pattern)
  const params = await searchParams;
  const departmentParam = params["department"];
  const departmentIdFromQuery =
    typeof departmentParam === "string" ? departmentParam : undefined;

  // Fetch login data (providers + departments) from consolidated endpoint
  // Explicit type annotation needed because TypeScript can't infer from generic api.post return
  const loginData: LoginDataOut = await getLoginData(departmentIdFromQuery);

  // Fetch settings separately (like settings page pattern)
  const activeSettings = await getActiveSettings(departmentIdFromQuery);

  // Business logic: Validate department_id from query param exists in departments list
  const validDepartmentId =
    departmentIdFromQuery &&
    loginData.departments.some((d) => d.id === departmentIdFromQuery)
      ? departmentIdFromQuery
      : undefined;

  // Business logic: Pick default department if none provided
  // Priority: 1) Valid query param, 2) Default from settings_default_department table, 3) First department alphabetically
  const initialDepartmentId =
    validDepartmentId ||
    (loginData.default_department_id &&
    loginData.departments.some((d) => d.id === loginData.default_department_id)
      ? loginData.default_department_id
      : undefined) ||
    (loginData.departments.length > 0
      ? loginData.departments[0]?.id
      : undefined);

  return (
    <Login
      providers={loginData.providers}
      guest_login_enabled={loginData.guest_login_enabled}
      show_default_account={loginData.show_default_account || false}
      departments={loginData.departments}
      initialDepartmentId={initialDepartmentId}
      activeSettings={activeSettings}
      defaultDepartmentId={loginData.default_department_id || null}
    />
  );
}
