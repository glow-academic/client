/**
 * Logs.tsx
 * Used to display the logs for the analytics page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */

import React from "react";
import { DataTable } from "@/components/common/history/data-table";
import { useTaskColumns } from "@/components/common/history/columns";

export default function Logs() {

  // Always show admin view for logs page to see all training sessions
  const isAdmin = true;

  // Use the task columns hook with admin privileges and attempts view
  const {
    columns,
    data,
    userOptions,
    classOptions,
  } = useTaskColumns({ 
    isAdmin: true, 
    viewMode: 'attempts', // Show attempts view for detailed logs
    effectiveRole: 'student' // Use student as the base role for data access
  });

  return (
    <div className="space-y-6">
      <DataTable<any, any>
        data={data || []}
        columns={columns}
        userOptions={userOptions}
        classOptions={classOptions}
        isAdmin={isAdmin}
        viewMode="attempts"
      />
    </div>
  );
}
