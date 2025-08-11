import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Import the hook to test
import { useAgentColumns } from "@/hooks/use-agent-columns";

// Import mocks to ensure all API calls are stubbed
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";

// Import the test helper
import { renderWithMocks } from "@/test/renderWithMocks";

// Test component that uses the hook
function TestComponent() {
  const result = useAgentColumns();
  return (
    <div data-testid="hook-result">
      <div data-testid="columns-length">{result.columns.length}</div>
      <div data-testid="has-reasoning-options">
        {result.reasoningOptions ? "true" : "false"}
      </div>
      <div data-testid="has-model-options">
        {result.modelOptions ? "true" : "false"}
      </div>
      <div data-testid="has-temperature-options">
        {result.temperatureOptions ? "true" : "false"}
      </div>
    </div>
  );
}

describe("useAgentColumns", () => {
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
    expect(screen.getByTestId("has-reasoning-options")).toHaveTextContent(
      "true"
    );
    expect(screen.getByTestId("has-model-options")).toHaveTextContent("true");
    expect(screen.getByTestId("has-temperature-options")).toHaveTextContent(
      "true"
    );
  });
});
