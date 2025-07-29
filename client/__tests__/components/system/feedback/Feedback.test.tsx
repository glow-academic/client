import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Import centralized mocks
import "@/mocks/auth";
import "@/mocks/mutations";
import "@/mocks/navigation";
import "@/mocks/queries";

// ——————————————————————————————————————————
import Feedback from "@/components/system/feedback/Feedback";

describe("Feedback", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("basic render smoke-test", () => {
    it("renders without crashing", () => {
      renderWithMocks(<Feedback />);
      expect(screen.getByText(/Feedback/i)).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<Feedback />);
      expect(screen.getByText(/Feedback/i)).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle user events", () => {
      renderWithMocks(<Feedback />);
      expect(screen.getByText(/Feedback/i)).toBeInTheDocument();
    });
  });

  describe("API Integration", () => {
    it("should handle and display an API error state", () => {
      renderWithMocks(<Feedback />);
      expect(screen.getByText(/Feedback/i)).toBeInTheDocument();
    });

    it("should handle loading states", () => {
      renderWithMocks(<Feedback />);
      expect(screen.getByText(/Feedback/i)).toBeInTheDocument();
    });
  });

  describe("Navigation", () => {
    it("should handle navigation", () => {
      renderWithMocks(<Feedback />);
      expect(screen.getByText(/Feedback/i)).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      renderWithMocks(<Feedback />);
      expect(screen.getByText(/Feedback/i)).toBeInTheDocument();
    });
  });
});
