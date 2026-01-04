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
    return (runsData?.group_runs || [])
      .filter((group): group is typeof group & { group_id: string; created_at: string } => 
        group.group_id !== null && group.created_at !== null
      )
      .map((group) => {
        const row: GroupRunRow = {
          groupId: group.group_id,
          createdAt: group.created_at,
          runCount: group.run_count ?? 0,
          totalInputTokens: group.total_input_tokens ?? 0,
          totalOutputTokens: group.total_output_tokens ?? 0,
          totalCost: group.total_cost ?? 0,
          runs: (group.runs || [])
            .filter((run): run is typeof run & { run_id: string; created_at: string } =>
              run.run_id !== null && run.created_at !== null
            )
            .map((run) => ({
              runId: run.run_id,
              createdAt: run.created_at,
              modelId: run.model_id ?? null,
              agentId: run.agent_id ?? null,
              personaId: run.persona_id ?? null,
              profileId: run.profile_id ?? null,
              inputTokens: run.input_tokens ?? 0,
              outputTokens: run.output_tokens ?? 0,
              cost: run.cost ?? 0,
              ...(run.debug_info && run.debug_info.length > 0 ? {
                debugInfo: run.debug_info
                  .filter((d): d is typeof d & { id: string; created_at: string; content: string } =>
                    d.id !== null && d.created_at !== null && d.content !== null
                  )
                  .map((d) => ({
                    id: d.id,
                    created_at: d.created_at,
                    content: d.content,
                  }))
              } : {}),
            })),
        };

        return row;
      });
  }, [runsData?.group_runs]);

  return (
    <div className="mt-6" data-testid="pricing-runs-table">
      <RunsDataTable
        rows={rows}
        models={(runsData?.models || [])
          .filter((m): m is typeof m & { model_id: string; name: string } => 
            m.model_id !== null && m.name !== null
          )
          .map((m) => ({
            model_id: m.model_id!,
            name: m.name!,
            description: m.description || "",
            input_ppm: m.input_ppm ?? 0,
            output_ppm: m.output_ppm ?? 0,
          }))}
        profiles={(runsData?.profiles || [])
          .filter((p): p is typeof p & { profile_id: string; name: string } => 
            p.profile_id !== null && p.name !== null
          )
          .map((p) => ({
            profile_id: p.profile_id!,
            name: p.name!,
          }))}
        agents={(runsData?.agents || [])
          .filter((a): a is typeof a & { agent_id: string; name: string } => 
            a.agent_id !== null && a.name !== null
          )
          .map((a) => ({
            agent_id: a.agent_id!,
            name: a.name!,
          }))}
        personas={(runsData?.personas || [])
          .filter((p): p is typeof p & { persona_id: string; name: string } => 
            p.persona_id !== null && p.name !== null
          )
          .map((p) => ({
            persona_id: p.persona_id!,
            name: p.name!,
          }))}
        isLoading={isLoading}
        modelOptions={(runsData?.model_options || [])
          .filter((opt): opt is typeof opt & { value: string; label: string } => 
            opt.value !== null && opt.label !== null
          )
          .map((opt) => ({
            value: opt.value!,
            label: opt.label!,
            ...(opt.count !== null ? { count: opt.count } : {}),
          }))}
        profileOptions={(runsData?.profile_options || [])
          .filter((opt): opt is typeof opt & { value: string; label: string } => 
            opt.value !== null && opt.label !== null
          )
          .map((opt) => ({
            value: opt.value!,
            label: opt.label!,
            ...(opt.count !== null ? { count: opt.count } : {}),
          }))}
        actorOptions={(runsData?.actor_options || [])
          .filter((opt): opt is typeof opt & { value: string; label: string } => 
            opt.value !== null && opt.label !== null
          )
          .map((opt) => ({
            value: opt.value!,
            label: opt.label!,
            ...(opt.count !== null ? { count: opt.count } : {}),
          }))}
        totalCount={runsData?.total_count || 0}
        totalPages={runsData?.total_pages || 0}
      />
    </div>
  );
}
