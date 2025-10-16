import { render } from "@/test/custom-render";
import { screen } from "@/test/custom-render";
import { describe, expect, it, vi } from "vitest";

// Mock Parameter component
vi.mock("@/components/common/parameter/Parameter", () => ({
  __esModule: true,
  default: ({ mode }: { mode: string }) => (
    <div data-testid="parameter-component" data-mode={mode}>
      Parameter Component
    </div>
  ),
}));

import NewParameterPage, {
  metadata,
} from "@/app/(main)/management/parameters/new/page";

describe("NewParameterPage", () => {
  it("renders without crashing", () => {
    render(<NewParameterPage />);
    expect(screen.getByTestId("parameter-component")).toBeInTheDocument();
    expect(screen.getByText("Parameter Component")).toBeInTheDocument();
  });

  it("passes create mode to Parameter component", () => {
    render(<NewParameterPage />);
    const parameter = screen.getByTestId("parameter-component");
    expect(parameter).toHaveAttribute("data-mode", "create");
  });

  it("exports correct metadata", () => {
    expect(metadata).toBeDefined();
    expect(metadata.title).toBe("New Parameter");
    expect(metadata.description).toContain("New parameter creation page");
  });

  it("renders the Parameter component inside a wrapper", () => {
    render(<NewParameterPage />);
    const wrapper = screen.getByTestId("parameter-component").parentElement;
    expect(wrapper).toHaveClass("space-y-6");
  });
});
