/**
 * SimulationHistory.tsx
 * Used to display the simulation history page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */

import { useAnalytics } from "@/contexts/analytics-context";
import { useHistoryAdapter } from "@/hooks/use-history-adapter";
import { useHistoryColumns } from "@/hooks/use-history-columns";
import { useAnalyticsAttemptHistory } from "@/lib/api/hooks/analytics";
import type { FilteredData } from "@/utils/analytics/filtering";
import * as React from "react";
import { DataTable } from "./DataTable";

export interface SimulationHistoryProps {
  // Required: Pre-filtered data from analytics context (legacy support)
  filteredData?: FilteredData | null;

  // Required: Whether to show export functionality
  showExport: boolean;

  // Required: Whether to show archive functionality
  showArchive: boolean;

  // Optional: Whether to hide Name column when all attempts have the same profile
  singleProfile?: boolean;

  // Optional: Use new database-driven approach (default: true)
  useDatabaseDriven?: boolean;
}

export default function SimulationHistory({
  filteredData: _filteredData,
  showExport,
  showArchive,
  singleProfile = false,
  useDatabaseDriven = true,
}: SimulationHistoryProps) {
  const analytics = useAnalytics();

  // Build analytics filters from context
  const filters = React.useMemo(
    () => ({
      startDate: analytics.startDate.toISOString(),
      endDate: analytics.endDate.toISOString(),
      cohortIds:
        analytics.selectedCohortIds.length > 0
          ? analytics.selectedCohortIds
          : undefined,
      roles:
        analytics.selectedRoles.length > 0
          ? analytics.selectedRoles
          : undefined,
      simulationFilters: analytics.simulationFilters,
      profileId: undefined, // Could be added later if needed
    }),
    [analytics]
  );

  // Use new database-driven approach
  const { data: historyData, isLoading } = useAnalyticsAttemptHistory(
    filters,
    useDatabaseDriven
  );
  const rows = React.useMemo(
    () => historyData?.rows ?? [],
    [historyData?.rows]
  );
  const { data: adaptedData } = useHistoryAdapter(rows);

  // Check if all attempts have the same profileId (only when singleProfile is true)
  const allSameProfile = React.useMemo(() => {
    if (!singleProfile || rows.length === 0) {
      return false;
    }

    const firstProfileId = rows[0]?.profileId;
    if (!firstProfileId) {
      return false;
    }

    return rows.every(
      (row: { profileId: string }) => row.profileId === firstProfileId
    );
  }, [rows, singleProfile]);

  // Use simplified columns hook that trusts server values
  const { columns, profileOptions, simulationOptions, scenarioOptions } =
    useHistoryColumns({
      filteredData: null, // Not needed anymore with database-driven approach
      showExport,
      showArchive,
      allSameProfile,
    });

  // Create a key based on the data to force re-render when data changes
  const tableKey = React.useMemo(() => {
    if (!adaptedData || adaptedData.length === 0) return "empty";
    return adaptedData.map((item) => (item as { id: string }).id).join("-");
  }, [adaptedData]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <DataTable
      key={tableKey}
      data={adaptedData || []}
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
