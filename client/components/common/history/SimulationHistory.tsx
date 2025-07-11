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
  showExport?: boolean;
};

export default function SimulationHistory({
  showAll,
  showExport = true,
}: SimulationHistoryProps) {
  const { columns, data, profileOptions, classOptions, scoreRangeOptions } =
    useHistoryColumns({
      showAll,
      showExport,
    });

  return (
    <DataTable
      data={data || []}
      columns={columns as never}
      profileOptions={profileOptions}
      classOptions={classOptions}
      scoreRangeOptions={scoreRangeOptions}
      showExport={showExport}
      showAll={showAll}
    />
  );
}
