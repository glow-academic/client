/**
 * SimulationHistory.tsx
 * Used to display the simulation history page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */

import { useHistoryColumns } from "@/hooks/use-history-columns";
// no filtered client transformation needed; server returns precomputed rows
import type {
  HistoryResponse,
  HistoryRow,
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
  serverData: HistoryResponse | null;
}

export default function SimulationHistory({
  showExport,
  showArchive,
  singleProfile = false,
  serverData,
}: SimulationHistoryProps) {
  // Transform new server response to the minimal client needs
  type MinimalTransformed = {
    attempts: Array<{
      id: string;
      profileId: string | null;
      simulationId: string;
      createdAt: string;
      archived: boolean;
      infiniteMode: boolean;
      infiniteModeTimeLimit: number | null;
      scenarios: Array<{
        id: string;
        attemptId: string;
        scenarioId: string;
        createdAt: string;
        completedAt: string | null;
        completed: boolean;
      }>;
      personasTested: string[];
      interactionIds: string[];
      completedWithRubricCount?: number;
      totalExpected?: number;
      scorePercent?: number;
      isPractice?: boolean;
      rootScenarioIds?: string[];
      isIncomplete?: boolean;
    }>;
    profiles: { value: string; label: string }[];
    simulations: { value: string; label: string }[];
    scenarios: { value: string; label: string }[];
  };

  const transformedData = React.useMemo<MinimalTransformed | null>(() => {
    if (!serverData) return null;
    const attempts = (serverData.rows || []).map((r: HistoryRow) => ({
      id: String(r.id),
      profileId: r.profileId ? String(r.profileId) : null,
      simulationId: String(r.simulationId),
      createdAt: String(r.createdAt || ""),
      archived: Boolean(r.archived ?? false),
      infiniteMode: Boolean(r.infiniteMode ?? false),
      infiniteModeTimeLimit: r.infiniteModeTimeLimit ?? null,
      scenarios: r.scenarios.map((c) => ({
        id: String(c.id),
        attemptId: String(c.attemptId),
        scenarioId: c.scenarioId ? String(c.scenarioId) : "",
        completed: Boolean(c.completed),
        createdAt: String(c.createdAt || ""),
        completedAt: c.completedAt ? String(c.completedAt) : null,
      })),
      personasTested: r.personasTested || [],
      interactionIds: r.interactionIds || [],
      completedWithRubricCount: r.completedWithRubricCount,
      totalExpected: r.totalExpected,
      scorePercent: r.scorePercent,
      isPractice: r.isPractice,
      rootScenarioIds: r.rootScenarioIds || [],
      isIncomplete: r.isIncomplete,
    }));

    const profiles = (serverData.profiles || []).map((p) => ({
      value: String(p.id),
      label: String(p.name || ""),
    }));
    const simulations = (serverData.simulations || []).map((s) => ({
      value: String(s.id),
      label: String(s.title || "Simulation"),
    }));
    const scenarios = (serverData.rootScenarios || []).map((s) => ({
      value: String(s.id),
      label: String(s.name || "Scenario"),
    }));

    return { attempts, profiles, simulations, scenarios };
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
      filteredData: null,
      showExport,
      showArchive,
      allSameProfile, // Pass this information to the hook
      precomputedAttempts: transformedData?.attempts as never,
      precomputedProfileOptions: transformedData?.profiles as never,
      precomputedSimulationOptions: transformedData?.simulations as never,
      precomputedScenarioOptions: transformedData?.scenarios as never,
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
