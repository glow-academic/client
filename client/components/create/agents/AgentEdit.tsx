/**
 * AgentEdit.tsx
 * Used to edit agents using the unified agent component.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";
import Agent from "@/components/common/agent/Agent";

export interface AgentEditProps {
  agentId: string;
}

export default function AgentEdit({ agentId }: AgentEditProps) {
  return <Agent agentId={agentId} mode="edit" />;
}
