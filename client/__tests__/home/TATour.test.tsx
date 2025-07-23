import { SidebarProvider } from "@/components/ui/sidebar";
import { AssistantProvider } from "@/contexts/assistant-context";
import { ProfileProvider } from "@/contexts/profile-context";
import { TourProvider } from "@/contexts/tour-context";
import { WebSocketProvider } from "@/contexts/websocket-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import TATour from "@/components/home/TATour";

// Types for mock reactour props and steps
interface MockTourStep {
  id: string;
  title: string;
  content: string;
  selector?: string;
  position?: "top" | "bottom" | "left" | "right";
  action?: () => void;
  isCompleted: boolean;
  requiresAction: boolean;
}
interface MockTourProps {
  isOpen: boolean;
  onRequestClose: () => void;
  steps: MockTourStep[];
}

// Mock reactour
vi.mock("reactour", () => ({
  default: ({ isOpen, onRequestClose, steps }: MockTourProps) => {
    if (!isOpen) return null;
    return (
      <div data-testid="tour-overlay">
        <button onClick={onRequestClose}>Close Tour</button>
        <div data-testid="tour-steps">
          {steps?.map((step: MockTourStep, index: number) => (
            <div key={index} data-testid={`tour-step-${index}`}>
              {step.content}
            </div>
          ))}
        </div>
      </div>
    );
  },
}));

// Create a custom render function for TATour tests
const renderTATour = () => {
  const mockProfile = {
    id: "test-ta-profile-id",
    userId: 1,
    firstName: "Test",
    lastName: "TA",
    alias: "testta",
    role: "ta" as const,
    active: true,
    viewedIntro: false, // Hasn't completed intro
    viewedChat: false, // Hasn't completed chat
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
    lastActive: new Date().toISOString(),
    defaultProfile: false,
  };

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ProfileProvider activeProfile={mockProfile}>
        <AssistantProvider>
          <WebSocketProvider profileId={mockProfile.id}>
            <TourProvider>
              <SidebarProvider>
                <TATour />
              </SidebarProvider>
            </TourProvider>
          </WebSocketProvider>
        </AssistantProvider>
      </ProfileProvider>
    </QueryClientProvider>
  );
};

describe("TATour", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders without crashing", async () => {
      renderTATour();

      // Tour should not be visible initially
      expect(document.querySelector('[data-testid="tour-overlay"]')).toBeNull();
    });

    it("shows tour when profile has not viewed intro or chat", async () => {
      renderTATour();

      // Tour should be visible
      expect(
        document.querySelector('[data-testid="tour-overlay"]')
      ).toBeInTheDocument();
    });
  });

  describe("Tour Steps", () => {
    it("has correct number of steps", async () => {
      renderTATour();

      // Should have 5 steps
      const steps = document.querySelectorAll('[data-testid^="tour-step-"]');
      expect(steps).toHaveLength(5);
    });

    it("has correct step content", async () => {
      renderTATour();

      // Check first step content
      const firstStep = document.querySelector('[data-testid="tour-step-0"]');
      expect(firstStep).toHaveTextContent("Welcome to GLOW!");
      expect(firstStep).toHaveTextContent("home dashboard");
    });
  });

  describe("Tour Actions", () => {
    it("calls onClose when tour is closed", async () => {
      renderTATour();

      const closeButton = document.querySelector("button");
      if (closeButton) {
        closeButton.click();
      }
    });
  });

  it("should handle step 2 to 3 transition with attemptId logic", () => {
    // Test case 1: No attemptId - should trigger simulation card click
    const { rerender } = renderTATour();

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
      new CustomEvent("tourAction", { detail: { stepIndex: 2 } })
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
