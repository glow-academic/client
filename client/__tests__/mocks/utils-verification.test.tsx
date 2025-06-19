import { useRole } from "@/contexts/role-context";
import {
  getProfileForRole,
  getSessionForRole,
  mockSessionForRole,
  renderWithProviders,
  TEST_ROLES,
  TEST_USERS,
} from "@/mocks/utils";
import { screen } from "@testing-library/react";
import { useSession } from "next-auth/react";
import { describe, expect, it, vi } from "vitest";

// Simple test component that displays user info
const TestComponent = () => {
  const { data: session } = useSession();
  const { effectiveRole } = useRole();

  return (
    <div>
      <div data-testid="session-status">
        {session ? "authenticated" : "unauthenticated"}
      </div>
      <div data-testid="user-name">{session?.user?.name || "No user"}</div>
      <div data-testid="user-email">{session?.user?.email || "No email"}</div>
      <div data-testid="effective-role">{effectiveRole}</div>
    </div>
  );
};

describe("Utils Mock Verification", () => {
  describe("Session Data Generation", () => {
    it("should generate session data for all 4 user roles", () => {
      const adminSession = getSessionForRole("admin");
      const instructionalSession = getSessionForRole("instructional");
      const instructorSession = getSessionForRole("instructor");
      const taSession = getSessionForRole("ta");

      expect(adminSession).toBeTruthy();
      expect(adminSession?.user.name).toContain("Admin");

      expect(instructionalSession).toBeTruthy();
      expect(instructionalSession?.user.name).toContain("Instructional");

      expect(instructorSession).toBeTruthy();
      expect(instructorSession?.user.name).toContain("Instructor");

      expect(taSession).toBeTruthy();
      expect(taSession?.user.name).toContain("TA");
    });

    it("should return null for guest role", () => {
      const guestSession = getSessionForRole("guest");
      expect(guestSession).toBeNull();
    });

    it("should have proper user-profile relationships", () => {
      const adminSession = getSessionForRole("admin");
      const adminProfile = getProfileForRole("admin");

      expect(adminSession?.profile.id).toBe(adminProfile?.id);
      expect(adminSession?.user.id).toBe(adminProfile?.userId.toString());
    });
  });

  describe("RenderWithProviders", () => {
    it("should render with admin role by default", () => {
      renderWithProviders(<TestComponent />);

      expect(screen.getByTestId("session-status")).toHaveTextContent(
        "authenticated"
      );
      expect(screen.getByTestId("effective-role")).toHaveTextContent("admin");
    });

    it("should work with manual session mocking", () => {
      // Example of how to manually mock a specific role
      const instructorSession = getSessionForRole("instructor");
      vi.mocked(useSession).mockReturnValue({
        data: instructorSession,
        status: "authenticated",
        update: vi.fn(),
      });

      renderWithProviders(<TestComponent />, "instructor", {
        session: instructorSession,
      });

      expect(screen.getByTestId("session-status")).toHaveTextContent(
        "authenticated"
      );
      expect(screen.getByTestId("effective-role")).toHaveTextContent(
        "instructor"
      );
      expect(screen.getByTestId("user-name")).toHaveTextContent("Instructor");
    });

    it("should handle guest mode with manual mocking", () => {
      // Example of how to mock guest mode
      vi.mocked(useSession).mockReturnValue({
        data: null,
        status: "unauthenticated",
        update: vi.fn(),
      });

      renderWithProviders(<TestComponent />, "guest", {
        session: null,
      });

      expect(screen.getByTestId("session-status")).toHaveTextContent(
        "unauthenticated"
      );
      expect(screen.getByTestId("effective-role")).toHaveTextContent("guest");
      expect(screen.getByTestId("user-name")).toHaveTextContent("No user");
    });
  });

  describe("Test Constants", () => {
    it("should export all test roles", () => {
      expect(TEST_ROLES).toEqual([
        "admin",
        "instructional",
        "instructor",
        "ta",
        "guest",
      ]);
    });

    it("should export test users for all roles", () => {
      expect(TEST_USERS.admin).toBeTruthy();
      expect(TEST_USERS.instructional).toBeTruthy();
      expect(TEST_USERS.instructor).toBeTruthy();
      expect(TEST_USERS.ta).toBeTruthy();
      expect(TEST_USERS.guest).toBeNull();
    });
  });

  describe("Mock Session Helper", () => {
    it("should create proper mock session data", () => {
      const adminMock = mockSessionForRole("admin");
      const guestMock = mockSessionForRole("guest");

      expect(adminMock.status).toBe("authenticated");
      expect(adminMock.data).toBeTruthy();

      expect(guestMock.status).toBe("unauthenticated");
      expect(guestMock.data).toBeNull();
    });
  });

  describe("Data Quality", () => {
    it("should have unique user IDs and profile relationships", () => {
      const roles = ["admin", "instructional", "instructor", "ta"] as const;
      const userIds = new Set();
      const profileIds = new Set();

      roles.forEach((role) => {
        const session = getSessionForRole(role);
        const profile = getProfileForRole(role);

        expect(session).toBeTruthy();
        expect(profile).toBeTruthy();

        // Check uniqueness
        expect(userIds.has(session!.user.id)).toBe(false);
        expect(profileIds.has(profile!.id)).toBe(false);

        userIds.add(session!.user.id);
        profileIds.add(profile!.id);

        // Check role consistency
        expect(profile!.role).toBe(role);
      });
    });
  });
});
