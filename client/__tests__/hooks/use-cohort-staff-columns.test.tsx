import { screen } from '@/test/custom-render';
import { afterEach, describe, expect, it, vi } from "vitest";

// Import the hook to test
import { useCohortStaffColumns } from "@/hooks/use-cohort-staff-columns";

// Import mocks to ensure all API calls are stubbed
import "@/mocks/api";

// Import the test helper
import { render } from '@/test/custom-render';

// Test component that uses the hook
function TestComponent() {
  const result = useCohortStaffColumns();
  return (
    <div data-testid="hook-result">
      <div data-testid="columns-length">{result.columns.length}</div>
      <div data-testid="has-role-options">
        {result.roleOptions ? "true" : "false"}
      </div>
    </div>
  );
}

describe("useCohortStaffColumns", () => {
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
    expect(screen.getByTestId("has-role-options")).toHaveTextContent("true");
  });
});
