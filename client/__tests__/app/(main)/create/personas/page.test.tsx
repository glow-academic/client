import { render } from '@/test/custom-render';
import { screen } from '@/test/custom-render';
import { describe, expect, it, vi } from "vitest";

// Mock Personas component
vi.mock("@/components/create/personas/Personas", () => ({
  __esModule: true,
  default: () => <div data-testid="personas-component">Personas Component</div>,
}));

import PersonasPage, { metadata } from "@/app/(main)/create/personas/page";

describe("PersonasPage", () => {
  it("renders without crashing", () => {
    render(<PersonasPage />);
    expect(screen.getByTestId("personas-component")).toBeInTheDocument();
    expect(screen.getByText("Personas Component")).toBeInTheDocument();
  });

  it("exports correct metadata", () => {
    expect(metadata).toBeDefined();
    expect(metadata.title).toBe("Personas");
    expect(metadata.description).toContain("Personas in GLOW");
  });

  it("renders the Personas component inside a wrapper", () => {
    render(<PersonasPage />);
    const wrapper = screen.getByTestId("personas-component").parentElement;
    expect(wrapper).toHaveClass("space-y-6");
  });
});
