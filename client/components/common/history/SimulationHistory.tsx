/**
 * SimulationHistory.tsx
 * Used to display the simulation history page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */

import { useHistoryColumns } from "@/hooks/use-history-columns";
import type { FilteredData } from "@/utils/analytics/filtering";
import * as React from "react";
import { DataTable } from "./DataTable";

export interface SimulationHistoryProps {
  // Required: Pre-filtered data from analytics context
  filteredData: FilteredData | null;

  // Required: Whether to show export functionality
  showExport: boolean;

  // Required: Whether to show archive functionality
  showArchive: boolean;
}

export default function SimulationHistory({
  filteredData,
  showExport,
  showArchive,
}: SimulationHistoryProps) {
  const { columns, data, profileOptions, simulationOptions, scenarioOptions } =
    useHistoryColumns({
      filteredData,
      showExport,
      showArchive,
    });

  // Create a key based on the data to force re-render when data changes
  const tableKey = React.useMemo(() => {
    if (!data || data.length === 0) return "empty";
    return data.map((item) => (item as { id: string }).id).join("-");
  }, [data]);

  return (
    <DataTable
      key={tableKey}
      data={data || []}
      columns={columns as never}
      profileOptions={profileOptions}
      simulationOptions={simulationOptions}
      scenarioOptions={scenarioOptions}
      showExport={showExport}
      showArchive={showArchive}
      showAll={true} // Always show all since filtering is handled upstream
      filteredData={filteredData}
    />
  );
}
