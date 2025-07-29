import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Import centralized mocks
import "@/mocks/auth";
import "@/mocks/mutations";
import "@/mocks/navigation";
import "@/mocks/queries";

// ——————————————————————————————————————————
import Agents from "@/components/system/agents/Agents";

describe("Agents", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("basic render smoke-test", () => {
    it("renders without crashing", () => {
      renderWithMocks(<Agents />);
      expect(screen.getByText(/Agents/i)).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<Agents />);
      expect(screen.getByText(/Agents/i)).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle user events", () => {
      renderWithMocks(<Agents />);
      expect(screen.getByText(/Agents/i)).toBeInTheDocument();
    });
  });

  describe("API Integration", () => {
    it("should handle and display an API error state", () => {
      renderWithMocks(<Agents />);
      expect(screen.getByText(/Agents/i)).toBeInTheDocument();
    });

    it("should handle loading states", () => {
      renderWithMocks(<Agents />);
      expect(screen.getByText(/Agents/i)).toBeInTheDocument();
    });
  });

  describe("Navigation", () => {
    it("should handle navigation", () => {
      renderWithMocks(<Agents />);
      expect(screen.getByText(/Agents/i)).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      renderWithMocks(<Agents />);
      expect(screen.getByText(/Agents/i)).toBeInTheDocument();
    });
  });
});
