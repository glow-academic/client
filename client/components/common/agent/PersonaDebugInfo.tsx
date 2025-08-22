"use client";

import { useMemo } from "react";

import { DebugInfo as DebugInfoType, Model, ModelRun } from "@/types";
import PersonaDebugInfoDataTable from "./PersonaDebugInfoDataTable";
import { useModelRunsByPersonaId } from "@/lib/api/hooks/model_runs";
import { useDebugInfoByModelRunIdBatch } from "@/lib/api/hooks/debug_info";
import { useModels } from "@/lib/api/hooks/models";

export interface PersonaDebugInfoProps {
  personaId: string;
}

export interface PersonaDebugInfoRow {
  id: string;
  createdAt: string;
  modelRunId: string;
  content: string;
  modelId: string | null;
  modelName: string;
}

export function PersonaDebugInfo({ personaId }: PersonaDebugInfoProps) {
  const {data: modelRuns = [], isLoading: isLoadingRuns} = useModelRunsByPersonaId(personaId);

  const modelRunIds = useMemo(
    () => (modelRuns as ModelRun[]).map((mr) => mr.id),
    [modelRuns]
  );

  const {data: debugInfo = [], isLoading: isLoadingDebug} = useDebugInfoByModelRunIdBatch(modelRunIds);

  const {data: models = [], isLoading: isLoadingModels} = useModels();

  const modelIdByRunId = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const mr of modelRuns || []) {
      map.set(mr.id, (mr as ModelRun).modelId || null);
    }
    return map;
  }, [modelRuns]);

  const modelNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of (models as Model[]) || []) {
      map.set(m.id, m.name);
    }
    return map;
  }, [models]);

  const rows: PersonaDebugInfoRow[] = useMemo(() => {
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
      } satisfies PersonaDebugInfoRow;
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
    <PersonaDebugInfoDataTable
      data={rows}
      modelOptions={modelOptions}
      isLoading={isLoading}
    />
  );
}

export default PersonaDebugInfo;
