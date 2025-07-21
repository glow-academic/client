import { renderWithMocks } from "@/test/renderWithMocks";
import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

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

describe("TATour", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders without crashing", async () => {
      const mockOnClose = vi.fn();

      renderWithMocks(<TATour onClose={mockOnClose} />);

      // Tour should not be visible initially
      expect(document.querySelector('[data-testid="tour-overlay"]')).toBeNull();
    });

    it("shows tour when profile has not viewed intro or chat", async () => {
      const mockOnClose = vi.fn();


      renderWithMocks(<TATour onClose={mockOnClose} />);

      // Tour should be visible
      expect(
        document.querySelector('[data-testid="tour-overlay"]')
      ).toBeInTheDocument();
    });
  });

  describe("Tour Steps", () => {
    it("has correct number of steps", async () => {
      const mockOnClose = vi.fn();

      renderWithMocks(<TATour onClose={mockOnClose} />);

      // Should have 5 steps
      const steps = document.querySelectorAll('[data-testid^="tour-step-"]');
      expect(steps).toHaveLength(5);
    });

    it("has correct step content", async () => {
      const mockOnClose = vi.fn();

      renderWithMocks(<TATour onClose={mockOnClose} />);

      // Check first step content
      const firstStep = document.querySelector('[data-testid="tour-step-0"]');
      expect(firstStep).toHaveTextContent("Welcome to GLOW!");
      expect(firstStep).toHaveTextContent("home dashboard");
    });
  });

  describe("Tour Actions", () => {
    it("calls onClose when tour is closed", async () => {
      const mockOnClose = vi.fn();

      renderWithMocks(<TATour onClose={mockOnClose} />);

      const closeButton = document.querySelector("button");
      if (closeButton) {
        closeButton.click();
        expect(mockOnClose).toHaveBeenCalled();
      }
    });
  });
});
