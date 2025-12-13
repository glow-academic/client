/**
 * app/login/page.tsx
 * This is the login page.
 * Follows dashboard pattern: query params determine logic, server-side data fetching.
 * @AshokSaravanan222 & @siladiea
 * 05/14/2025
 */
import Login from "@/components/auth/Login";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Login",
    description:
      "Login to GLOW - Graduate Learning Orientation Workshop. Access your teaching assistant training platform for simulation-based learning, pedagogical assessment, and professional development.",
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
/** ---- Now supports department-specific settings via departmentId parameter ---- */
async function getActiveSettings(
  departmentId?: string | null
): Promise<SettingsActiveOut | null> {
  try {
    return (await api.post(
      "/settings/active",
      {
        body: {
          profileId: null, // Use null for unauthenticated users (not "guest-profile-id")
          departmentId: departmentId || null, // Optional department ID for department-specific settings
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
  const redirectPathParam = params["redirectPath"];
  const redirectPath =
    typeof redirectPathParam === "string" ? redirectPathParam : undefined;

  // Fetch login data (providers + departments) from consolidated endpoint
  // First fetch without department to get default_department_id and departments list
  // Explicit type annotation needed because TypeScript can't infer from generic api.post return
  const loginDataWithoutDept: LoginDataOut = await getLoginData(undefined);

  // Determine which department ID to use for fetching providers
  // Priority: 1) Query param, 2) Default department from settings, 3) First department
  // Note: We use default department for API even if not in query params (keeps URL clean)
  const departmentIdForApi =
    departmentIdFromQuery ||
    loginDataWithoutDept.default_department_id ||
    (loginDataWithoutDept.departments.length > 0
      ? loginDataWithoutDept.departments[0]?.id
      : undefined);

  // Fetch login data with the determined department ID to get correct providers
  // This ensures we always filter providers by department, even if default (not in URL)
  const loginData: LoginDataOut = await getLoginData(departmentIdForApi);

  // Fetch settings separately (like settings page pattern)
  // Now supports department-specific settings based on selected department
  // Priority: 1) Query param department, 2) Default department, 3) First department, 4) Default settings
  const departmentIdForSettings =
    departmentIdFromQuery ||
    loginData.default_department_id ||
    (loginData.departments.length > 0 ? loginData.departments[0]?.id : null);
  const activeSettings = await getActiveSettings(departmentIdForSettings);

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
      redirectPath={redirectPath}
    />
  );
}
