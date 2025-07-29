import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock NewStaff component
vi.mock("@/components/management/staff/NewStaff", () => ({
  __esModule: true,
  default: () => (
    <div data-testid="new-staff-component">New Staff Component</div>
  ),
}));

import NewStaffPage, { metadata } from "@/app/(main)/management/staff/new/page";

describe("NewStaffPage", () => {
  it("renders without crashing", () => {
    renderWithMocks(<NewStaffPage />);
    expect(screen.getByTestId("new-staff-component")).toBeInTheDocument();
    expect(screen.getByText("New Staff Component")).toBeInTheDocument();
  });

  it("exports correct metadata", () => {
    expect(metadata).toBeDefined();
    expect(metadata.title).toBe("New Staff");
    expect(metadata.description).toContain("Create a new staff in GLOW");
  });

  it("renders the NewStaff component inside a wrapper", () => {
    renderWithMocks(<NewStaffPage />);
    const wrapper = screen.getByTestId("new-staff-component").parentElement;
    expect(wrapper).toHaveClass("space-y-6");
  });
});
