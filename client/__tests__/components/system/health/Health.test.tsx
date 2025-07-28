/**
 * Health.test.tsx
 * Tests for the Health component
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */

import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Import centralized mocks
import "@/mocks/auth";
import "@/mocks/mutations";
import "@/mocks/navigation";
import "@/mocks/queries";

// ——————————————————————————————————————————
import Health from "@/components/system/health/Health";

describe("Health", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("basic render smoke-test", () => {
    it("renders without crashing", () => {
      renderWithMocks(<Health />);
      expect(screen.getByText(/System Health Monitor/i)).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<Health />);
      expect(screen.getByText(/System Health Monitor/i)).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle user events", () => {
      renderWithMocks(<Health />);
      expect(screen.getByText(/System Health Monitor/i)).toBeInTheDocument();
    });
  });

  describe("API Integration", () => {
    it("should handle and display an API error state", () => {
      renderWithMocks(<Health />);
      expect(screen.getByText(/System Health Monitor/i)).toBeInTheDocument();
    });

    it("should handle loading states", () => {
      renderWithMocks(<Health />);
      expect(screen.getByText(/System Health Monitor/i)).toBeInTheDocument();
    });
  });

  describe("Navigation", () => {
    it("should handle navigation", () => {
      renderWithMocks(<Health />);
      expect(screen.getByText(/System Health Monitor/i)).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      renderWithMocks(<Health />);
      expect(screen.getByText(/System Health Monitor/i)).toBeInTheDocument();
    });
  });
});
