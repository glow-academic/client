import { render } from '@/test/custom-render';
import { screen } from '@/test/custom-render';
import { describe, expect, it, vi } from "vitest";

// Mock Home component
vi.mock("@/components/home/Home", () => ({
  __esModule: true,
  default: () => <div data-testid="home-component">Home Component</div>,
}));

import HomePage, { metadata } from "@/app/(main)/home/page";

describe("HomePage", () => {
  it("renders without crashing", () => {
    render(<HomePage />);
    expect(screen.getByTestId("home-component")).toBeInTheDocument();
    expect(screen.getByText("Home Component")).toBeInTheDocument();
  });

  it("exports correct metadata", () => {
    expect(metadata).toBeDefined();
    expect(metadata.title).toBe("Home");
    expect(metadata.description).toContain("Home page for GLOW");
  });

  it("renders the Home component inside a wrapper", () => {
    render(<HomePage />);
    const wrapper = screen.getByTestId("home-component").parentElement;
    expect(wrapper).toHaveClass("space-y-6");
  });
});
