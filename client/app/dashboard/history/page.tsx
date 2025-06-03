"use client";
import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { DataTable } from "@/components/tasks/data-table";
import { useTaskColumns } from "@/components/tasks/columns";
import { getUser } from "@/utils/queries/get-user";

type UserRole = 'admin' | 'instructional' | 'instructor' | 'ta' | 'guest'

export default function DashboardHistoryPage() {
  const [viewMode, setViewMode] = useState<'chats' | 'attempts'>('chats');
  const [isClient, setIsClient] = useState(false);

  // Handle client-side mounting
  useEffect(() => {
    setIsClient(true);
  }, []);

  const { data: user } = useQuery({
    queryKey: ["user"],
    queryFn: () => getUser(),
  });

  // Get user role simulation - only run on client side
  const getEffectiveRole = (): UserRole => {
    if (!isClient) return 'guest'; // Default to guest during SSR
    
    // Check if in guest mode from localStorage
    const isGuestMode = localStorage.getItem('guestMode') === 'true';
    if (isGuestMode && !user) return 'guest';
    
    if (!user) return 'guest';
    const stored = localStorage.getItem('simulatedRole');
    if (user.role === 'admin' && stored && ['admin', 'instructional', 'instructor', 'ta', 'guest'].includes(stored)) {
      return stored as UserRole;
    }
    return (user.role as UserRole) || 'guest';
  };

  const effectiveRole = getEffectiveRole();
  const isAdmin = ['admin', 'instructional'].includes(effectiveRole);

  // Use the task columns hook
  const {
    columns,
    isLoading,
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
      
      <DataTable
        data={data || []}
        columns={columns}
        userOptions={userOptions}
        classOptions={classOptions}
        isAdmin={isAdmin}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />
    </div>
  );
}
