import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Import the hook to test
import { useHistoryColumns } from "@/hooks/use-history-columns";

// Import mocks to ensure all API calls are stubbed
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";

// Import the test helper
import { renderWithMocks } from "@/test/renderWithMocks";

// Test component that uses the hook
function TestComponent() {
  const result = useHistoryColumns({
    cohortIds: [],
  });
  return (
    <div data-testid="hook-result">
      <div data-testid="columns-length">{result.columns.length}</div>
      <div data-testid="has-profile-options">
        {result.profileOptions ? "true" : "false"}
      </div>
      <div data-testid="has-simulation-options">
        {result.simulationOptions ? "true" : "false"}
      </div>
      <div data-testid="has-scenario-options">
        {result.scenarioOptions ? "true" : "false"}
      </div>
    </div>
  );
}

describe("useHistoryColumns", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("can be called and returns columns", () => {
    renderWithMocks(<TestComponent />);

    // Check that the component rendered successfully
    expect(screen.getByTestId("hook-result")).toBeInTheDocument();

    // Check that columns were returned
    const columnsLength = screen.getByTestId("columns-length");
    expect(parseInt(columnsLength.textContent || "0")).toBeGreaterThan(0);

    // Check that all expected properties are present
    expect(screen.getByTestId("has-profile-options")).toHaveTextContent("true");
    expect(screen.getByTestId("has-simulation-options")).toHaveTextContent(
      "true"
    );
    expect(screen.getByTestId("has-scenario-options")).toHaveTextContent(
      "true"
    );
  });
});
