import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock Feedback component
vi.mock("@/components/system/feedback/Feedback", () => ({
  __esModule: true,
  default: () => <div data-testid="feedback-component">Feedback Component</div>,
}));

import FeedbackPage, { metadata } from "@/app/(main)/system/feedback/page";

describe("FeedbackPage", () => {
  it("renders without crashing", () => {
    renderWithMocks(<FeedbackPage />);
    expect(screen.getByTestId("feedback-component")).toBeInTheDocument();
    expect(screen.getByText("Feedback Component")).toBeInTheDocument();
  });

  it("exports correct metadata", () => {
    expect(metadata).toBeDefined();
    expect(metadata.title).toBe("Feedback");
    expect(metadata.description).toContain("Manage feedback in GLOW");
  });

  it("renders the Feedback component inside a wrapper", () => {
    renderWithMocks(<FeedbackPage />);
    const wrapper = screen.getByTestId("feedback-component").parentElement;
    expect(wrapper).toHaveClass("space-y-6");
  });
});
