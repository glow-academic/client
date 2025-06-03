"use client";
import React from "react";
import { ManagementSection } from "@/components/management-section";

export default function InstructionalManagementPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Instructional Staff Management</h1>
        <p className="text-muted-foreground">
          Manage instructional staff members and their permissions.
        </p>
      </div>
      
      <ManagementSection type="instructional" />
    </div>
  );
}
