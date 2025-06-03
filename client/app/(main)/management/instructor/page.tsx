"use client";
import React from "react";
import { ManagementSection } from "@/components/management-section";

export default function InstructorManagementPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Instructor Management</h1>
        <p className="text-muted-foreground">
          Manage course instructors and their class assignments.
        </p>
      </div>
      
      <ManagementSection type="instructors" />
    </div>
  );
}
