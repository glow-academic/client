import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock NewRubric component
vi.mock("@/components/create/rubrics/NewRubric", () => ({
  __esModule: true,
  default: () => (
    <div data-testid="new-rubric-component">New Rubric Component</div>
  ),
}));

import NewRubricPage, { metadata } from "@/app/(main)/create/rubrics/new/page";

describe("NewRubricPage", () => {
  it("renders without crashing", () => {
    renderWithMocks(<NewRubricPage />);
    expect(screen.getByTestId("new-rubric-component")).toBeInTheDocument();
    expect(screen.getByText("New Rubric Component")).toBeInTheDocument();
  });

  it("exports correct metadata", () => {
    expect(metadata).toBeDefined();
    expect(metadata.title).toBe("New Rubric");
    expect(metadata.description).toContain("New rubric creation page");
  });

  it("renders the NewRubric component inside a wrapper", () => {
    renderWithMocks(<NewRubricPage />);
    const wrapper = screen.getByTestId("new-rubric-component").parentElement;
    expect(wrapper).toHaveClass("space-y-6");
  });
});
