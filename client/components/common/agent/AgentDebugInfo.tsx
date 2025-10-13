"use client";

import { useMemo } from "react";

import { useDebugInfoByModelRunIdBatch } from "@/lib/api/v1/hooks/debug_info";
import { useModelRunModelsByModelRunIdBatch } from "@/lib/api/v1/hooks/model_run_models";
import { useModelRunsByAgentId } from "@/lib/api/v1/hooks/model_runs";
import { useModels } from "@/lib/api/v1/hooks/models";
import { DebugInfo as DebugInfoType, Model, ModelRun } from "@/types";
import AgentDebugInfoDataTable from "./AgentDebugInfoDataTable";

export interface AgentDebugInfoProps {
  agentId: string;
}

export interface AgentDebugInfoRow {
  id: string;
  createdAt: string;
  modelRunId: string;
  content: string;
  modelId: string | null;
  modelName: string;
}

export function AgentDebugInfo({ agentId }: AgentDebugInfoProps) {
  const { data: modelRuns = [], isLoading: isLoadingRuns } =
    useModelRunsByAgentId(agentId);

  const modelRunIds = useMemo(
    () => (modelRuns as ModelRun[]).map((mr) => mr.id),
    [modelRuns]
  );

  const { data: debugInfo = [], isLoading: isLoadingDebug } =
    useDebugInfoByModelRunIdBatch(modelRunIds);

  const { data: models = [], isLoading: isLoadingModels } = useModels();

  // Get model run models from junction table
  const { data: modelRunModels = [] } = useModelRunModelsByModelRunIdBatch(
    (modelRuns || []).map((mr) => mr.id)
  );

  const modelIdByRunId = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const mrm of modelRunModels || []) {
      if (mrm.active) {
        map.set(mrm.modelRunId, mrm.modelId);
      }
    }
    return map;
  }, [modelRunModels]);

  const modelNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of (models as Model[]) || []) {
      map.set(m.id, m.name);
    }
    return map;
  }, [models]);

  const rows: AgentDebugInfoRow[] = useMemo(() => {
    return (debugInfo as DebugInfoType[]).map((d) => {
      const modelId = modelIdByRunId.get(d.modelRunId) ?? null;
      const modelName = modelId ? (modelNameById.get(modelId) ?? modelId) : "";
      return {
        id: d.id,
        createdAt: d.createdAt,
        modelRunId: d.modelRunId,
        content: d.content,
        modelId,
        modelName,
      } satisfies AgentDebugInfoRow;
    });
  }, [debugInfo, modelIdByRunId, modelNameById]);

  const modelOptions = useMemo(
    () =>
      ((models as Model[]) || []).map((m) => ({
        value: m.id,
        label: m.name,
      })),
    [models]
  );

  const isLoading = isLoadingRuns || isLoadingDebug || isLoadingModels;

  return (
    <AgentDebugInfoDataTable
      data={rows}
      modelOptions={modelOptions}
      isLoading={isLoading}
    />
  );
}

export default AgentDebugInfo;
