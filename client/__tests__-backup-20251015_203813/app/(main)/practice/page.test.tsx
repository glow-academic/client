import { render } from "@/test/custom-render";
import { screen } from "@/test/custom-render";
import { describe, expect, it, vi } from "vitest";

// Mock Practice component
vi.mock("@/components/practice/Practice", () => ({
  __esModule: true,
  default: () => <div data-testid="practice-component">Practice Component</div>,
}));

import PracticePage, { metadata } from "@/app/(main)/practice/page";

describe("PracticePage", () => {
  it("renders without crashing", () => {
    render(<PracticePage />);
    expect(screen.getByTestId("practice-component")).toBeInTheDocument();
    expect(screen.getByText("Practice Component")).toBeInTheDocument();
  });

  it("exports correct metadata", () => {
    expect(metadata).toBeDefined();
    expect(metadata.title).toBe("Practice");
    expect(metadata.description).toContain("Practice page for GLOW");
  });

  it("renders the Practice component inside a wrapper", () => {
    render(<PracticePage />);
    const wrapper = screen.getByTestId("practice-component").parentElement;
    expect(wrapper).toHaveClass("space-y-6");
  });
});
