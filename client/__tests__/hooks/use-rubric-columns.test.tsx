import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Import the hook to test
import { useRubricColumns } from "@/hooks/use-rubric-columns";

// Import mocks to ensure all API calls are stubbed
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";

// Import the test helper
import { renderWithMocks } from "@/test/renderWithMocks";

// Test component that uses the hook
function TestComponent() {
  const result = useRubricColumns();
  return (
    <div data-testid="hook-result">
      <div data-testid="columns-length">{result.columns.length}</div>
      <div data-testid="has-pass-points-options">
        {result.passPointsOptions ? "true" : "false"}
      </div>
      <div data-testid="has-total-points-options">
        {result.totalPointsOptions ? "true" : "false"}
      </div>
      <div data-testid="has-pass-percentage-options">
        {result.passPercentageOptions ? "true" : "false"}
      </div>
    </div>
  );
}

describe("useRubricColumns", () => {
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
    expect(screen.getByTestId("has-pass-points-options")).toHaveTextContent(
      "true"
    );
    expect(screen.getByTestId("has-total-points-options")).toHaveTextContent(
      "true"
    );
    expect(screen.getByTestId("has-pass-percentage-options")).toHaveTextContent(
      "true"
    );
  });
});
