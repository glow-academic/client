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
      expect(screen.getByText("Single User")).toBeInTheDocument();
      expect(screen.getByText("CSV Import")).toBeInTheDocument();
      expect(screen.getByText("Manual Add")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      render(
        <Wrapper>
          <NewStaff />
        </Wrapper>
      );

      // Check that the download template button is accessible
      const downloadButton = screen.getByRole("button", {
        name: /download template/i,
      });
      expect(downloadButton).toBeInTheDocument();
    });

    it("should render single user form by default", () => {
      render(
        <Wrapper>
          <NewStaff />
        </Wrapper>
      );

      // Check that the single user form fields are present
      expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/username\/alias/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/role/i)).toBeInTheDocument();
    });
  });

  describe("CSV Import tab", () => {
    it("should render CSV upload interface", () => {
      render(
        <Wrapper>
          <NewStaff />
        </Wrapper>
      );

      // Click on CSV Import tab
      const csvTab = screen.getByText("CSV Import");
      csvTab.click();

      // Check that CSV upload elements are present
      expect(screen.getByText(/choose csv file/i)).toBeInTheDocument();
      expect(screen.getByText(/download template/i)).toBeInTheDocument();
    });
  });

  describe("Manual Add tab", () => {
    it("should render manual profile creation form", () => {
      render(
        <Wrapper>
          <NewStaff />
        </Wrapper>
      );

      // Click on Manual Add tab
      const manualTab = screen.getByText("Manual Add");
      manualTab.click();

      // Check that manual form fields are present
      expect(screen.getByLabelText(/first name \*/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/last name \*/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/alias \*/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/role \*/i)).toBeInTheDocument();
    });
  });
});
