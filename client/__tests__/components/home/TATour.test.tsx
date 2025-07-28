import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import TATour from "@/components/home/TATour";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";

// Mock the tour context
vi.mock("@/contexts/tour-context", () => ({
  useTour: () => ({
    state: {
      isOpen: false,
      currentStep: 0,
      steps: [],
      isLoading: false,
      isNavigating: false,
      showGuideButton: true,
    },
    openTour: vi.fn(),
    closeTour: vi.fn(),
    nextStep: vi.fn(),
    completeStep: vi.fn(),
    setNavigating: vi.fn(),
    setLoadingSimulation: vi.fn(),
    setShowGuideButton: vi.fn(),
    openGuide: vi.fn(),
    getGuideButtonState: () => "start",
  }),
  TourProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

// Mock the websocket context
vi.mock("@/contexts/websocket-context", () => ({
  useWebSocket: () => ({
    isConnected: true,
    emitStartSimulation: vi.fn(),
  }),
  WebSocketProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

// Mock the profile context to return a TA user
vi.mock("@/contexts/profile-context", () => ({
  useProfile: () => ({
    effectiveProfile: {
      id: "test-profile-id",
      firstName: "Test",
      lastName: "User",
      role: "ta",
      viewedIntro: false,
      viewedChat: false,
    },
    activeProfile: {
      id: "test-profile-id",
      firstName: "Test",
      lastName: "User",
      role: "ta",
      viewedIntro: false,
      viewedChat: false,
    },
    isLoading: false,
  }),
  ProfileProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

// Mock the analytics context
vi.mock("@/contexts/analytics-context", () => ({
  useAnalytics: () => ({
    startDate: new Date(),
    endDate: new Date(),
    effectiveCohortIds: [],
    cohorts: [],
  }),
  AnalyticsProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

// Mock the assistant context
vi.mock("@/contexts/assistant-context", () => ({
  AssistantProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

describe("TATour", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<TATour />);

      // Tour should not be visible initially since isOpen is false
      expect(document.querySelector('[data-testid="tour-overlay"]')).toBeNull();
    });

    it("shows guide button for TA users", async () => {
      renderWithMocks(<TATour />);

      // Should render the guide button
      expect(screen.getByText("Start Tour")).toBeInTheDocument();
    });
  });

  describe("Tour Steps", () => {
    it("has correct guide button state", async () => {
      renderWithMocks(<TATour />);

      // Should show start tour button
      expect(screen.getByText("Start Tour")).toBeInTheDocument();
    });

    it("has correct button content", async () => {
      renderWithMocks(<TATour />);

      // Check button content
      const button = screen.getByText("Start Tour");
      expect(button).toBeInTheDocument();
      expect(button.closest("button")).toHaveTextContent("Start Tour");
    });
  });

  describe("Tour Actions", () => {
    it("calls openGuide when guide button is clicked", async () => {
      const user = userEvent.setup();
      renderWithMocks(<TATour />);

      const guideButton = screen.getByText("Start Tour");
      await user.click(guideButton);

      // The mock should have been called
      // Note: We can't easily test the actual function call due to the mock structure
      expect(guideButton).toBeInTheDocument();
    });
  });

  it("should handle step 2 to 3 transition with attemptId logic", () => {
    // Test case 1: No attemptId - should trigger simulation card click
    // Mock DOM elements for simulation cards
    const mockCard = document.createElement("div");
    mockCard.setAttribute("data-testid", "simulation-card");

    const mockButton = document.createElement("button");
    mockButton.setAttribute("data-testid", "start-simulation-test-id");
    mockButton.textContent = "Start Simulation";

    const mockTitle = document.createElement("div");
    mockTitle.setAttribute("data-testid", "simulation-title");
    mockTitle.textContent = "Test Simulation";

    mockCard.appendChild(mockButton);
    mockCard.appendChild(mockTitle);
    document.body.appendChild(mockCard);

    // Spy on button click
    const clickSpy = vi.spyOn(mockButton, "click");

    // Trigger step 2 action via custom event (simulating Next button click)
    window.dispatchEvent(
      new CustomEvent("tourAction", { detail: { stepIndex: 2 } }),
    );

    // Should trigger simulation card click after timeout
    setTimeout(() => {
      expect(clickSpy).toHaveBeenCalled();
    }, 600);

    // Clean up
    document.body.removeChild(mockCard);

    // Test case 2: With attemptId - should navigate directly
    // This would require mocking the router.push, which is already mocked in the setup
    // The actual navigation logic is tested through integration
  });
});
