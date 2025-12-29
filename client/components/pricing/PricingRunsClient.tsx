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
  // Use arrays directly (no mapping construction)

  const rows = useMemo<GroupRunRow[]>(() => {
    return (runsData?.group_runs || []).map((group) => {
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
  }, [runsData?.group_runs]);

  return (
    <div className="mt-6" data-testid="pricing-runs-table">
      <RunsDataTable
        rows={rows}
        models={runsData?.models || []}
        profiles={runsData?.profiles || []}
        agents={runsData?.agents || []}
        personas={runsData?.personas || []}
        isLoading={isLoading}
        modelOptions={runsData?.model_options || []}
        profileOptions={runsData?.profile_options || []}
        actorOptions={runsData?.actor_options || []}
        totalCount={runsData?.total_count || 0}
        totalPages={runsData?.total_pages || 0}
      />
    </div>
  );
}
