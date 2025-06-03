"use client";
import React from "react";
import { ManagementSection } from "@/components/management-section";

export default function TAManagementPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Teaching Assistant Management</h1>
        <p className="text-muted-foreground">
          Manage teaching assistants and their assignments.
        </p>
      </div>
      
      <ManagementSection type="tas" />
    </div>
  );
}
