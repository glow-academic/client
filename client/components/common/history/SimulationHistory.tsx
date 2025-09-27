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

  // Optional: Whether to hide Name column when all attempts have the same profile
  singleProfile?: boolean;
}

export default function SimulationHistory({
  filteredData,
  showExport,
  showArchive,
  singleProfile = false,
}: SimulationHistoryProps) {
  // Check if all attempts have the same profileId (only when singleProfile is true)
  const allSameProfile = React.useMemo(() => {
    if (
      !singleProfile ||
      !filteredData?.attempts ||
      filteredData.attempts.length === 0
    ) {
      return false;
    }

    const firstProfileId = filteredData.attempts[0]?.profileId;
    if (!firstProfileId) {
      return false;
    }

    return filteredData.attempts.every(
      (attempt) => attempt.profileId === firstProfileId
    );
  }, [filteredData?.attempts, singleProfile]);

  const { columns, data, profileOptions, simulationOptions, scenarioOptions } =
    useHistoryColumns({
      filteredData,
      showExport,
      showArchive,
      allSameProfile, // Pass this information to the hook
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
    />
  );
}
