/**
 * app/scenario/page.tsx
 * Scenario list page - redirects to home with scenarios section
 */
"use client";
import React from "react";
import { ScenariosContent } from "@/components/admin/scenarios-content";

export default function ChatScenariosPage() {
  return (
    <div className="space-y-6">
      <ScenariosContent />
    </div>
  );
}
