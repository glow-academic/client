/**
 * AllSimulationHistory.tsx
 * Used to display the all simulation history page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */

import { useColumns } from "./columns";
import { DataTable } from "./data-table";

type SimulationHistoryProps = {
  showAll: boolean;
  showChats: boolean;
  showExport?: boolean;
};

export default function SimulationHistory({
  showAll,
  showChats,
  showExport = true,
}: SimulationHistoryProps) {
  const { columns, data, profileOptions, classOptions, scoreOptions } = useColumns({
    showAll,
    showChats,
    showExport,
  });

  return (
    <DataTable<any, any>
      data={data || []}
      columns={columns}
      profileOptions={profileOptions}
      classOptions={classOptions}
      showChats={showChats}
      showExport={showExport}
      scoreOptions={scoreOptions}
    />
  );
}
