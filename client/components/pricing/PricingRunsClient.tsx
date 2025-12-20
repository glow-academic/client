"use client";

/**
 * PricingRunsClient.tsx
 * Runs table component for pricing analytics.
 * This component is wrapped in Suspense and remounts when runsKey changes.
 */

import { useMemo } from "react";

import { RunsDataTable, type GroupRunRow } from "./RunsDataTable";
import type { PricingRunsOut } from "@/app/(main)/analytics/pricing/page";

interface PricingRunsClientProps {
  runsData: PricingRunsOut;
  isLoading: boolean;
}

export function PricingRunsClient({
  runsData,
  isLoading,
}: PricingRunsClientProps) {
  const rows = useMemo<GroupRunRow[]>(() => {
    return (runsData?.data || []).map((group) => {
      const row: GroupRunRow = {
        groupId: group.group_id,
        createdAt: group.created_at,
        runCount: group.run_count,
        totalInputTokens: group.total_input_tokens,
        totalOutputTokens: group.total_output_tokens,
        totalCost: group.total_cost,
        runs: (group.runs || []).map((run) => ({
          runId: run.run_id,
          createdAt: run.created_at,
          modelId: run.model_id ?? null,
          agentId: run.agent_id ?? null,
          personaId: run.persona_id ?? null,
          profileId: run.profile_id ?? null,
          inputTokens: run.input_tokens,
          outputTokens: run.output_tokens,
          cost: run.cost,
          ...(run.debug_info && { debugInfo: run.debug_info }),
        })),
      };

      return row;
    });
  }, [runsData]);

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
