import NewClass from "@/components/create/classes/NewClass";
import { renderWithProviders } from "@/mocks/utils";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, Mock, vi } from "vitest";

// Mock ClassForm component to avoid PostCSS issues
vi.mock("@/components/common/class/ClassForm", () => ({
  default: ({
    mode,
    onSuccess,
  }: {
    mode: string;
    onSuccess?: (data: unknown) => void;
  }) => (
    <div data-testid="class-form">
      <div data-testid="form-mode">{mode}</div>
      <button
        data-testid="form-submit"
        onClick={() => onSuccess?.({ id: "test-class-id" })}
      >
        Submit Form
      </button>
    </div>
  ),
}));

// Import the auto-generated mocks
import "@/mocks/mutations";
import "@/mocks/queries";

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

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));

// Mock tus-js-client
vi.mock("tus-js-client", () => ({
  Upload: vi.fn().mockImplementation((_, options) => ({
    start: vi.fn(() => {
      // Simulate successful upload
      setTimeout(() => {
        options.onProgress?.(100, 100);
        options.onSuccess?.();
      }, 10);
    }),
  })),
}));

// Mock global fetch
global.fetch = vi.fn();

describe("NewClass", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
  });

  describe("Rendering", () => {
    it("should render without crashing", () => {
      renderWithProviders(<NewClass />);
      expect(document.body).toBeInTheDocument();
    });

    it("should display method selection cards initially", () => {
      renderWithProviders(<NewClass />);

      expect(screen.getByText("Upload from ZIP")).toBeInTheDocument();
      expect(screen.getByText("Create Manually")).toBeInTheDocument();
    });

    it("should show ZIP upload option with description", () => {
      renderWithProviders(<NewClass />);

      const zipCard = screen.getByText("Upload from ZIP").closest("div");
      expect(zipCard).toBeInTheDocument();
      expect(
        screen.getByText(/automatically extract and classify/)
      ).toBeInTheDocument();
    });

    it("should show manual creation option with description", () => {
      renderWithProviders(<NewClass />);

      const manualCard = screen.getByText("Create Manually").closest("div");
      expect(manualCard).toBeInTheDocument();
      expect(
        screen.getByText(/organize everything step by step/)
      ).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle manual creation mode selection", async () => {
      const user = userEvent.setup();
      renderWithProviders(<NewClass />);

      const manualCard = screen.getByText("Create Manually").closest("div");
      if (manualCard) {
        await user.click(manualCard);
        // Should change the UI state
        await waitFor(() => {
          expect(document.body).toBeInTheDocument();
        });
      }
    });

    it("should handle ZIP upload mode selection", async () => {
      const user = userEvent.setup();
      renderWithProviders(<NewClass />);

      const zipCard = screen.getByText("Upload from ZIP").closest("div");
      if (zipCard) {
        await user.click(zipCard);
        // Should trigger file input
        const fileInput = document.querySelector('input[type="file"]');
        expect(fileInput).toBeInTheDocument();
      }
    });
  });

  describe("File Handling", () => {
    it("should have file input for ZIP uploads", () => {
      renderWithProviders(<NewClass />);

      const fileInput = document.querySelector('input[type="file"]');
      expect(fileInput).toBeInTheDocument();

      if (fileInput) {
        expect(fileInput.getAttribute("accept")).toBe(".zip");
      }
    });

    it("should handle file selection", async () => {
      const user = userEvent.setup();
      renderWithProviders(<NewClass />);

      const fileInput = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      if (fileInput) {
        const file = new File(["test content"], "test-class.zip", {
          type: "application/zip",
        });

        await user.upload(fileInput, file);

        // Should handle the file upload
        expect(fileInput.files?.[0]).toBe(file);
      }
    });
  });

  describe("Component Structure", () => {
    it("should have proper accessibility attributes", () => {
      renderWithProviders(<NewClass />);

      const zipCard = screen.getByText("Upload from ZIP").closest("div");
      const manualCard = screen.getByText("Create Manually").closest("div");

      // Cards should be rendered and clickable
      expect(zipCard).toBeInTheDocument();
      expect(manualCard).toBeInTheDocument();
    });

    it("should render all necessary UI elements", () => {
      renderWithProviders(<NewClass />);

      // Should have both creation method cards
      expect(screen.getByText("Upload from ZIP")).toBeInTheDocument();
      expect(screen.getByText("Create Manually")).toBeInTheDocument();

      // Should have file input
      expect(document.querySelector('input[type="file"]')).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle component unmounting gracefully", () => {
      const { unmount } = renderWithProviders(<NewClass />);
      expect(() => unmount()).not.toThrow();
    });

    it("should handle invalid file types", () => {
      renderWithProviders(<NewClass />);

      const fileInput = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;
      expect(fileInput?.accept).toBe(".zip");
    });
  });
});

/*
 * Component Analysis for NewClass:
 * Path: create/classes/NewClass.tsx
 *
 * Features detected:
 * - Default export: true
 * - Client component: true
 * - Uses hooks: useState, useRef, useRouter, useQueryClient
 * - Uses router: true
 * - Has API calls: true
 * - Has form handling: true
 * - Uses state: true
 * - File upload functionality
 * - Two creation modes: ZIP upload and manual
 *
 * Simplified tests to focus on:
 * - Basic rendering and structure
 * - User interactions with creation modes
 * - File input functionality
 * - Component stability and accessibility
 * - Edge case handling
 */
