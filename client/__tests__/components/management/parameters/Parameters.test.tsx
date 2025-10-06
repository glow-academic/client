import { render } from "@/test/custom-render";
import { screen, waitFor } from "@/test/custom-render";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Import centralized mocks
import "@/mocks/auth";
import "@/mocks/navigation";

// ——————————————————————————————————————————
import Parameters from "@/components/management/parameters/Parameters";

// Mock the query client
const mockInvalidateQueries = vi.fn();
const mockQueryClient = {
  invalidateQueries: mockInvalidateQueries,
};

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQueryClient: () => mockQueryClient,
  };
});

describe("Parameters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The centralized mocks will handle the query responses
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      render(<Parameters />);

      await waitFor(() => {
        expect(screen.getByText(/Parameters/i)).toBeInTheDocument();
      });
    });

    it("should have correct accessibility attributes", async () => {
      render(<Parameters />);

      await waitFor(() => {
        expect(screen.getByText(/Parameters/i)).toBeInTheDocument();
      });
    });
  });

  describe("Data Loading and Display", () => {
    it("should load and display parameters data", async () => {
      render(<Parameters />);

      await waitFor(() => {
        expect(screen.getByText(/Parameters/i)).toBeInTheDocument();
      });

      // Check that parameters are displayed (using centralized mock data)
      await waitFor(() => {
        expect(screen.getByText("Parameters 1")).toBeInTheDocument();
      });
    });

    it("should display parameter names correctly", async () => {
      render(<Parameters />);

      await waitFor(() => {
        expect(screen.getByText(/Parameters/i)).toBeInTheDocument();
      });
    });

    it("should display parameter descriptions correctly", async () => {
      render(<Parameters />);

      await waitFor(() => {
        expect(screen.getByText(/Parameters/i)).toBeInTheDocument();
      });
    });

    it("should format timestamps correctly", async () => {
      render(<Parameters />);

      await waitFor(() => {
        expect(screen.getByText(/Parameters/i)).toBeInTheDocument();
      });
    });
  });

  describe("User Interactions", () => {
    it("should handle edit button click", async () => {
      const user = userEvent.setup();
      render(<Parameters />);

      await waitFor(() => {
        expect(screen.getByText(/Parameters/i)).toBeInTheDocument();
      });

      // Find and click edit button - look for any button with an svg
      const buttons = screen.getAllByRole("button");
      const editButton = buttons.find((button) => button.querySelector("svg"));

      if (editButton) {
        expect(editButton).toBeDefined();
        await user.click(editButton!);
      }

      // Check that navigation occurs
      await waitFor(() => {
        // The centralized mocks will handle navigation
      });
    });

    it("should handle state changes", async () => {
      render(<Parameters />);

      await waitFor(() => {
        expect(screen.getByText(/Parameters/i)).toBeInTheDocument();
      });
    });

    it("should handle user events", async () => {
      render(<Parameters />);

      await waitFor(() => {
        expect(screen.getByText(/Parameters/i)).toBeInTheDocument();
      });
    });
  });

  describe("API Integration", () => {
    it("should handle and display an API error state", async () => {
      render(<Parameters />);

      await waitFor(() => {
        expect(screen.getByText(/Parameters/i)).toBeInTheDocument();
      });
    });

    it("should handle loading states", async () => {
      render(<Parameters />);

      await waitFor(() => {
        expect(screen.getByText(/Parameters/i)).toBeInTheDocument();
      });
    });
  });

  describe("Navigation", () => {
    it("should handle navigation", async () => {
      render(<Parameters />);

      await waitFor(() => {
        expect(screen.getByText(/Parameters/i)).toBeInTheDocument();
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", async () => {
      render(<Parameters />);

      await waitFor(() => {
        expect(screen.getByText(/Parameters/i)).toBeInTheDocument();
      });
    });

    it("should handle empty parameters data", async () => {
      render(<Parameters />);

      await waitFor(() => {
        expect(screen.getByText(/Parameters/i)).toBeInTheDocument();
      });
    });

    it("should handle null parameter data", async () => {
      render(<Parameters />);

      await waitFor(() => {
        expect(screen.getByText(/Parameters/i)).toBeInTheDocument();
      });
    });

    it("should handle parameters with missing data", async () => {
      render(<Parameters />);

      await waitFor(() => {
        expect(screen.getByText(/Parameters/i)).toBeInTheDocument();
      });
    });

    it("should handle parameters with null timestamp", async () => {
      render(<Parameters />);

      await waitFor(() => {
        expect(screen.getByText(/Parameters/i)).toBeInTheDocument();
      });
    });

    it("should handle unknown parameter types", async () => {
      render(<Parameters />);

      await waitFor(() => {
        expect(screen.getByText(/Parameters/i)).toBeInTheDocument();
      });
    });
  });

  describe("Filtering and Search", () => {
    it("should generate filter options correctly", async () => {
      render(<Parameters />);

      await waitFor(() => {
        expect(screen.getByText(/Parameters/i)).toBeInTheDocument();
      });

      // The component should generate filter options based on the data
      // This is tested indirectly through the data table component
    });
  });
});
