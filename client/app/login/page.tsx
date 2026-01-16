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
import { cookies } from "next/headers";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Login",
    description:
      "Login to GLOW - Graduate Learning Orientation Workshop. Access your teaching assistant training platform for simulation-based learning, pedagogical assessment, and professional development.",
  };
}

/** ---- Strong types from OpenAPI ---- */
type LoginDataIn = InputOf<"/api/v4/auth/login", "post">;
type LoginDataOut = OutputOf<"/api/v4/auth/login", "post">;
type ProfileContextOut = OutputOf<"/api/v4/auth/context", "post">;

interface LoginPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

/** ---- Direct fetch for login data (consolidated endpoint) ---- */
async function getLoginData(departmentId?: string): Promise<LoginDataOut> {
  try {
    const input: LoginDataIn = {
      body: {
        department_id: departmentId || null,
      },
    };
    return api.post("/auth/login", input);
  } catch {
    // Return empty arrays and defaults if endpoint fails
    return {
      providers: [],
      departments: [],
      guest_login_enabled: true,
      show_default_account: false,
      default_department_id: null,
      realm_name: "master",
    } as LoginDataOut;
  }
}

/** ---- Fetch settings via profile context endpoint ----
 * Uses department-id and auth-mode cookies for profile resolution
 * This is the single source of truth for settings (consistent with rest of app)
 * NOTE: Only profile/context endpoint reads these cookies - all other endpoints
 * receive profileId in request body (validated via profile context)
 * This enables future redirect logic if user is already logged in
 *
 * Logic:
 * - If department-id query param provided: use it (overrides cookie)
 * - If no department-id: use default settings (no department-specific)
 * - If no auth-mode: defaults to "default-account" on server
 */
async function getProfileContext(
  departmentIdFromQuery?: string
): Promise<ProfileContextOut | null> {
  try {
    // Forward cookies from server component context to API request
    // This is needed because server components run server-side and cookies aren't automatically forwarded
    const cookieStore = await cookies();

    // Use department-id from query parameter if provided, otherwise use cookie
    // Query parameter takes precedence for dynamic settings changes
    const departmentIdToUse =
      departmentIdFromQuery || cookieStore.get("department-id")?.value;
    const authMode = cookieStore.get("auth-mode")?.value;

    // Build cookie header
    // NOTE: Do NOT send auth-mode cookie if not set - this prevents authorization check
    // from blocking settings fetch on login page (we're just getting theme, not authenticating)
    const cookieHeader = [
      departmentIdToUse && `department-id=${departmentIdToUse}`,
      // Only include auth-mode if explicitly set (don't default to "default-account")
      // This allows login page to fetch settings without triggering authorization checks
      authMode && `auth-mode=${authMode}`,
    ]
      .filter(Boolean)
      .join("; ");

    return api.post(
      "/auth/context",
      {
        body: {},
      },
      cookieHeader
        ? {
            cache: "no-store",
            headers: {
              "X-Bypass-Cache": "1",
              Cookie: cookieHeader,
            },
          }
        : {
            cache: "no-store",
            headers: {
              "X-Bypass-Cache": "1",
            },
          }
    );
  } catch {
    // If profile context fetch fails, return null - theme will use defaults
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
    (loginDataWithoutDept.departments &&
    loginDataWithoutDept.departments.length > 0
      ? (loginDataWithoutDept.departments[0]?.id ?? undefined)
      : undefined);

  // Fetch login data with the determined department ID to get correct providers
  // This ensures we always filter providers by department, even if default (not in URL)
  const loginData: LoginDataOut = await getLoginData(
    departmentIdForApi ?? undefined
  );

  // Fetch settings via profile context endpoint
  // Only fetch if we have a department-id (from query param or cookie)
  // Without a department-id, the SQL query requires a profile which we don't have on login page
  // In that case, we'll use default theme (handled by Login component)
  const cookieStore = await cookies();
  const departmentIdFromCookie = cookieStore.get("department-id")?.value;
  const hasDepartmentContext = departmentIdFromQuery || departmentIdFromCookie;

  const profileContext = hasDepartmentContext
    ? await getProfileContext(departmentIdFromQuery)
    : null;
  // Extract settings from profile context (SettingsData is compatible with SettingsActiveOut)
  const activeSettings: ProfileContextOut["settings_tokens"] | null =
    profileContext?.settings_tokens ?? null;

  // Business logic: Validate department_id from query param exists in departments list
  const validDepartmentId =
    departmentIdFromQuery &&
    loginData.departments?.some((d) => d.id === departmentIdFromQuery)
      ? departmentIdFromQuery
      : undefined;

  // Business logic: Pick default department if none provided
  // Priority: 1) Valid query param, 2) Default from settings_default_department table, 3) First department alphabetically
  const initialDepartmentId =
    validDepartmentId ||
    (loginData.default_department_id &&
    loginData.departments?.some((d) => d.id === loginData.default_department_id)
      ? loginData.default_department_id
      : undefined) ||
    (loginData.departments && loginData.departments.length > 0
      ? (loginData.departments[0]?.id ?? undefined)
      : undefined);

  // Filter and transform providers to match component types (filter out items with null IDs)
  const providers = (loginData.providers ?? [])
    .filter(
      (p): p is NonNullable<typeof p> =>
        p !== null && p.id !== null && p.name !== null
    )
    .map((p) => {
      const provider: {
        id: string;
        name: string;
        icon: string | null;
        is_default?: boolean;
      } = {
        id: p.id!,
        name: p.name!,
        icon: p.icon,
      };
      if (p.is_default !== null && p.is_default !== undefined) {
        provider.is_default = p.is_default;
      }
      return provider;
    });

  // Filter and transform departments to match component types (filter out items with null IDs)
  const departments = (loginData.departments ?? [])
    .filter(
      (d): d is NonNullable<typeof d> =>
        d !== null &&
        d.id !== null &&
        d.title !== null &&
        d.description !== null
    )
    .map((d) => ({
      id: d.id!,
      title: d.title!,
      description: d.description!,
    }));

  // Build Login props with proper null handling for exactOptionalPropertyTypes
  const loginProps: {
    providers: typeof providers;
    guest_login_enabled: boolean;
    show_default_account: boolean;
    departments: typeof departments;
    initialDepartmentId: string | undefined;
    activeSettings: typeof activeSettings;
    defaultDepartmentId: string | null;
    realmName: string;
    redirectPath?: string;
  } = {
    providers,
    guest_login_enabled: loginData.guest_login_enabled ?? true,
    show_default_account: loginData.show_default_account ?? false,
    departments,
    initialDepartmentId,
    activeSettings,
    defaultDepartmentId: loginData.default_department_id ?? null,
    realmName: "master", // Always master realm (organizations replace multi-realm architecture)
  };
  if (redirectPath) {
    loginProps.redirectPath = redirectPath;
  }

  return <Login {...loginProps} />;
}
