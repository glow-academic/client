import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock NewCohort component
vi.mock("@/components/cohorts/NewCohort", () => ({
  __esModule: true,
  default: () => (
    <div data-testid="new-cohort-component">New Cohort Component</div>
  ),
}));

import NewCohortPage, { metadata } from "@/app/(main)/cohorts/new/page";

describe("NewCohortPage", () => {
  it("renders without crashing", () => {
    renderWithMocks(<NewCohortPage />);
    expect(screen.getByTestId("new-cohort-component")).toBeInTheDocument();
    expect(screen.getByText("New Cohort Component")).toBeInTheDocument();
  });

  it("exports correct metadata", () => {
    expect(metadata).toBeDefined();
    expect(metadata.title).toBe("Cohorts");
    expect(metadata.description).toContain("Create new cohorts in GLOW");
  });

  it("renders the NewCohort component inside a wrapper", () => {
    renderWithMocks(<NewCohortPage />);
    const wrapper = screen.getByTestId("new-cohort-component").parentElement;
    expect(wrapper).toHaveClass("space-y-6");
  });
});
