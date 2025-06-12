/**
 * SimulationHistory.tsx
 * Used to display the simulation history page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */

import { useColumns } from "./columns";
import { DataTable } from "./data-table";

type SimulationHistoryProps = {
  showAll: boolean;
  showExport?: boolean;
};

export default function SimulationHistory({
  showAll,
  showExport = true,
}: SimulationHistoryProps) {
  const { columns, data, profileOptions, classOptions, scoreOptions, scoreRangeOptions } = useColumns({
    showAll,
    showExport,
  });

  return (
    <DataTable<any, any>
      data={data || []}
      columns={columns}
      profileOptions={profileOptions}
      classOptions={classOptions}
      scoreRangeOptions={scoreRangeOptions}
      showExport={showExport}
      scoreOptions={scoreOptions}
    />
  );
}
