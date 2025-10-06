import { render } from "@/test/custom-render";
import { screen } from "@/test/custom-render";
import { describe, expect, it, vi } from "vitest";

// Mock NewScenario component
vi.mock("@/components/create/scenarios/NewScenario", () => ({
  __esModule: true,
  default: () => (
    <div data-testid="new-scenario-component">New Scenario Component</div>
  ),
}));

import NewScenarioPage, {
  metadata,
} from "@/app/(main)/create/scenarios/new/page";

describe("NewScenarioPage", () => {
  it("renders without crashing", () => {
    render(<NewScenarioPage />);
    expect(screen.getByTestId("new-scenario-component")).toBeInTheDocument();
    expect(screen.getByText("New Scenario Component")).toBeInTheDocument();
  });

  it("exports correct metadata", () => {
    expect(metadata).toBeDefined();
    expect(metadata.title).toBe("New Scenario");
    expect(metadata.description).toContain("New scenario creation page");
  });

  it("renders the NewScenario component inside a wrapper", () => {
    render(<NewScenarioPage />);
    const wrapper = screen.getByTestId("new-scenario-component").parentElement;
    expect(wrapper).toHaveClass("space-y-6");
  });
});
