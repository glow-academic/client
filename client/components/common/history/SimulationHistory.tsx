/**
 * SimulationHistory.tsx
 * Used to display the simulation history page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */

import { useHistoryColumns } from "@/hooks/use-history-columns";
import { DataTable } from "./DataTable";

export interface SimulationHistoryProps {
  profileId?: string | null;
  cohortIds?: string[];
  showExport?: boolean;
  showPractice?: boolean;
  startDate?: Date;
  endDate?: Date;
}

export default function SimulationHistory({
  profileId,
  showExport = true,
  cohortIds = undefined,
  showPractice = false,
  startDate,
  endDate,
}: SimulationHistoryProps) {
  const { columns, data, profileOptions, simulationOptions, scenarioOptions } =
    useHistoryColumns({
      profileId: profileId || null,
      showExport,
      cohortIds,
      showPractice,
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
    });

  return (
    <DataTable
      data={data || []}
      columns={columns as never}
      profileOptions={profileOptions}
      simulationOptions={simulationOptions}
      scenarioOptions={scenarioOptions}
      showExport={showExport}
      showAll={!profileId} // showAll is true when profileId is null/undefined
      startDate={startDate}
      endDate={endDate}
    />
  );
}
