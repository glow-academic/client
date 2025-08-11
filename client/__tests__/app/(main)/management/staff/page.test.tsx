import { render } from '@/test/custom-render';
import { screen } from '@/test/custom-render';
import { describe, expect, it, vi } from "vitest";

// Mock Staff component
vi.mock("@/components/management/staff/Staff", () => ({
  __esModule: true,
  default: () => <div data-testid="staff-component">Staff Component</div>,
}));

import StaffPage, { metadata } from "@/app/(main)/management/staff/page";

describe("StaffPage", () => {
  it("renders without crashing", () => {
    render(<StaffPage />);
    expect(screen.getByTestId("staff-component")).toBeInTheDocument();
    expect(screen.getByText("Staff Component")).toBeInTheDocument();
  });

  it("exports correct metadata", () => {
    expect(metadata).toBeDefined();
    expect(metadata.title).toBe("Staff");
    expect(metadata.description).toContain("Manage staff in GLOW");
  });

  it("renders the Staff component inside a wrapper", () => {
    render(<StaffPage />);
    const wrapper = screen.getByTestId("staff-component").parentElement;
    expect(wrapper).toHaveClass("space-y-6");
  });
});
