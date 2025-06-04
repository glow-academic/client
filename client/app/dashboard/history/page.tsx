"use client";
import React from "react";
import { useQuery } from "@tanstack/react-query";

import { DataTable } from "@/components/history/data-table";
import { useTaskColumns } from "@/components/history/columns";
import { getUser } from "@/utils/queries/get-user";
import { useViewMode } from "../layout";
import { useRole } from "@/components/role-context";

export default function DashboardHistoryPage() {
  // Use context for view mode and role
  const { viewMode } = useViewMode();
  const { effectiveRole } = useRole();

  const { data: user } = useQuery({
    queryKey: ["user"],
    queryFn: () => getUser(),
  });

  const isAdmin = ['admin', 'instructional'].includes(effectiveRole);

  // Use the task columns hook
  const {
    columns,
    data,
    userOptions,
    classOptions,
  } = useTaskColumns({ 
    isAdmin: effectiveRole === 'admin', 
    viewMode,
    effectiveRole: effectiveRole === 'guest' ? 'guest' : 'student'
  });

  return (
    <div className="space-y-6">
      <DataTable<any, any>
        data={data || []}
        columns={columns}
        userOptions={userOptions}
        classOptions={classOptions}
        isAdmin={isAdmin}
        viewMode={viewMode}
      />
    </div>
  );
}
