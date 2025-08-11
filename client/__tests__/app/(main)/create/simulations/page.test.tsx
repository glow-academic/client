import { render } from '@/test/custom-render';
import { screen } from '@/test/custom-render';
import { describe, expect, it, vi } from "vitest";

// Mock Simulations component
vi.mock("@/components/create/simulations/Simulations", () => ({
  __esModule: true,
  Simulations: () => (
    <div data-testid="simulations-component">Simulations Component</div>
  ),
}));

import SimulationsPage, {
  metadata,
} from "@/app/(main)/create/simulations/page";

describe("SimulationsPage", () => {
  it("renders without crashing", () => {
    render(<SimulationsPage />);
    expect(screen.getByTestId("simulations-component")).toBeInTheDocument();
    expect(screen.getByText("Simulations Component")).toBeInTheDocument();
  });

  it("exports correct metadata", () => {
    expect(metadata).toBeDefined();
    expect(metadata.title).toBe("Simulations");
    expect(metadata.description).toContain("Simulations in GLOW");
  });

  it("renders the Simulations component inside a wrapper", () => {
    render(<SimulationsPage />);
    const wrapper = screen.getByTestId("simulations-component").parentElement;
    expect(wrapper).toHaveClass("space-y-6");
  });
});
