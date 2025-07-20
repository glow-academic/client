/**
 * CohortDashboard.test.tsx
 * Tests for the CohortDashboard component
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */

import CohortDashboard from "@/components/common/cohort/CohortDashboard";
import { ProfileProvider } from "@/contexts/profile-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

const mockTaProfile = {
  id: "ta-profile-id",
  userId: 1,
  firstName: "TA",
  lastName: "User",
  alias: "ta_user",
  role: "ta" as const,
  active: true,
  viewedIntro: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  lastLogin: new Date().toISOString(),
  lastActive: new Date().toISOString(),
  defaultProfile: false,
};

const mockGuestProfile = {
  id: "guest-profile-id",
  userId: null,
  firstName: "Guest",
  lastName: "User",
  alias: "Guest",
  role: "guest" as const,
  active: true,
  viewedIntro: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  lastLogin: new Date().toISOString(),
  lastActive: new Date().toISOString(),
  defaultProfile: false,
};

const mockInstructorProfile = {
  id: "instructor-profile-id",
  userId: 2,
  firstName: "Instructor",
  lastName: "User",
  alias: "instructor_user",
  role: "instructor" as const,
  active: true,
  viewedIntro: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  lastLogin: new Date().toISOString(),
  lastActive: new Date().toISOString(),
  defaultProfile: false,
};

function renderWithProviders(
  component: React.ReactElement,
  profile:
    | typeof mockTaProfile
    | typeof mockGuestProfile
    | typeof mockInstructorProfile = mockTaProfile
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ProfileProvider activeProfile={profile}>{component}</ProfileProvider>
    </QueryClientProvider>
  );
}

describe("CohortDashboard", () => {
  it("shows loading state initially for TA users", () => {
    renderWithProviders(<CohortDashboard cohortId="test-cohort-id" />);
    expect(screen.getByText("Loading cohort dashboard...")).toBeInTheDocument();
  });

  it("shows access denied for guest users", async () => {
    renderWithProviders(
      <CohortDashboard cohortId="test-cohort-id" />,
      mockGuestProfile
    );

    await waitFor(() => {
      expect(screen.getByText("Access Denied")).toBeInTheDocument();
      expect(
        screen.getByText("You need TA permissions to view this dashboard.")
      ).toBeInTheDocument();
    });
  });

  it("renders without crashing", () => {
    renderWithProviders(<CohortDashboard cohortId="test-cohort-id" />);
    // Basic smoke test - component should render without throwing
    expect(screen.getByText("Loading cohort dashboard...")).toBeInTheDocument();
  });

  it("shows cohort not found when cohort doesn't exist", async () => {
    renderWithProviders(<CohortDashboard cohortId="non-existent-cohort" />);

    await waitFor(() => {
      expect(screen.getByText("Cohort Not Found")).toBeInTheDocument();
      expect(
        screen.getByText("The requested cohort could not be found.")
      ).toBeInTheDocument();
    });
  });

  it("shows simulation history section", async () => {
    renderWithProviders(<CohortDashboard cohortId="test-cohort-id" />);

    await waitFor(() => {
      expect(screen.getByText("Simulation History")).toBeInTheDocument();
    });
  });
});
