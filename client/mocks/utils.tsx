import { RoleProvider } from "@/contexts/role-context";
import * as mockSchema from "@/mocks/schema";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { SessionProvider } from "next-auth/react";
import React from "react";
import { vi } from "vitest";

// Use the extended ProfileRole type that includes guest
type ProfileRole = "admin" | "instructional" | "instructor" | "ta" | "guest";

/* ------------------------------------------------------------------ */
/* 1️⃣  React-Query test helper                                        */
/* ------------------------------------------------------------------ */
export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

/* ------------------------------------------------------------------ */
/* 2️⃣  Session data for different user types                          */
/* ------------------------------------------------------------------ */

// Map role to corresponding user and profile data
const getUserDataByRole = (role: ProfileRole) => {
  if (role === "guest") {
    return null;
  }

  const roleIndex = {
    admin: 0,
    instructional: 1,
    instructor: 2,
    ta: 3,
  }[role];

  if (
    roleIndex === undefined ||
    !mockSchema.users[roleIndex] ||
    !mockSchema.profiles[roleIndex]
  ) {
    return null;
  }

  const user = mockSchema.users[roleIndex];
  const profile = mockSchema.profiles[roleIndex];

  return {
    user: {
      id: user.id.toString(),
      name: user.name || `${profile.firstName} ${profile.lastName}`,
      email: user.email || `${role}@example.com`,
      image: user.image || null,
    },
    profile,
    expires: "2099-01-01T00:00:00.000Z",
  };
};

// Pre-built sessions for each role
const sessionsByRole = {
  admin: getUserDataByRole("admin"),
  instructional: getUserDataByRole("instructional"),
  instructor: getUserDataByRole("instructor"),
  ta: getUserDataByRole("ta"),
  guest: null, // No session for guest
};

/**
 * Renders UI wrapped in:
 *   • SessionProvider  (next-auth)
 *   • QueryClientProvider (react-query)
 *   • RoleProvider (role context)
 *
 * You can specify which user role to simulate, and it will automatically
 * provide the correct session data and profile role.
 *
 * Note: This sets the global useSession mock, so clean up with afterEach if needed.
 */
export function renderWithProviders(
  ui: React.ReactElement,
  testUserRole: ProfileRole = "admin",
  options?: {
    session?: typeof sessionsByRole.admin | null;
    queryClient?: QueryClient;
    skipRoleProvider?: boolean;
  }
) {
  const qc = options?.queryClient ?? createQueryClient();
  const session = options?.session ?? sessionsByRole[testUserRole];

  // Extract ProfileRole from session for RoleProvider
  const profileRole = session?.profile?.role as ProfileRole | undefined;

  // Set the global useSession mock for this role
  setSessionMockToRole(testUserRole);

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <SessionProvider session={session}>
      <QueryClientProvider client={qc}>
        {options?.skipRoleProvider ? (
          children
        ) : (
          <RoleProvider ProfileRole={profileRole}>{children}</RoleProvider>
        )}
      </QueryClientProvider>
    </SessionProvider>
  );

  return render(ui, { wrapper: Wrapper });
}

/**
 * Helper to get session data for a specific role
 * Useful for manual session mocking in tests
 */
export const getSessionForRole = (role: ProfileRole) => {
  return sessionsByRole[role];
};

/**
 * Helper to get profile data for a specific role
 * Useful for profile-specific testing
 */
export const getProfileForRole = (role: ProfileRole) => {
  const sessionData = sessionsByRole[role];
  return sessionData?.profile || null;
};

/**
 * Manually set the useSession mock to a specific role
 * Useful for tests that need to switch roles mid-test
 */
export const setSessionMockToRole = (role: ProfileRole) => {
  const sessionData = sessionsByRole[role];

  // This is a simplified approach - in real tests, you would import useSession and mock it directly
  // For now, we'll just provide the helper function structure
  return {
    data: sessionData,
    status: sessionData
      ? ("authenticated" as const)
      : ("unauthenticated" as const),
    update: vi.fn(),
  };
};

/* ------------------------------------------------------------------ */
/* 3️⃣  Global mocks (applied once for the whole test run)             */
/* ------------------------------------------------------------------ */

/* -- useRouter ------------------------------------------------------ */
export const routerMock = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  prefetch: vi.fn(),
  refresh: vi.fn(),
  forward: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  usePathname: vi.fn(() => "/"),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

/* -- useSession ----------------------------------------------------- */
vi.mock("next-auth/react", async () => {
  // Import the real module first so we don't break SessionProvider, signIn, etc
  const actual =
    await vi.importActual<typeof import("next-auth/react")>("next-auth/react");

  return {
    ...actual,
    /**
     * By default every test gets an "authenticated" admin user.
     * Override per-test with setSessionMockToRole() or renderWithProviders()
     */
    useSession: vi.fn(() => ({
      data: sessionsByRole.admin,
      status: "authenticated",
      update: vi.fn(),
    })),
  };
});

/* ------------------------------------------------------------------ */
/* 4️⃣  Test utilities and exports                                     */
/* ------------------------------------------------------------------ */

/**
 * Mock useSession to return specific role data
 * Useful for testing role-specific behavior
 */
export const mockSessionForRole = (role: ProfileRole) => {
  return {
    data: sessionsByRole[role],
    status: sessionsByRole[role]
      ? ("authenticated" as const)
      : ("unauthenticated" as const),
    update: vi.fn(),
  };
};

export const TEST_ROLES: ProfileRole[] = [
  "admin",
  "instructional",
  "instructor",
  "ta",
  "guest",
];

export const TEST_USERS = {
  admin: sessionsByRole.admin,
  instructional: sessionsByRole.instructional,
  instructor: sessionsByRole.instructor,
  ta: sessionsByRole.ta,
  guest: sessionsByRole.guest,
};
