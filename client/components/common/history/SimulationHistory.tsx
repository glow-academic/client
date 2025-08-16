/**
 * SimulationHistory.tsx
 * Used to display the simulation history page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */

import { useHistoryColumns } from "@/hooks/use-history-columns";
import type { FilteredData } from "@/utils/analytics/filtering";
import { DataTable } from "./DataTable";

export interface SimulationHistoryProps {
  // Required: Pre-filtered data from analytics context
  filteredData: FilteredData | null;

  // Required: Whether to show export functionality
  showExport: boolean;
}

export default function SimulationHistory({
  filteredData,
  showExport,
}: SimulationHistoryProps) {
  const { columns, data, profileOptions, simulationOptions, scenarioOptions } =
    useHistoryColumns({
      filteredData,
      showExport,
    });

  return (
    <DataTable
      data={data || []}
      columns={columns as never}
      profileOptions={profileOptions}
      simulationOptions={simulationOptions}
      scenarioOptions={scenarioOptions}
      showExport={showExport}
      showAll={true} // Always show all since filtering is handled upstream
      filteredData={filteredData}
    />
  );
}
