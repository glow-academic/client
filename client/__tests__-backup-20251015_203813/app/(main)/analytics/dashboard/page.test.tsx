import { render } from "@/test/custom-render";
import { screen } from "@/test/custom-render";
import { describe, expect, it, vi } from "vitest";

// Mock Dashboard component
vi.mock("@/components/analytics/Dashboard", () => ({
  __esModule: true,
  default: () => (
    <div data-testid="dashboard-component">Dashboard Component</div>
  ),
}));

import DashboardPage, { metadata } from "@/app/(main)/analytics/dashboard/page";

describe("DashboardPage", () => {
  it("renders without crashing", () => {
    render(<DashboardPage />);
    expect(screen.getByTestId("dashboard-component")).toBeInTheDocument();
    expect(screen.getByText("Dashboard Component")).toBeInTheDocument();
  });

  it("exports correct metadata", () => {
    expect(metadata).toBeDefined();
    expect(metadata.title).toBe("Dashboard");
    expect(metadata.description).toContain("Dashboard in GLOW");
  });

  it("renders the Dashboard component inside a wrapper", () => {
    render(<DashboardPage />);
    const wrapper = screen.getByTestId("dashboard-component").parentElement;
    expect(wrapper).toHaveClass("space-y-6");
  });
});
