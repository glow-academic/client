import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock Providers component
vi.mock("@/components/management/providers/Providers", () => ({
  __esModule: true,
  default: () => (
    <div data-testid="providers-component">Providers Component</div>
  ),
}));

import ProvidersPage, {
  metadata,
} from "@/app/(main)/management/providers/page";

describe("ProvidersPage", () => {
  it("renders without crashing", () => {
    renderWithMocks(<ProvidersPage />);
    expect(screen.getByTestId("providers-component")).toBeInTheDocument();
    expect(screen.getByText("Providers Component")).toBeInTheDocument();
  });

  it("exports correct metadata", () => {
    expect(metadata).toBeDefined();
    expect(metadata.title).toBe("Providers");
    expect(metadata.description).toContain("Manage AI providers in GLOW");
  });

  it("renders the Providers component inside a wrapper", () => {
    renderWithMocks(<ProvidersPage />);
    const wrapper = screen.getByTestId("providers-component").parentElement;
    expect(wrapper).toHaveClass("space-y-6");
  });
});
