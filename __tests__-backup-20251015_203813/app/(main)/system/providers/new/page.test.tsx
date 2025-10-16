import { render } from "@/test/custom-render";
import { screen } from "@/test/custom-render";
import { describe, expect, it, vi } from "vitest";

// Mock NewProvider component
vi.mock("@/components/system/providers/NewProvider", () => ({
  __esModule: true,
  default: () => (
    <div data-testid="new-provider-component">New Provider Component</div>
  ),
}));

import NewProviderPage, {
  metadata,
} from "@/app/(main)/system/providers/new/page";

describe("NewProviderPage", () => {
  it("renders without crashing", () => {
    render(<NewProviderPage />);
    expect(screen.getByTestId("new-provider-component")).toBeInTheDocument();
    expect(screen.getByText("New Provider Component")).toBeInTheDocument();
  });

  it("exports correct metadata", () => {
    expect(metadata).toBeDefined();
    expect(metadata.title).toBe("Providers");
    expect(metadata.description).toContain("Create new AI providers in GLOW");
  });

  it("renders the NewProvider component inside a wrapper", () => {
    render(<NewProviderPage />);
    const wrapper = screen.getByTestId("new-provider-component").parentElement;
    expect(wrapper).toHaveClass("space-y-6");
  });
});
