import { render } from "@/test/custom-render";
import { screen } from "@/test/custom-render";
import { describe, expect, it, vi } from "vitest";

// Mock Providers component
vi.mock("@/components/system/providers/Providers", () => ({
  __esModule: true,
  default: () => (
    <div data-testid="providers-component">Providers Component</div>
  ),
}));

import ProvidersPage, {
  metadata,
} from "@/app/(main)/system/providers/page";

describe("ProvidersPage", () => {
  it("renders without crashing", () => {
    render(<ProvidersPage />);
    expect(screen.getByTestId("providers-component")).toBeInTheDocument();
    expect(screen.getByText("Providers Component")).toBeInTheDocument();
  });

  it("exports correct metadata", () => {
    expect(metadata).toBeDefined();
    expect(metadata.title).toBe("Providers");
    expect(metadata.description).toContain("Manage AI providers in GLOW");
  });

  it("renders the Providers component inside a wrapper", () => {
    render(<ProvidersPage />);
    const wrapper = screen.getByTestId("providers-component").parentElement;
    expect(wrapper).toHaveClass("space-y-6");
  });
});
