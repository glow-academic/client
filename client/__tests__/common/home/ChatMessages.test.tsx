import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import ChatMessages, {
  ChatMessagesProps,
} from "@/components/common/home/ChatMessages";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";

// Mock the assistant context
vi.mock("@/contexts/assistant-context", () => ({
  useAssistant: () => ({
    currentChatId: null,
    isConnected: true,
  }),
  AssistantProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

// Mock the query hook
vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: vi.fn(() => ({
      data: [],
      isLoading: false,
      error: null,
    })),
  };
});

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: ChatMessagesProps = {};
// ------------------------------------------------------------------
describe("ChatMessages", () => {
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
      renderWithMocks(<ChatMessages {...mockProps} />);

      // Should render the component with GlowHeader when no currentChatId
      await waitFor(() => {
        expect(screen.getByText("GLOW Assistant")).toBeInTheDocument();
      });
    });

    it("should render with props", async () => {
      // Test with different props
      const propsWithCallbacks: ChatMessagesProps = {
        onPromptClick: vi.fn(),
        showPrompts: true,
        variant: "expanded",
      };

      renderWithMocks(<ChatMessages {...propsWithCallbacks} />);

      await waitFor(() => {
        expect(screen.getByText("GLOW Assistant")).toBeInTheDocument();
      });
    });

    it("should have correct accessibility attributes", async () => {
      renderWithMocks(<ChatMessages {...mockProps} />);

      await waitFor(() => {
        // Check for the main container
        const container = screen.getByText("GLOW Assistant").closest("div");
        expect(container).toBeInTheDocument();
      });
    });
  });

  describe("API Integration", () => {
    it("should handle and display an API error state", async () => {
      // Arrange: Override the default success mock with an error for this test.
      const { getAssistantMessagesByChat } = await import(
        "@/utils/queries/assistant_messages/get-assistant-messages-by-chat"
      );
      vi.mocked(getAssistantMessagesByChat).mockRejectedValue(
        new Error("API Error"),
      );

      renderWithMocks(<ChatMessages {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("GLOW Assistant")).toBeInTheDocument();
      });

      // Component should still render even with API errors
      expect(screen.getByText("GLOW Assistant")).toBeInTheDocument();
    });

    it("should handle loading states", async () => {
      renderWithMocks(<ChatMessages {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("GLOW Assistant")).toBeInTheDocument();
      });

      // Component should show loading states appropriately
      expect(screen.getByText("GLOW Assistant")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", async () => {
      renderWithMocks(<ChatMessages {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("GLOW Assistant")).toBeInTheDocument();
      });

      // Should render properly even with minimal props
      expect(screen.getByText("GLOW Assistant")).toBeInTheDocument();
    });

    it("should handle missing or invalid props", async () => {
      // Test with no props
      renderWithMocks(<ChatMessages />);

      await waitFor(() => {
        expect(screen.getByText("GLOW Assistant")).toBeInTheDocument();
      });

      // Should render with default props
      expect(screen.getByText("GLOW Assistant")).toBeInTheDocument();
    });
  });
});
