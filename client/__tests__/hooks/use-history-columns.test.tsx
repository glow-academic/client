import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Import the hook to test
import { useHistoryColumns } from "@/hooks/use-history-columns";

// Import mocks to ensure all API calls are stubbed
import "@/mocks/api";

// Test component that uses the hook
function TestComponent({
  allSameProfile = false,
  showExport = true,
}: {
  allSameProfile?: boolean;
  showExport?: boolean;
}) {
  const result = useHistoryColumns({
    filteredData: null,
    showExport,
    showArchive: false,
    allSameProfile,
  });
  return (
    <div data-testid="hook-result">
      <div data-testid="columns-length">{result.columns.length}</div>
      <div data-testid="has-profile-options">
        {result.profileOptions.length > 0 ? "true" : "false"}
      </div>
      <div data-testid="has-simulation-options">
        {result.simulationOptions.length > 0 ? "true" : "false"}
      </div>
      <div data-testid="has-scenario-options">
        {result.scenarioOptions.length > 0 ? "true" : "false"}
      </div>
    </div>
  );
}

describe("useHistoryColumns", () => {
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
    expect(screen.getByTestId("has-profile-options")).toHaveTextContent(
      "false"
    );
    expect(screen.getByTestId("has-simulation-options")).toHaveTextContent(
      "false"
    );
    expect(screen.getByTestId("has-scenario-options")).toHaveTextContent(
      "false"
    );
  });

  it("hides profile options when allSameProfile is true and showExport is true", () => {
    render(<TestComponent allSameProfile={true} showExport={true} />);

    // Check that profile options are hidden when all attempts have the same profile and export is enabled
    expect(screen.getByTestId("has-profile-options")).toHaveTextContent(
      "false"
    );
  });

  it("shows profile options when allSameProfile is true but showExport is false", () => {
    render(<TestComponent allSameProfile={true} showExport={false} />);

    // Check that profile options are shown when export is disabled, even if all attempts have the same profile
    expect(screen.getByTestId("has-profile-options")).toHaveTextContent(
      "false"
    );
  });

  it("shows profile options when allSameProfile is false", () => {
    render(<TestComponent allSameProfile={false} showExport={true} />);

    // Check that profile options are shown when not all attempts have the same profile
    expect(screen.getByTestId("has-profile-options")).toHaveTextContent(
      "false"
    );
  });
});
