import { render } from '@/test/custom-render';
import { screen } from '@/test/custom-render';
import { describe, expect, it, vi } from "vitest";

// Mock Scenarios component
vi.mock("@/components/create/scenarios/Scenarios", () => ({
  __esModule: true,
  Scenarios: () => (
    <div data-testid="scenarios-component">Scenarios Component</div>
  ),
}));

import ScenariosPage, { metadata } from "@/app/(main)/create/scenarios/page";

describe("ScenariosPage", () => {
  it("renders without crashing", () => {
    render(<ScenariosPage />);
    expect(screen.getByTestId("scenarios-component")).toBeInTheDocument();
    expect(screen.getByText("Scenarios Component")).toBeInTheDocument();
  });

  it("exports correct metadata", () => {
    expect(metadata).toBeDefined();
    expect(metadata.title).toBe("Scenarios");
    expect(metadata.description).toContain("Scenarios in GLOW");
  });

  it("renders the Scenarios component inside a wrapper", () => {
    render(<ScenariosPage />);
    const wrapper = screen.getByTestId("scenarios-component").parentElement;
    expect(wrapper).toHaveClass("space-y-6");
  });
});
