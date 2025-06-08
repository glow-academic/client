/**
 * app/agents/page.tsx
 * Agent list page - redirects to home with agents section
 */
"use client";
import React from "react";
import { AgentsContent } from "@/components/common/admin/agents-content";

export default function ChatAgentsPage() {
  return (
    <div className="space-y-6">
      
      <AgentsContent />
    </div>
  );
}
