import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import NewScenario from "@/components/create/scenarios/NewScenario";

// Mock external dependencies
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
  })),
  usePathname: vi.fn(() => "/"),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

// Mock API calls
vi.mock("@/utils/mutations/scenarios/create-scenario", () => ({
  createScenario: vi.fn(),
}));

// Mock toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("NewScenario", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  const renderWithProviders = (ui: React.ReactElement, options = {}) => {
    const AllProviders = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    return render(ui, { wrapper: AllProviders, ...options });
  };

  describe("Rendering", () => {
    it("should render without crashing", () => {
      renderWithProviders(<NewScenario />);

      expect(screen.getByText("Create Scenario")).toBeInTheDocument();
      expect(
        screen.getByText("Create a new conversation scenario"),
      ).toBeInTheDocument();
    });

    it("should render create mode form", () => {
      renderWithProviders(<NewScenario />);

      expect(screen.getByLabelText(/scenario name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /create scenario/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /cancel/i }),
      ).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithProviders(<NewScenario />);

      const nameInput = screen.getByLabelText(/scenario name/i);
      const descriptionTextarea = screen.getByLabelText(/description/i);

      expect(nameInput).toHaveAttribute("required");
      expect(nameInput).toHaveAttribute(
        "placeholder",
        "e.g., Office Hours Help Session",
      );
      expect(descriptionTextarea).toHaveAttribute(
        "placeholder",
        "Describe the scenario context, setting, and expected interactions",
      );
    });
  });

  describe("User Interactions", () => {
    it("should handle form input changes", async () => {
      const user = userEvent.setup();
      renderWithProviders(<NewScenario />);

      const nameInput = screen.getByLabelText(/scenario name/i);
      const descriptionTextarea = screen.getByLabelText(/description/i);

      await user.type(nameInput, "Test Scenario");
      await user.type(descriptionTextarea, "Test Description");

      expect(nameInput).toHaveValue("Test Scenario");
      expect(descriptionTextarea).toHaveValue("Test Description");
    });

    it("should validate required fields", async () => {
      const { toast } = await import("sonner");
      const user = userEvent.setup();
      renderWithProviders(<NewScenario />);

      const submitButton = screen.getByRole("button", {
        name: /create scenario/i,
      });
      await user.click(submitButton);

      expect(toast.error).toHaveBeenCalledWith("Scenario name is required");
    });
  });

  describe("Component Integration", () => {
    it("should use Scenario component in create mode", () => {
      renderWithProviders(<NewScenario />);

      // Verify it's in create mode by checking for create-specific text
      expect(screen.getByText("Create Scenario")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Define the context and setting for this conversation scenario.",
        ),
      ).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle form submission with valid data", async () => {
      const { createScenario } = await import(
        "@/utils/mutations/scenarios/create-scenario"
      );
      (createScenario as any).mockResolvedValue({ id: "new-scenario-id" });

      const user = userEvent.setup();
      renderWithProviders(<NewScenario />);

      const nameInput = screen.getByLabelText(/scenario name/i);
      const descriptionTextarea = screen.getByLabelText(/description/i);
      const submitButton = screen.getByRole("button", {
        name: /create scenario/i,
      });

      await user.type(nameInput, "Test Scenario");
      await user.type(descriptionTextarea, "Test Description");
      await user.click(submitButton);

      // The component should call createScenario with the form data
      expect(createScenario).toHaveBeenCalledWith({
        name: "Test Scenario",
        description: "Test Description",
        agentId: "11111111-aaaa-aaaa-aaaa-111111111111",
        crowdedness: 1,
        intensity: 1,
        seniority: "freshman",
      });
    });
  });
});

/*
 * Component Analysis for NewScenario:
 * Path: create/scenarios/NewScenario.tsx
 *
 * Features detected:
 * - Default export: true
 * - Named exports: None
 * - Has props: false (wrapper component)
 * - Props interface: None (uses Scenario component internally)
 * - Client component: false (but wraps a client component)
 * - Uses hooks: None directly (delegates to Scenario component)
 * - Uses router: false directly (delegates to Scenario component)
 * - Has API calls: false directly (delegates to Scenario component)
 * - Has form handling: false directly (delegates to Scenario component)
 * - Uses state: false directly (delegates to Scenario component)
 * - Uses effects: false directly (delegates to Scenario component)
 * - Uses context: false
 *
 * This component is now a simple wrapper around the general Scenario component
 * configured for create mode.
 */
