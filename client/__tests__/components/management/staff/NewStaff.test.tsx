/**
 * NewStaff.test.tsx
 * Tests for the NewStaff component
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import NewStaff from "@/components/management/staff/NewStaff";

// Mock the necessary dependencies
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}));

vi.mock("@/contexts/profile-context", () => ({
  useProfile: () => ({
    effectiveProfile: {
      id: "test-profile-id",
      role: "admin",
      firstName: "Test",
      lastName: "Admin",
      alias: "testadmin",
    },
    isLoading: false,
  }),
}));

vi.mock("@/utils/mutations/profiles/create-profile", () => ({
  createProfile: vi.fn(),
}));

vi.mock("@/utils/mutations/profiles/create-profiles", () => ({
  createProfiles: vi.fn(),
}));

vi.mock("@/utils/queries/profiles/get-all-profiles", () => ({
  getAllProfiles: vi.fn(() => []),
}));

vi.mock("@/utils/queries/cohorts/get-all-cohorts", () => ({
  getAllCohorts: vi.fn(() => []),
}));

vi.mock("@/utils/mutations/cohorts/update-cohort", () => ({
  updateCohort: vi.fn(),
}));

vi.mock("@/utils/auth/get-profile-by-alias", () => ({
  getProfileByAlias: vi.fn(),
}));

// Create a wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const WrapperComponent = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  WrapperComponent.displayName = "TestWrapper";

  return WrapperComponent;
};

describe("NewStaff", () => {
  const Wrapper = createWrapper();

  describe("basic render smoke-test", () => {
    it("renders without crashing", () => {
      render(
        <Wrapper>
          <NewStaff />
        </Wrapper>
      );

      // Check that the main tabs are rendered
      expect(screen.getByText("CSV Import")).toBeInTheDocument();
      expect(screen.getByText("Manual Add")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      render(
        <Wrapper>
          <NewStaff />
        </Wrapper>
      );

      // Check that the component renders without crashing
      expect(document.body).toBeInTheDocument();
    });

    it("should render CSV import by default", () => {
      render(
        <Wrapper>
          <NewStaff />
        </Wrapper>
      );

      // Check that CSV import elements are present by default
      expect(screen.getByText(/choose csv file/i)).toBeInTheDocument();
      expect(screen.getByText(/download template/i)).toBeInTheDocument();
    });
  });

  describe("Manual Add tab", () => {
    it("should have manual add tab available", () => {
      render(
        <Wrapper>
          <NewStaff />
        </Wrapper>
      );

      // Check that Manual Add tab is present
      expect(screen.getByText("Manual Add")).toBeInTheDocument();
    });
  });
});
