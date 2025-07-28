import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock Health component
vi.mock("@/components/system/health/Health", () => ({
  __esModule: true,
  default: () => <div data-testid="health-component">Health Component</div>,
}));

import HealthPage, { metadata } from "@/app/(main)/system/health/page";

describe("HealthPage", () => {
  it("renders without crashing", () => {
    renderWithMocks(<HealthPage />);
    expect(screen.getByTestId("health-component")).toBeInTheDocument();
    expect(screen.getByText("Health Component")).toBeInTheDocument();
  });

  it("exports correct metadata", () => {
    expect(metadata).toBeDefined();
    expect(metadata.title).toBe("System Health");
    expect(metadata.description).toBe("Monitor system health and performance");
  });

  it("renders the Health component directly without wrapper", () => {
    renderWithMocks(<HealthPage />);
    const component = screen.getByTestId("health-component");
    // Health page doesn't use the space-y-6 wrapper like other pages
    expect(component.parentElement).not.toHaveClass("space-y-6");
  });
});
