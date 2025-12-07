"use client";

/**
 * PricingRunsClient.tsx
 * Runs table component for pricing analytics.
 * This component is wrapped in Suspense and remounts when runsKey changes.
 */

import { useMemo } from "react";

import { RunsDataTable, type ModelRunRow } from "./RunsDataTable";
import type { PricingRunsOut } from "@/app/(main)/analytics/pricing/page";

interface PricingRunsClientProps {
  runsData: PricingRunsOut;
  isLoading: boolean;
}

export function PricingRunsClient({
  runsData,
  isLoading,
}: PricingRunsClientProps) {
  const { model_mapping, agent_mapping, persona_mapping, profile_mapping } =
    runsData;

  const rows = useMemo<ModelRunRow[]>(() => {
    return (runsData?.data || []).map((run) => {
      const modelId = run.model_id ?? null;
      const agentId = run.agent_id ?? null;
      const personaId = run.persona_id ?? null;
      const profileId = run.profile_id ?? null;

      const modelInfo = modelId ? model_mapping[modelId] : undefined;
      const inputCost =
        (run.input_tokens / 1_000_000) * (modelInfo?.input_ppm || 0);
      const outputCost =
        (run.output_tokens / 1_000_000) * (modelInfo?.output_ppm || 0);
      const cost = Number((inputCost + outputCost).toFixed(6));

      const row: ModelRunRow = {
        id: run.model_run_id,
        createdAt: run.created_at,
        modelId,
        modelName: (modelId && model_mapping[modelId]?.name) || modelId || "",
        agentId,
        agentName: (agentId && agent_mapping[agentId]) || agentId || "",
        personaId,
        personaName:
          (personaId && persona_mapping[personaId]) || personaId || "",
        profileId,
        profileName:
          (profileId && profile_mapping[profileId]) || profileId || "",
        inputTokens: run.input_tokens,
        outputTokens: run.output_tokens,
        cost,
      };

      if (run.debug_info) row.debugInfo = run.debug_info;

      return row;
    });
  }, [
    runsData,
    model_mapping,
    agent_mapping,
    persona_mapping,
    profile_mapping,
  ]);

  return (
    <div className="mt-6" data-testid="pricing-runs-table">
      <RunsDataTable
        rows={rows}
        modelMapping={runsData.model_mapping || {}}
        profileMapping={runsData.profile_mapping || {}}
        agentMapping={runsData.agent_mapping || {}}
        personaMapping={runsData.persona_mapping || {}}
        isLoading={isLoading}
        modelOptions={runsData.modelOptions || []}
        profileOptions={runsData.profileOptions || []}
        actorOptions={runsData.actorOptions || []}
        totalCount={runsData.totalCount || 0}
        totalPages={runsData.totalPages || 0}
      />
    </div>
  );
}
