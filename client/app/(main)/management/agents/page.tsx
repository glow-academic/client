/**
 * app/(main)/management/agents/page.tsx
 * Agent list page - redirects to home with agents section
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */
"use client";
import Agents from "@/components/management/agents/Agents";

export default function AgentsPage() {
  return (
    <div className="space-y-6">
      <Agents />
    </div>
  );
}
