import { render, screen, waitFor } from "@/test/custom-render";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import TATour from "@/components/common/layout/TATour";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/auth";
import "@/mocks/navigation";

// Mock the tour context
const mockTourContext = {
  state: {
    isOpen: false,
    currentStep: 0,
    steps: [],
    isLoading: false,
    isNavigating: false,
    showGuideButton: true,
    profile: null,
    attemptId: null,
  },
  openTour: vi.fn(),
  closeTour: vi.fn(),
  nextStep: vi.fn(),
  completeStep: vi.fn(),
  setNavigating: vi.fn(),
  setLoadingSimulation: vi.fn(),
  setShowGuideButton: vi.fn(),
  setAttemptId: vi.fn(),
  openGuide: vi.fn(),
  getGuideButtonState: vi.fn(() => "start"),
};

vi.mock("@/contexts/tour-context", () => ({
  useTour: () => mockTourContext,
  TourProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

// Mock the tour steps creation
vi.mock("@/utils/tour-steps", () => ({
  createTATourSteps: vi.fn(() => [
    {
      id: "step-0",
      title: "Welcome",
      content: "Welcome to the tour",
      page: "/home",
      isCompleted: false,
    },
    {
      id: "step-1",
      title: "Cohort Leaderboard",
      content: "View your cohort leaderboard",
      page: "/cohorts/c/test-cohort",
      isCompleted: false,
    },
    {
      id: "step-2",
      title: "Practice Simulation",
      content: "Start a practice simulation",
      page: "/practice",
      isCompleted: false,
    },
    {
      id: "step-3",
      title: "Send Message",
      content: "Send your first message",
      page: "/practice/a/test-attempt",
      isCompleted: false,
    },
    {
      id: "step-4",
      title: "End Chat",
      content: "End the chat session",
      page: "/practice/a/test-attempt",
      isCompleted: false,
    },
  ]),
}));

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps = {};
// ------------------------------------------------------------------

describe("TATour", () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset mock contexts to default state
    Object.assign(mockTourContext.state, {
      isOpen: false,
      currentStep: 0,
      steps: [],
      isLoading: false,
      isNavigating: false,
      showGuideButton: true,
      profile: null,
      attemptId: null,
    });

    // Reset mock functions
    mockTourContext.getGuideButtonState.mockReturnValue("start");

    // Reset profile context to default TA user
    const { useProfile } = await import("@/contexts/profile-context");
    vi.mocked(useProfile).mockReturnValue({
      effectiveProfile: {
        id: "test-profile-id",
        userId: 1,
        firstName: "Test",
        lastName: "User",
        alias: "testuser",
        role: "ta",
        active: true,
        viewedIntro: false,
        viewedChat: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        defaultProfile: false,
      },
      activeProfile: null,
      simulatedProfile: null,
      isLoading: false,
      isSimulating: false,
      navigateToDefault: vi.fn(),
      isSectionAvailable: vi.fn(() => true),
    });
  });

  describe("Component Rendering", () => {
    it("renders without crashing", async () => {
      render(<TATour {...mockProps} />);
      await waitFor(() => {
        expect(screen.getByText("Start Tour")).toBeInTheDocument();
      });
    });

    it("shows guide button for TA users", async () => {
      render(<TATour {...mockProps} />);
      await waitFor(() => {
        expect(screen.getByText("Start Tour")).toBeInTheDocument();
      });
    });

    it("does not show guide button for non-TA users", async () => {
      // Mock the tour context to return "hidden" state for non-TA users
      mockTourContext.getGuideButtonState.mockReturnValue("hidden");

      // Update the profile context mock to return a non-TA user
      const { useProfile } = await import("@/contexts/profile-context");
      vi.mocked(useProfile).mockReturnValue({
        effectiveProfile: {
          id: "test-profile-id",
          userId: 1,
          firstName: "Test",
          lastName: "User",
          alias: "testuser",
          role: "admin",
          active: true,
          viewedIntro: false,
          viewedChat: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          lastActive: new Date().toISOString(),
          defaultProfile: false,
        },
        activeProfile: null,
        simulatedProfile: null,
        isLoading: false,
        isSimulating: false,
        navigateToDefault: vi.fn(),
        isSectionAvailable: vi.fn(() => true),
      });

      render(<TATour {...mockProps} />);
      await waitFor(() => {
        expect(screen.queryByText("Start Tour")).not.toBeInTheDocument();
      });
    });

    it("does not show guide button when profile is loading", async () => {
      // Update the profile context mock to return loading state
      const { useProfile } = await import("@/contexts/profile-context");
      vi.mocked(useProfile).mockReturnValue({
        effectiveProfile: null,
        activeProfile: null,
        simulatedProfile: null,
        isLoading: true,
        isSimulating: false,
        navigateToDefault: vi.fn(),
        isSectionAvailable: vi.fn(() => true),
      });

      render(<TATour {...mockProps} />);
      await waitFor(() => {
        expect(screen.queryByText("Start Tour")).not.toBeInTheDocument();
      });
    });

    it("does not show guide button when no profile exists", async () => {
      // Update the profile context mock to return no profile
      const { useProfile } = await import("@/contexts/profile-context");
      vi.mocked(useProfile).mockReturnValue({
        effectiveProfile: null,
        activeProfile: null,
        simulatedProfile: null,
        isLoading: false,
        isSimulating: false,
        navigateToDefault: vi.fn(),
        isSectionAvailable: vi.fn(() => true),
      });

      render(<TATour {...mockProps} />);
      await waitFor(() => {
        expect(screen.queryByText("Start Tour")).not.toBeInTheDocument();
      });
    });
  });

  describe("Guide Button States", () => {
    it("shows start state when tour not started", async () => {
      mockTourContext.getGuideButtonState.mockReturnValue("start");
      render(<TATour {...mockProps} />);
      await waitFor(() => {
        expect(screen.getByText("Start Tour")).toBeInTheDocument();
      });
    });

    it("shows resume state when tour in progress", async () => {
      mockTourContext.getGuideButtonState.mockReturnValue("resume");
      render(<TATour {...mockProps} />);
      await waitFor(() => {
        expect(screen.getByText("Resume Tour")).toBeInTheDocument();
      });
    });

    it("shows complete state when tour finished", async () => {
      mockTourContext.getGuideButtonState.mockReturnValue("complete");
      render(<TATour {...mockProps} />);
      await waitFor(() => {
        expect(screen.getByText("Tour Complete")).toBeInTheDocument();
      });
    });

    it("hides button when state is hidden", async () => {
      mockTourContext.getGuideButtonState.mockReturnValue("hidden");
      render(<TATour {...mockProps} />);
      await waitFor(() => {
        expect(screen.queryByText("Start Tour")).not.toBeInTheDocument();
      });
    });
  });

  describe("Tour Initialization", () => {
    it("initializes tour for TA users with incomplete profile", async () => {
      // Update the profile context mock to return a TA user with incomplete profile
      const { useProfile } = await import("@/contexts/profile-context");
      vi.mocked(useProfile).mockReturnValue({
        effectiveProfile: {
          id: "test-profile-id",
          updatedAt: "2025-07-29T14:36:26.938Z",
          userId: 1,
          lastLogin: "2025-07-29T14:36:26.938Z",
          firstName: "Test",
          lastName: "User",
          alias: "testuser",
          viewedIntro: false,
          viewedChat: false,
          createdAt: "2025-07-29T14:36:26.938Z",
          role: "ta",
          defaultProfile: false,
          active: true,
          lastActive: "2025-07-29T14:36:26.938Z",
        },
        activeProfile: null,
        simulatedProfile: null,
        isLoading: false,
        isSimulating: false,
        navigateToDefault: vi.fn(),
        isSectionAvailable: vi.fn(() => true),
      });

      render(<TATour {...mockProps} />);

      await waitFor(() => {
        expect(mockTourContext.openTour).toHaveBeenCalled();
      });
    });

    it("does not initialize tour for non-TA users", async () => {
      // Update the profile context mock to return a non-TA user
      const { useProfile } = await import("@/contexts/profile-context");
      vi.mocked(useProfile).mockReturnValue({
        effectiveProfile: {
          id: "test-profile-id",
          updatedAt: "2025-07-29T14:36:26.938Z",
          userId: 1,
          lastLogin: "2025-07-29T14:36:26.938Z",
          firstName: "Test",
          lastName: "User",
          alias: "testuser",
          viewedIntro: false,
          viewedChat: false,
          createdAt: "2025-07-29T14:36:26.938Z",
          role: "admin",
          defaultProfile: false,
          active: true,
          lastActive: "2025-07-29T14:36:26.938Z",
        },
        activeProfile: null,
        simulatedProfile: null,
        isLoading: false,
        isSimulating: false,
        navigateToDefault: vi.fn(),
        isSectionAvailable: vi.fn(() => true),
      });

      render(<TATour {...mockProps} />);

      await waitFor(() => {
        expect(mockTourContext.openTour).not.toHaveBeenCalled();
      });
    });

    it("does not re-initialize tour if already initialized for same profile", async () => {
      // Update the profile context mock to return a TA user
      const { useProfile } = await import("@/contexts/profile-context");
      vi.mocked(useProfile).mockReturnValue({
        effectiveProfile: {
          id: "test-profile-id",
          updatedAt: "2025-07-29T14:36:26.938Z",
          userId: 1,
          lastLogin: "2025-07-29T14:36:26.938Z",
          firstName: "Test",
          lastName: "User",
          alias: "testuser",
          viewedIntro: false,
          viewedChat: false,
          createdAt: "2025-07-29T14:36:26.938Z",
          role: "ta",
          defaultProfile: false,
          active: true,
          lastActive: "2025-07-29T14:36:26.938Z",
        },
        activeProfile: null,
        simulatedProfile: null,
        isLoading: false,
        isSimulating: false,
        navigateToDefault: vi.fn(),
        isSectionAvailable: vi.fn(() => true),
      });

      render(<TATour {...mockProps} />);

      await waitFor(() => {
        expect(mockTourContext.openTour).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("User Interactions", () => {
    it("calls openGuide when guide button is clicked", async () => {
      const user = userEvent.setup();
      render(<TATour {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("Start Tour")).toBeInTheDocument();
      });

      const guideButton = screen.getByText("Start Tour");
      await user.click(guideButton);

      expect(mockTourContext.openGuide).toHaveBeenCalled();
    });

    it("handles button state changes correctly", async () => {
      // Test different button states
      const states = ["start", "resume", "complete"];

      for (const state of states) {
        mockTourContext.getGuideButtonState.mockReturnValue(state);
        render(<TATour {...mockProps} />);

        await waitFor(() => {
          if (state === "start") {
            expect(screen.getByText("Start Tour")).toBeInTheDocument();
          } else if (state === "resume") {
            expect(screen.getByText("Resume Tour")).toBeInTheDocument();
          } else if (state === "complete") {
            expect(screen.getByText("Tour Complete")).toBeInTheDocument();
          }
        });
      }
    });
  });

  describe("Guide Button Visibility Logic", () => {
    it("shows guide button for TA users who haven't completed tour", async () => {
      const { useProfile } = await import("@/contexts/profile-context");
      vi.mocked(useProfile).mockReturnValue({
        effectiveProfile: {
          id: "test-profile-id",
          updatedAt: "2025-07-29T14:36:26.938Z",
          userId: 1,
          lastLogin: "2025-07-29T14:36:26.938Z",
          firstName: "Test",
          lastName: "User",
          alias: "testuser",
          viewedIntro: false,
          viewedChat: false,
          createdAt: "2025-07-29T14:36:26.938Z",
          role: "ta",
          defaultProfile: false,
          active: true,
          lastActive: "2025-07-29T14:36:26.938Z",
        },
        activeProfile: null,
        simulatedProfile: null,
        isLoading: false,
        isSimulating: false,
        navigateToDefault: vi.fn(),
        isSectionAvailable: vi.fn(() => true),
      });

      render(<TATour {...mockProps} />);
      await waitFor(() => {
        expect(screen.getByText("Start Tour")).toBeInTheDocument();
      });
    });

    it("hides guide button for TA users who have completed tour", async () => {
      // Mock the tour context to return "hidden" state for completed tours
      mockTourContext.getGuideButtonState.mockReturnValue("hidden");

      const { useProfile } = await import("@/contexts/profile-context");
      vi.mocked(useProfile).mockReturnValue({
        effectiveProfile: {
          id: "test-profile-id",
          userId: 1,
          firstName: "Test",
          lastName: "User",
          alias: "testuser",
          role: "ta",
          active: true,
          viewedIntro: true,
          viewedChat: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          lastActive: new Date().toISOString(),
          defaultProfile: false,
        },
        activeProfile: null,
        simulatedProfile: null,
        isLoading: false,
        isSimulating: false,
        navigateToDefault: vi.fn(),
        isSectionAvailable: vi.fn(() => true),
      });

      render(<TATour {...mockProps} />);
      await waitFor(() => {
        expect(screen.queryByText("Start Tour")).not.toBeInTheDocument();
      });
    });
  });
});
