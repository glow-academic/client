/**
 * SimulationHistory.tsx
 * Used to display the simulation history page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */

import { useHistoryColumns } from "@/hooks/use-history-columns";
import type { FilteredData } from "@/utils/analytics/filtering";
import type {
  AnalyticsBasePayload,
  AttemptRow,
  ChatRow,
  CohortRow,
  GradeRow,
  MessageRow,
  ProfileRow,
  RubricRow,
  ScenarioRow,
  SimulationRow,
  StandardGroupRow,
  StandardRow,
} from "@/utils/api/analytics/get-history";
import * as React from "react";
import { DataTable } from "./DataTable";

export interface SimulationHistoryProps {
  // Required: Whether to show export functionality
  showExport: boolean;

  // Required: Whether to show archive functionality
  showArchive: boolean;

  // Optional: Whether to hide Name column when all attempts have the same profile
  singleProfile?: boolean;

  // Required: Server-side history payload
  serverData: AnalyticsBasePayload | null;
}

export default function SimulationHistory({
  showExport,
  showArchive,
  singleProfile = false,
  serverData,
}: SimulationHistoryProps) {
  // Transform server history payload to FilteredData shape when requested
  const transformedData = React.useMemo<FilteredData | null>(() => {
    if (!serverData) return null;

    // Helpers to map snake_case to camelCase minimal fields used by history table
    const attempts = (serverData.attempts || []).map((a: AttemptRow) => ({
      id: String(a.id),
      profileId: a.profile_id ? String(a.profile_id) : null,
      simulationId: String(a.simulation_id),
      createdAt: String(a.created_at || ""),
      archived: Boolean(a.archived ?? false),
      infiniteMode: Boolean(a.infinite_mode ?? false),
      infiniteModeTimeLimit: a.infinite_mode_time_limit ?? null,
    }));

    const chats = (serverData.chats || []).map((c: ChatRow) => ({
      id: String(c.id),
      attemptId: String(c.attempt_id),
      scenarioId: c.scenario_id ? String(c.scenario_id) : "",
      completed: Boolean(c.completed ?? Boolean(c.completed_at)),
      createdAt: String(c.created_at || ""),
      completedAt: c.completed_at ? String(c.completed_at) : null,
    }));

    const grades = (serverData.grades || []).map((g: GradeRow) => ({
      id: String(g.id),
      simulationChatId: String(g.simulation_chat_id),
      rubricId: String(g.rubric_id || ""),
      score: Number(g.score ?? 0),
      passed: Boolean(g.passed ?? false),
      timeTaken: Number(g.time_taken ?? 0),
      createdAt: String(g.created_at || ""),
    }));

    const simulations = (serverData.simulations || []).map(
      (s: SimulationRow) => ({
        id: String(s.id),
        title: String(s.title ?? "Simulation"),
        rubricId: String(s.rubric_id || ""),
        practiceSimulation: Boolean(s.practice_simulation ?? false),
        scenarioIds: (s.scenario_ids || []).map((x: string) => String(x)),
        description: s.description ?? null,
        timeLimit: s.time_limit ?? null,
        active: Boolean(s.active ?? true),
      })
    );

    const scenarios = (serverData.scenarios || []).map((sc: ScenarioRow) => ({
      id: String(sc.id),
      name: String(sc.name ?? "Scenario"),
      personaId: sc.persona_id ? String(sc.persona_id) : null,
      parentId: sc.parent_id ? String(sc.parent_id) : null,
      active: Boolean(sc.active ?? true),
    }));

    const profiles = (serverData.profiles || []).map((p: ProfileRow) => ({
      id: String(p.id),
      firstName: String(p.first_name ?? ""),
      lastName: String(p.last_name ?? ""),
      role: p.role ?? undefined,
    }));

    const cohorts = (serverData.cohorts || []).map((c: CohortRow) => ({
      id: String(c.id),
      title: String(c.title ?? ""),
      active: Boolean(c.active ?? true),
      profileIds: (c.profile_ids || []).map((x: string) => String(x)),
      simulationIds: (c.simulation_ids || []).map((x: string) => String(x)),
      createdAt: String(c.created_at || ""),
    }));

    const rubrics = (serverData.rubrics || []).map((r: RubricRow) => ({
      id: String(r.id),
      points: Number(r.points ?? 100),
      passPoints: Number(r.pass_points ?? 70),
    }));

    const standardGroups = (serverData.standardGroups || []).map(
      (g: StandardGroupRow) => ({
        id: String(g.id),
        rubricId: String(g.rubric_id || ""),
      })
    );

    const standards = (serverData.standards || []).map((s: StandardRow) => ({
      id: String(s.id),
      standardGroupId: String(s.standard_group_id || ""),
    }));

    const messages = (serverData.messages || []).map((m: MessageRow) => ({
      id: String(m.id),
      chatId: String(m.chat_id),
      createdAt: String(m.created_at || ""),
      type: m.type ?? undefined,
    }));

    return {
      attempts,
      chats,
      grades,
      feedbacks: serverData.feedbacks || [],
      messages,
      simulations,
      scenarios,
      profiles,
      cohorts,
      rubrics,
      standardGroups,
      standards,
      parameters: [],
      parameterItems: [],
      personas: [],
      agents: [],
    } as unknown as FilteredData;
  }, [serverData]);

  // Check if all attempts have the same profileId (only when singleProfile is true)
  const allSameProfile = React.useMemo(() => {
    const source = transformedData;
    if (!singleProfile || !source?.attempts || source.attempts.length === 0) {
      return false;
    }

    const firstProfileId = source.attempts[0]?.profileId;
    if (!firstProfileId) {
      return false;
    }

    return source.attempts.every(
      (attempt) => attempt.profileId === firstProfileId
    );
  }, [transformedData, singleProfile]);

  const { columns, data, profileOptions, simulationOptions, scenarioOptions } =
    useHistoryColumns({
      filteredData: transformedData,
      showExport,
      showArchive,
      allSameProfile, // Pass this information to the hook
    });

  // Create a key based on the data to force re-render when data changes
  const tableKey = React.useMemo(() => {
    if (!data || data.length === 0) return "empty";
    return data.map((item) => (item as { id: string }).id).join("-");
  }, [data]);

  return (
    <DataTable
      key={tableKey}
      data={data || []}
      columns={columns as never}
      profileOptions={profileOptions}
      simulationOptions={simulationOptions}
      scenarioOptions={scenarioOptions}
      showExport={showExport}
      showArchive={showArchive}
      showAll={true} // Always show all since filtering is handled upstream
    />
  );
}
