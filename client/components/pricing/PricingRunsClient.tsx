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
  // Transform group list items to GroupRunRow format
  const rows = useMemo<GroupRunRow[]>(() => {
    return (runsData?.items || [])
      .filter(
        (
          group
        ): group is typeof group & {
          group_id: string;
          last_run_at: string;
        } => group.group_id !== null && group.last_run_at !== null
      )
      .map((group) => {
        const row: GroupRunRow = {
          groupId: group.group_id,
          createdAt: group.last_run_at,
          groupName: group.group_name ?? undefined,
          runCount: group.run_count ?? 0,
          totalInputTokens: group.total_input_tokens ?? 0,
          totalOutputTokens: group.total_output_tokens ?? 0,
          totalCost: Number(group.total_cost ?? 0),
          // No nested runs in group list response
          runs: [],
          // Include model/agent names if available
          modelNames: group.model_names ?? [],
          agentNames: group.agent_names ?? [],
        };

        return row;
      });
  }, [runsData?.items]);

  // Calculate total pages from total_count
  const pageSize = 10; // Default page size
  const totalPages = Math.ceil((runsData?.total_count || 0) / pageSize);

  return (
    <div className="mt-6" data-testid="pricing-runs-table">
      <RunsDataTable
        rows={rows}
        models={[]}
        profiles={[]}
        agents={[]}
        isLoading={isLoading}
        modelOptions={[]}
        profileOptions={[]}
        actorOptions={[]}
        totalCount={runsData?.total_count || 0}
        totalPages={totalPages}
      />
    </div>
  );
}
