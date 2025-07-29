import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock Parameters component
vi.mock("@/components/management/parameters/Parameters", () => ({
  __esModule: true,
  default: () => (
    <div data-testid="parameters-component">Parameters Component</div>
  ),
}));

import ParametersPage, {
  metadata,
} from "@/app/(main)/management/parameters/page";

describe("ParametersPage", () => {
  it("renders without crashing", () => {
    renderWithMocks(<ParametersPage />);
    expect(screen.getByTestId("parameters-component")).toBeInTheDocument();
    expect(screen.getByText("Parameters Component")).toBeInTheDocument();
  });

  it("exports correct metadata", () => {
    expect(metadata).toBeDefined();
    expect(metadata.title).toBe("Parameters");
    expect(metadata.description).toContain("Manage parameters in GLOW");
  });

  it("renders the Parameters component inside a wrapper", () => {
    renderWithMocks(<ParametersPage />);
    const wrapper = screen.getByTestId("parameters-component").parentElement;
    expect(wrapper).toHaveClass("space-y-6");
  });
});
