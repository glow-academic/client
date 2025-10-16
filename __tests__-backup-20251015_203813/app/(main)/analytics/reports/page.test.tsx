import { render } from "@/test/custom-render";
import { screen } from "@/test/custom-render";
import { describe, expect, it, vi } from "vitest";

// Mock Reports component
vi.mock("@/components/analytics/report/Reports", () => ({
  __esModule: true,
  default: () => <div data-testid="reports-component">Reports Component</div>,
}));

import ReportsPage, { metadata } from "@/app/(main)/analytics/reports/page";

describe("ReportsPage", () => {
  it("renders without crashing", () => {
    render(<ReportsPage />);
    expect(screen.getByTestId("reports-component")).toBeInTheDocument();
    expect(screen.getByText("Reports Component")).toBeInTheDocument();
  });

  it("exports correct metadata", () => {
    expect(metadata).toBeDefined();
    expect(metadata.title).toBe("Reports");
    expect(metadata.description).toContain("Reports in GLOW");
  });

  it("renders the Reports component inside a wrapper", () => {
    render(<ReportsPage />);
    const wrapper = screen.getByTestId("reports-component").parentElement;
    expect(wrapper).toHaveClass("space-y-6");
  });
});
