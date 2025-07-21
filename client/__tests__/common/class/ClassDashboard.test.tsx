/**
 * ClassDashboard.test.tsx
 * Tests for the ClassDashboard component
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */

import ClassDashboard from "@/components/common/class/ClassDashboard";
import { ProfileProvider } from "@/contexts/profile-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock the query functions
vi.mock("@/utils/queries/profiles/get-profiles-by-class");
vi.mock(
  "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles"
);
vi.mock("@/utils/queries/simulation_chats/get-simulation-chats-by-attempts");
vi.mock(
  "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats"
);
vi.mock("@/utils/queries/simulation_messages/get-simulation-messages-by-chats");
vi.mock("@/utils/queries/rubrics/get-all-rubrics");

const mockProfile = {
  id: "test-profile-id",
  userId: null,
  firstName: "Test",
  lastName: "User",
  alias: "testuser",
  role: "ta" as const,
  active: true,
  viewedIntro: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  lastLogin: new Date().toISOString(),
  lastActive: new Date().toISOString(),
  defaultProfile: false,
};

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <ProfileProvider activeProfile={mockProfile}>{children}</ProfileProvider>
    </QueryClientProvider>
  );
};

describe("ClassDashboard", () => {
  it("renders loading state initially", () => {
    render(<ClassDashboard classId="test-class-id" />, {
      wrapper: TestWrapper,
    });

    expect(screen.getByText("Loading Dashboard...")).toBeInTheDocument();
  });

  it("renders with classId prop", () => {
    render(<ClassDashboard classId="test-class-id" />, {
      wrapper: TestWrapper,
    });

    // Should render the component with the classId
    expect(screen.getByText("Loading Dashboard...")).toBeInTheDocument();
  });
});
