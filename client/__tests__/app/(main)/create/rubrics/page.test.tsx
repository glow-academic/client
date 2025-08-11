import { render } from '@/test/custom-render';
import { screen } from '@/test/custom-render';
import { describe, expect, it, vi } from "vitest";

// Mock Rubrics component
vi.mock("@/components/create/rubrics/Rubrics", () => ({
  __esModule: true,
  default: () => <div data-testid="rubrics-component">Rubrics Component</div>,
}));

import RubricsPage, { metadata } from "@/app/(main)/create/rubrics/page";

describe("RubricsPage", () => {
  it("renders without crashing", () => {
    render(<RubricsPage />);
    expect(screen.getByTestId("rubrics-component")).toBeInTheDocument();
    expect(screen.getByText("Rubrics Component")).toBeInTheDocument();
  });

  it("exports correct metadata", () => {
    expect(metadata).toBeDefined();
    expect(metadata.title).toBe("Rubrics");
    expect(metadata.description).toContain("Rubrics in GLOW");
  });

  it("renders the Rubrics component inside a wrapper", () => {
    render(<RubricsPage />);
    const wrapper = screen.getByTestId("rubrics-component").parentElement;
    expect(wrapper).toHaveClass("space-y-6");
  });
});
