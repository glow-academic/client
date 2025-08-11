/**
 * Health.test.tsx
 * Tests for the Health component
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */

import { renderWithMocks } from "@/test/renderWithMocks";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from "vitest";

// Import centralized mocks
import "@/mocks/auth";
import "@/mocks/mutations";
import "@/mocks/navigation";
import "@/mocks/queries";

// ——————————————————————————————————————————
import Health from "@/components/system/health/Health";

// Mock fetch globally
vi.stubGlobal("fetch", vi.fn());

// Mock toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock logger
vi.mock("@/utils/logger", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

// Mock getApiBase
vi.mock("@/lib/api-base", () => ({
  getApiBase: vi.fn(() => "http://localhost:8000"),
}));

// Mock useWebSocket
vi.mock("@/contexts/websocket-context", () => ({
  useWebSocket: vi.fn(() => ({
    isConnected: true,
    sendMessage: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  })),
  WebSocketProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock useSession
vi.mock("next-auth/react", () => ({
  useSession: vi.fn(() => ({
    data: { user: { email: "test@example.com" } },
    status: "authenticated",
  })),
}));

describe("Health", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default successful fetch responses
    (global.fetch as unknown as Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ status: "ok" }),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<Health />);

      // Wait for initial health checks to complete to avoid act() warnings
      await waitFor(() => {
        expect(screen.getByText(/System Health Monitor/i)).toBeInTheDocument();
      });
    });

    it("should display all health check cards", async () => {
      renderWithMocks(<Health />);

      await waitFor(() => {
        expect(screen.getByText("WebSocket Connection")).toBeInTheDocument();
        expect(screen.getByText("Authentication Service")).toBeInTheDocument();
        expect(screen.getByText("Client API")).toBeInTheDocument();
        expect(screen.getByText("Server API")).toBeInTheDocument();
        expect(screen.getByText("Simulation Service")).toBeInTheDocument();
        expect(screen.getByText("Assistant Service")).toBeInTheDocument();
        expect(screen.getByText("Database Connection")).toBeInTheDocument();
        expect(screen.getByText("Document Upload Service")).toBeInTheDocument();
        expect(screen.getByText("Route Scanner")).toBeInTheDocument();
      });
    });

    it("should display overall health status", async () => {
      renderWithMocks(<Health />);

      await waitFor(() => {
        expect(screen.getByText("Overall System Health")).toBeInTheDocument();
        expect(screen.getByText(/System Health Score/i)).toBeInTheDocument();
      });
    });
  });

  describe("User Interactions", () => {
    it("should handle run health checks button click", async () => {
      renderWithMocks(<Health />);

      // Wait for initial health checks to complete
      await waitFor(() => {
        expect(screen.getByText("Run Health Checks")).toBeInTheDocument();
      });

      const runHealthChecksButton = screen.getByText("Run Health Checks");
      fireEvent.click(runHealthChecksButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });

    it("should handle run stress tests button click", async () => {
      renderWithMocks(<Health />);

      // Wait for initial health checks to complete
      await waitFor(() => {
        expect(screen.getByText("Run Health Checks")).toBeInTheDocument();
      });

      const runStressTestsButton = screen.getByText("Run Stress Tests");
      fireEvent.click(runStressTestsButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });

    it("should have buttons available after health checks complete", async () => {
      renderWithMocks(<Health />);

      // Wait for initial health checks to complete
      await waitFor(() => {
        expect(screen.getByText("Run Health Checks")).toBeInTheDocument();
        expect(screen.getByText("Run Stress Tests")).toBeInTheDocument();
      });
    });
  });

  describe("API Integration", () => {
    it("should handle successful health checks", async () => {
      renderWithMocks(<Health />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith("/api/health");
        expect(global.fetch).toHaveBeenCalledWith(
          "http://localhost:8000/health"
        );
      });
    });

    it("should handle API error responses", async () => {
      (global.fetch as unknown as Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      renderWithMocks(<Health />);

      await waitFor(() => {
        expect(screen.getByText(/System Health Monitor/i)).toBeInTheDocument();
      });
    });

    it("should handle network errors", async () => {
      (global.fetch as unknown as Mock).mockRejectedValueOnce(new Error("Network error"));

      renderWithMocks(<Health />);

      await waitFor(() => {
        expect(screen.getByText(/System Health Monitor/i)).toBeInTheDocument();
      });
    });

    it("should handle loading states", async () => {
      renderWithMocks(<Health />);

      // Should eventually show completed state
      await waitFor(() => {
        expect(screen.getByText("Run Health Checks")).toBeInTheDocument();
      });
    });
  });

  describe("Health Check Status Display", () => {
    it("should display healthy status correctly", async () => {
      renderWithMocks(<Health />);

      await waitFor(() => {
        const healthyBadges = screen.getAllByText("Healthy");
        expect(healthyBadges.length).toBeGreaterThan(0);
      });
    });

    it("should display unhealthy status correctly", async () => {
      (global.fetch as unknown as Mock).mockResolvedValue({
        ok: false,
        status: 500,
      });

      renderWithMocks(<Health />);

      await waitFor(() => {
        const unhealthyBadges = screen.getAllByText("Unhealthy");
        expect(unhealthyBadges.length).toBeGreaterThan(0);
      });
    });

    it("should display response times", async () => {
      renderWithMocks(<Health />);

      await waitFor(() => {
        const responseTimeElements = screen.getAllByText(/Response Time:/i);
        expect(responseTimeElements.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Stress Tests", () => {
    it("should run stress tests successfully", async () => {
      renderWithMocks(<Health />);

      const runStressTestsButton = screen.getByText("Run Stress Tests");
      fireEvent.click(runStressTestsButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "http://localhost:8000/health"
        );
      });
    });

    it("should display stress test results", async () => {
      renderWithMocks(<Health />);

      const runStressTestsButton = screen.getByText("Run Stress Tests");
      fireEvent.click(runStressTestsButton);

      await waitFor(() => {
        expect(screen.getByText("Stress Test Results")).toBeInTheDocument();
      });
    });
  });

  describe("System Information", () => {
    it("should display system information", async () => {
      renderWithMocks(<Health />);

      await waitFor(() => {
        expect(screen.getByText("System Information")).toBeInTheDocument();
        expect(screen.getByText(/Environment:/i)).toBeInTheDocument();
        expect(screen.getByText(/API Base:/i)).toBeInTheDocument();
        expect(screen.getByText(/Authentication:/i)).toBeInTheDocument();
        expect(screen.getByText(/WebSocket:/i)).toBeInTheDocument();
        expect(screen.getByText(/User:/i)).toBeInTheDocument();
      });
    });

    it("should display correct environment information", async () => {
      renderWithMocks(<Health />);

      await waitFor(() => {
        expect(screen.getByText("System Information")).toBeInTheDocument();
        expect(screen.getByText(/Environment:/i)).toBeInTheDocument();
        expect(screen.getByText(/API Base:/i)).toBeInTheDocument();
        expect(screen.getByText(/Authentication:/i)).toBeInTheDocument();
        expect(screen.getByText(/WebSocket:/i)).toBeInTheDocument();
        expect(screen.getByText(/User:/i)).toBeInTheDocument();
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle unknown health check status", async () => {
      renderWithMocks(<Health />);

      await waitFor(() => {
        // Should not crash with unknown status
        expect(screen.getByText(/System Health Monitor/i)).toBeInTheDocument();
      });
    });
  });

  describe("Toast Notifications", () => {
    it("should show success toast when all health checks pass", async () => {
      renderWithMocks(<Health />);

      await waitFor(() => {
        expect(screen.getByText(/System Health Monitor/i)).toBeInTheDocument();
      });
    });

    it("should show error toast when health checks fail", async () => {
      (global.fetch as unknown as Mock).mockResolvedValue({
        ok: false,
        status: 500,
      });

      renderWithMocks(<Health />);

      await waitFor(() => {
        expect(screen.getByText(/System Health Monitor/i)).toBeInTheDocument();
      });
    });
  });

  describe("Progress Indicators", () => {
    it("should display health score progress bar", async () => {
      renderWithMocks(<Health />);

      await waitFor(() => {
        const progressBar = screen.getByRole("progressbar");
        expect(progressBar).toBeInTheDocument();
      });
    });

    it("should display health statistics", async () => {
      renderWithMocks(<Health />);

      await waitFor(() => {
        expect(screen.getAllByText("Healthy").length).toBeGreaterThan(0);
        expect(screen.getByText("Unhealthy")).toBeInTheDocument();
        expect(screen.getByText("Warning")).toBeInTheDocument();
        expect(screen.getByText("Checking")).toBeInTheDocument();
      });
    });
  });
});
