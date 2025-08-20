import SimulationHistory from "@/components/common/history/SimulationHistory";
import { useHistoryColumns } from "@/hooks/use-history-columns";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock the useHistoryColumns hook
vi.mock("@/hooks/use-history-columns", () => ({
  useHistoryColumns: vi.fn(),
}));

const mockUseHistoryColumns = vi.mocked(useHistoryColumns);

describe("SimulationHistory", () => {
  const mockFilteredData = {
    attempts: [
      { id: "1", profileId: "profile1", simulationId: "sim1" },
      { id: "2", profileId: "profile1", simulationId: "sim2" },
    ],
    profiles: [{ id: "profile1", firstName: "John", lastName: "Doe" }],
    simulations: [],
    scenarios: [],
    chats: [],
    grades: [],
    personas: [],
    rubrics: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hides Name column when all attempts have same profile and showExport is true", () => {
    mockUseHistoryColumns.mockReturnValue({
      columns: [],
      data: [],
      profileOptions: [], // Empty because allSameProfile should be true
      simulationOptions: [],
      scenarioOptions: [],
    });

    render(
      <SimulationHistory
        filteredData={mockFilteredData}
        showExport={true}
        showArchive={false}
      />
    );

    expect(mockUseHistoryColumns).toHaveBeenCalledWith({
      filteredData: mockFilteredData,
      showExport: true,
      showArchive: false,
      allSameProfile: true, // Should be true when all attempts have same profile and showExport is true
    });
  });

  it("shows Name column when all attempts have same profile but showExport is false", () => {
    mockUseHistoryColumns.mockReturnValue({
      columns: [],
      data: [],
      profileOptions: [{ value: "profile1", label: "John Doe", icon: null }], // Not empty because allSameProfile should be false
      simulationOptions: [],
      scenarioOptions: [],
    });

    render(
      <SimulationHistory
        filteredData={mockFilteredData}
        showExport={false}
        showArchive={false}
      />
    );

    expect(mockUseHistoryColumns).toHaveBeenCalledWith({
      filteredData: mockFilteredData,
      showExport: false,
      showArchive: false,
      allSameProfile: false, // Should be false when showExport is false
    });
  });

  it("shows Name column when attempts have different profiles", () => {
    const mixedData = {
      ...mockFilteredData,
      attempts: [
        { id: "1", profileId: "profile1", simulationId: "sim1" },
        { id: "2", profileId: "profile2", simulationId: "sim2" },
      ],
      profiles: [
        { id: "profile1", firstName: "John", lastName: "Doe" },
        { id: "profile2", firstName: "Jane", lastName: "Smith" },
      ],
    };

    mockUseHistoryColumns.mockReturnValue({
      columns: [],
      data: [],
      profileOptions: [
        { value: "profile1", label: "John Doe", icon: null },
        { value: "profile2", label: "Jane Smith", icon: null },
      ],
      simulationOptions: [],
      scenarioOptions: [],
    });

    render(
      <SimulationHistory
        filteredData={mixedData}
        showExport={true}
        showArchive={false}
      />
    );

    expect(mockUseHistoryColumns).toHaveBeenCalledWith({
      filteredData: mixedData,
      showExport: true,
      showArchive: false,
      allSameProfile: false, // Should be false when attempts have different profiles
    });
  });
});
