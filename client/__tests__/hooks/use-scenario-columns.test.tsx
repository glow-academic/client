import { screen } from '@/test/custom-render';
import { afterEach, describe, expect, it, vi } from "vitest";

// Import the hook to test
import { useScenarioColumns } from "@/hooks/use-scenario-columns";

// Import mocks to ensure all API calls are stubbed
import "@/mocks/api";

// Import the test helper
import { render } from '@/test/custom-render';

// Test component that uses the hook
function TestComponent() {
  const result = useScenarioColumns();
  return (
    <div data-testid="hook-result">
      <div data-testid="columns-length">{result.columns.length}</div>
      <div data-testid="has-simulation-options">
        {result.simulationOptions ? "true" : "false"}
      </div>
      <div data-testid="has-cohort-options">
        {result.cohortOptions ? "true" : "false"}
      </div>
      <div data-testid="has-persona-options">
        {result.personaOptions ? "true" : "false"}
      </div>
      <div data-testid="has-scenario-type-options">
        {result.scenarioTypeOptions ? "true" : "false"}
      </div>
    </div>
  );
}

describe("useScenarioColumns", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("can be called and returns columns", () => {
    render(<TestComponent />);

    // Check that the component rendered successfully
    expect(screen.getByTestId("hook-result")).toBeInTheDocument();

    // Check that columns were returned
    const columnsLength = screen.getByTestId("columns-length");
    expect(parseInt(columnsLength.textContent || "0")).toBeGreaterThan(0);

    // Check that all expected properties are present
    expect(screen.getByTestId("has-simulation-options")).toHaveTextContent(
      "true"
    );
    expect(screen.getByTestId("has-cohort-options")).toHaveTextContent("true");
    expect(screen.getByTestId("has-persona-options")).toHaveTextContent("true");
    expect(screen.getByTestId("has-scenario-type-options")).toHaveTextContent(
      "true"
    );
  });
});
