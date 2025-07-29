import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock Agents component
vi.mock("@/components/system/agents/Agents", () => ({
  __esModule: true,
  default: () => <div data-testid="agents-component">Agents Component</div>,
}));

import AgentsPage, { metadata } from "@/app/(main)/system/agents/page";

describe("AgentsPage", () => {
  it("renders without crashing", () => {
    renderWithMocks(<AgentsPage />);
    expect(screen.getByTestId("agents-component")).toBeInTheDocument();
    expect(screen.getByText("Agents Component")).toBeInTheDocument();
  });

  it("exports correct metadata", () => {
    expect(metadata).toBeDefined();
    expect(metadata.title).toBe("Agents");
    expect(metadata.description).toContain("Agents in GLOW");
  });

  it("renders the Agents component inside a wrapper", () => {
    renderWithMocks(<AgentsPage />);
    const wrapper = screen.getByTestId("agents-component").parentElement;
    expect(wrapper).toHaveClass("space-y-6");
  });
});
