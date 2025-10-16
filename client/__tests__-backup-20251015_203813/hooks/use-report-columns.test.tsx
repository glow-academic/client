import { screen } from "@/test/custom-render";
import { afterEach, describe, expect, it, vi } from "vitest";

// Import the hook to test
import { useReportColumns } from "@/hooks/use-report-columns";

// Import mocks to ensure all API calls are stubbed
import "@/mocks/api";

// Import the test helper
import { render } from "@/test/custom-render";

// Test component that uses the hook
function TestComponent() {
  const result = useReportColumns({ onViewReport: vi.fn() });
  return (
    <div data-testid="hook-result">
      <div data-testid="columns-length">{result.columns.length}</div>
    </div>
  );
}

describe("useReportColumns", () => {
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
  });
});
