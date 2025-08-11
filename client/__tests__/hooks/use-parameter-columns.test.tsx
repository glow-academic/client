import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Import the hook to test
import { useParameterColumns } from "@/hooks/use-parameter-columns";

// Import mocks to ensure all API calls are stubbed
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";

// Import the test helper
import { renderWithMocks } from "@/test/renderWithMocks";

// Test component that uses the hook
function TestComponent() {
  const result = useParameterColumns();
  return (
    <div data-testid="hook-result">
      <div data-testid="columns-length">{result.columns.length}</div>
      <div data-testid="has-type-options">
        {result.typeOptions ? "true" : "false"}
      </div>
      <div data-testid="has-item-count-options">
        {result.itemCountOptions ? "true" : "false"}
      </div>
      <div data-testid="has-status-options">
        {result.statusOptions ? "true" : "false"}
      </div>
      <div data-testid="has-scenario-options">
        {result.scenarioOptions ? "true" : "false"}
      </div>
    </div>
  );
}

describe("useParameterColumns", () => {
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
    expect(screen.getByTestId("has-type-options")).toHaveTextContent("true");
    expect(screen.getByTestId("has-item-count-options")).toHaveTextContent(
      "true"
    );
    expect(screen.getByTestId("has-status-options")).toHaveTextContent("true");
    expect(screen.getByTestId("has-scenario-options")).toHaveTextContent(
      "true"
    );
  });
});
