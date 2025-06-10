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
}

export default function SimulationHistory({ showAll, showChats }: SimulationHistoryProps) {
    const {
        columns,
        data,
        userOptions,
        classOptions,
    } = useColumns({
        showAll,
        showChats,
    });

    return (
        <DataTable<any, any>
            data={data || []}
            columns={columns}
            userOptions={userOptions}
            classOptions={classOptions}
        />
    )
}