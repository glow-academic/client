import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock Cohorts component
vi.mock("@/components/cohorts/Cohorts", () => ({
  __esModule: true,
  default: () => <div data-testid="cohorts-component">Cohorts Component</div>,
}));

import CohortsPage, { metadata } from "@/app/(main)/cohorts/page";

describe("CohortsPage", () => {
  it("renders without crashing", () => {
    renderWithMocks(<CohortsPage />);
    expect(screen.getByTestId("cohorts-component")).toBeInTheDocument();
    expect(screen.getByText("Cohorts Component")).toBeInTheDocument();
  });

  it("exports correct metadata", () => {
    expect(metadata).toBeDefined();
    expect(metadata.title).toBe("Cohorts");
    expect(metadata.description).toContain("Manage cohorts in GLOW");
  });

  it("renders the Cohorts component inside a wrapper", () => {
    renderWithMocks(<CohortsPage />);
    const wrapper = screen.getByTestId("cohorts-component").parentElement;
    expect(wrapper).toHaveClass("space-y-6");
  });
});
