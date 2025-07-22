/**
 * SimulationHistory.tsx
 * Used to display the simulation history page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */

import { useHistoryColumns } from "@/hooks/use-history-columns";
import { DataTable } from "./DataTable";

export interface SimulationHistoryProps {
  showAll: boolean;
  cohortIds?: string[];
  showExport?: boolean;
}

export default function SimulationHistory({
  showAll,
  showExport = true,
  cohortIds = undefined,
}: SimulationHistoryProps) {
  const { columns, data, profileOptions, scoreRangeOptions } =
    useHistoryColumns({
      showAll,
      showExport,
      cohortIds,
    });

  return (
    <DataTable
      data={data || []}
      columns={columns as never}
      profileOptions={profileOptions}
      scoreRangeOptions={scoreRangeOptions}
      showExport={showExport}
      showAll={showAll}
    />
  );
}
