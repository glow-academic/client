/**
 * PersonaDebugInfo.tsx
 * Debug info component that uses pre-fetched data from parent
 * Eliminates 4 API calls by using data already in PersonaDetailResponse
 */
"use client";

import { useMemo } from "react";
import PersonaDebugInfoDataTable from "./PersonaDebugInfoDataTable";

export interface PersonaDebugInfoRow {
  id: string;
  createdAt: string;
  modelRunId: string;
  content: string;
  modelId: string | null;
  modelName: string;
}

export interface DebugInfoItem {
  created_at: string;
  model_id: string;
  content: string;
}

export interface ModelMapping {
  [modelId: string]: {
    name: string;
    description: string;
  };
}

export interface PersonaDebugInfoProps {
  debugInfo: DebugInfoItem[];
  modelMapping: ModelMapping;
}

export function PersonaDebugInfo({
  debugInfo,
  modelMapping,
}: PersonaDebugInfoProps) {
  const rows: PersonaDebugInfoRow[] = useMemo(() => {
    return debugInfo.map((item, idx) => ({
      id: `${item.created_at}-${idx}`,
      createdAt: item.created_at,
      content: item.content,
      modelId: item.model_id,
      modelName: modelMapping[item.model_id]?.name || item.model_id,
      modelRunId: "", // Not needed for v2, kept for interface compatibility
    }));
  }, [debugInfo, modelMapping]);

  const modelOptions = useMemo(() => {
    return Object.entries(modelMapping).map(([id, info]) => ({
      value: id,
      label: info.name,
    }));
  }, [modelMapping]);

  return (
    <PersonaDebugInfoDataTable
      data={rows}
      modelOptions={modelOptions}
      isLoading={false}
    />
  );
}

export default PersonaDebugInfo;
