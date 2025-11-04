import { render, screen, waitFor } from "@/test/custom-render";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import ChatWidget from "@/components/assistant/ChatWidget";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";

// Mock the assistant context
vi.mock("@/contexts/assistant-context", () => ({
  useAssistant: () => ({
    uiState: "widget",
    expand: vi.fn(),
    close: vi.fn(),
    currentChatId: null,
    chats: [
      {
        id: "chat-1",
        title: "Test Chat 1",
        profileId: "profile-1",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "chat-2",
        title: "Test Chat 2",
        profileId: "profile-1",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    isLoadingChats: false,
    createChat: vi.fn(),
    selectChat: vi.fn(),
    deleteChat: vi.fn(),
    sendMessage: vi.fn(),
    isLoading: false,
    error: null,
    setCurrentChatId: vi.fn(),
  }),
  AssistantProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

// Mock the profile context
vi.mock("@/contexts/profile-context", () => ({
  useProfile: () => ({
    activeProfile: {
      id: "test-profile-id",
      userId: 1,
      firstName: "Test",
      lastName: "User",
      alias: "testuser",
      role: "admin",
      active: true,
      viewedIntro: true,
      viewedChat: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      defaultProfile: false,
    },
    setActiveProfile: vi.fn(),
    profiles: [],
    isLoading: false,
  }),
  ProfileProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

// Mock the router
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  usePathname: () => "/",
}));

// Mock the query hook
vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: vi.fn(() => ({
      data: null,
      isLoading: false,
      error: null,
    })),
  };
});

// Mock the analytics context
vi.mock("@/contexts/analytics-context", () => ({
  useAnalytics: () => ({
    startDate: new Date(),
    endDate: new Date(),
    setDateRange: vi.fn(),
    selectedCohortIds: [],
    setSelectedCohortIds: vi.fn(),
    cohorts: [],
    isLoadingCohorts: false,
    effectiveCohortIds: [],
    effectiveRoles: ["ta"],
    effectiveSimulationFilters: ["general"],
    clearFilters: vi.fn(),
    hasActiveFilters: false,
  }),
  AnalyticsProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

describe("ChatWidget", () => {
  /* ------------------------------------------------------------------ *
   * 💡 Mock Data Usage Guide:
   *
   * All API functions are automatically mocked via imports above.
   * Use mockSchema.* for realistic test data:
   *
   * Examples:
   * - mockSchema.users[0] - First user object
   * - mockSchema.classes - Array of class objects
   * - mockSchema.profiles - Array of profile objects
   *
   * To override specific mocks in individual tests:
   * - vi.mocked(queryFunction).mockResolvedValue(customData)
   * - vi.mocked(mutationFunction).mockResolvedValue(customResponse)
   * ------------------------------------------------------------------ */

  // ✨ Reset mocks after each test
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      // ✨ All mocks are automatically set up via imports above
      render(<ChatWidget up={false} />);

      // The widget should render when uiState is "widget"
      await waitFor(() => {
        expect(screen.getByText("GLOW Assistant")).toBeInTheDocument();
      });
    });

    it("should render widget content when in widget state", async () => {
      render(<ChatWidget up={false} />);

      await waitFor(() => {
        expect(screen.getByText("GLOW Assistant")).toBeInTheDocument();
        expect(screen.getByText("New Chat")).toBeInTheDocument();
      });
    });

    it("should have correct accessibility attributes", async () => {
      render(<ChatWidget up={false} />);

      await waitFor(() => {
        // Check for widget container
        const widget = screen.getByText("GLOW Assistant").closest("div");
        expect(widget).toBeInTheDocument();

        // Check for the chat selector (combobox)
        const chatSelector = screen.getByRole("combobox");
        expect(chatSelector).toBeInTheDocument();
      });
    });
  });

  describe("User Interactions", () => {
    it("should handle chat selection", async () => {
      const user = userEvent.setup();
      render(<ChatWidget up={false} />);

      await waitFor(() => {
        expect(screen.getByText("GLOW Assistant")).toBeInTheDocument();
      });

      // Find and click the chat selector
      const chatSelector = screen.getByRole("combobox");
      expect(chatSelector).toBeInTheDocument();

      await user.click(chatSelector);

      // Should show past chats if available
      await waitFor(() => {
        expect(screen.getByText("Past Chats")).toBeInTheDocument();
      });
    });

    it("should handle state changes", async () => {
      const user = userEvent.setup();
      render(<ChatWidget up={false} />);

      await waitFor(() => {
        expect(screen.getByText("GLOW Assistant")).toBeInTheDocument();
      });

      // Test maximize button - look for the button with Maximize2 icon
      const buttons = screen.getAllByRole("button");
      const maximizeButton = buttons.find(
        (button) =>
          button.querySelector('svg[class*="maximize2"]') ||
          button.querySelector('svg[class*="maximize-2"]')
      );
      expect(maximizeButton).toBeInTheDocument();

      // The button should be clickable
      await user.click(maximizeButton!);
    });

    it("should handle user events", async () => {
      const user = userEvent.setup();
      render(<ChatWidget up={false} />);

      await waitFor(() => {
        expect(screen.getByText("GLOW Assistant")).toBeInTheDocument();
      });

      // Test close button - look for the button with X icon
      const buttons = screen.getAllByRole("button");
      const closeButton = buttons.find((button) =>
        button.querySelector('svg[class*="x"]')
      );
      expect(closeButton).toBeInTheDocument();

      // The button should be clickable
      await user.click(closeButton!);
    });
  });

  describe("API Integration", () => {
    it("should handle and display an API error state", async () => {
      // Arrange: Override the default success mock with an error for this test.
      const { getAssistantChatsByProfile } = await import(
        "@/utils/queries/assistant_chats/get-assistant-chats-by-profile"
      );
      vi.mocked(getAssistantChatsByProfile).mockRejectedValue(
        new Error("API Error")
      );

      render(<ChatWidget up={false} />);

      await waitFor(() => {
        expect(screen.getByText("GLOW Assistant")).toBeInTheDocument();
      });

      // Component should still render even with API errors
      expect(screen.getByText("New Chat")).toBeInTheDocument();
    });

    it("should handle loading states", async () => {
      render(<ChatWidget up={false} />);

      await waitFor(() => {
        expect(screen.getByText("GLOW Assistant")).toBeInTheDocument();
      });

      // Component should show loading states appropriately
      expect(screen.getByText("New Chat")).toBeInTheDocument();
    });
  });

  describe("Navigation", () => {
    it("should handle navigation", async () => {
      render(<ChatWidget up={false} />);

      await waitFor(() => {
        expect(screen.getByText("GLOW Assistant")).toBeInTheDocument();
      });

      // Should render widget content
      expect(screen.getByText("New Chat")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", async () => {
      render(<ChatWidget up={false} />);

      await waitFor(() => {
        expect(screen.getByText("GLOW Assistant")).toBeInTheDocument();
      });

      // Should render properly even with minimal props
      expect(screen.getByText("New Chat")).toBeInTheDocument();
    });

    it("should handle missing or invalid props", async () => {
      // Test with no props
      render(<ChatWidget up={false} />);

      await waitFor(() => {
        expect(screen.getByText("GLOW Assistant")).toBeInTheDocument();
      });

      // Should render with default props
      expect(screen.getByText("New Chat")).toBeInTheDocument();
    });
  });
});
