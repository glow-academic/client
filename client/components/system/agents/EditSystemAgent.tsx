/**
 * EditSystemAgent.tsx
 * Used to edit system agents using the unified agent component.
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */
"use client";

import SystemAgent from "@/components/common/agent/SystemAgent";

export interface EditSystemAgentProps {
  agentId: string;
}

export default function EditSystemAgent({ agentId }: EditSystemAgentProps) {
  return <SystemAgent agentId={agentId} />;
}
