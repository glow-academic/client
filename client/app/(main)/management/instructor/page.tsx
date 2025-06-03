"use client";
import React from "react";
import { ManagementSection } from "@/components/management-section";

export default function InstructorManagementPage() {
  return (
    <div className="space-y-6">
      <ManagementSection type="instructors" />
    </div>
  );
}
