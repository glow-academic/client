/**
 * HistorySection.tsx
 * Server component that fetches and renders simulation history for the home page.
 * Wrapped in Suspense to enable partial loading states.
 * @AshokSaravanan222 & @siladiea
 * 11/18/2025
 */

import SimulationHistory from "@/components/common/history/SimulationHistory";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";

type HomeHistoryIn = InputOf<"/api/v3/home/history", "post">;
type HomeHistoryOut = OutputOf<"/api/v3/home/history", "post">;

interface HistorySectionProps {
  defaultFilters: {
    startDate: string;
    endDate: string;
    cohortIds: string[];
    departmentIds: string[];
    roles: string[];
  };
  historyPage: number;
  historyPageSize: number;
  historySearch?: string | undefined;
  historyProfileIds?: string[] | undefined;
  historySimulationIds?: string[] | undefined;
  historyScenarioIds?: string[] | undefined;
  historyInfiniteMode?: boolean | undefined;
  historySortBy: string;
  historySortOrder: string;
  effectiveProfileId?: string | null;
  revalidateAttemptAction: (attemptId: string) => Promise<void>;
}

export default async function HistorySection({
  defaultFilters,
  historyPage,
  historyPageSize,
  historySearch,
  historyProfileIds,
  historySimulationIds,
  historyScenarioIds,
  historyInfiniteMode,
  historySortBy,
  historySortOrder,
  effectiveProfileId,
  revalidateAttemptAction,
}: HistorySectionProps) {
  // Build history filters matching logic from page.tsx
  const historyFilters: HomeHistoryIn = {
    body: {
      profileId: effectiveProfileId || null,
      startDate: defaultFilters.startDate,
      endDate: defaultFilters.endDate,
      cohortIds: defaultFilters.cohortIds,
      departmentIds: defaultFilters.departmentIds,
      roles: defaultFilters.roles,
      page: historyPage,
      pageSize: historyPageSize,
      ...(historySearch && { search: historySearch }),
      ...(historyProfileIds &&
        historyProfileIds.length > 0 && {
          profileIds: historyProfileIds,
        }),
      ...(historySimulationIds &&
        historySimulationIds.length > 0 && {
          simulationIds: historySimulationIds,
        }),
      ...(historyScenarioIds &&
        historyScenarioIds.length > 0 && {
          scenarioIds: historyScenarioIds,
        }),
      ...(historyInfiniteMode !== undefined && {
        infiniteMode: historyInfiniteMode,
      }),
      sortBy: historySortBy,
      sortOrder: historySortOrder,
    },
  };

  const historyData = await api.post("/home/history", historyFilters);

  // Transform API response to match SimulationHistory expected format
  type ApiHistoryItem = HomeHistoryOut["data"][number];
  const transformedHistoryData = historyData.data.map(
    (item: ApiHistoryItem) => ({
      attemptId: item.attemptId,
      date: new Date(item.date),
      profileId: item.profileId,
      profileName: item.profileName,
      simulationName: item.simulationName,
      numScenarios: item.numScenarios ?? null,
      numScenariosCompleted: item.numScenariosCompleted,
      infiniteMode: item.infiniteMode,
      timeLimit: item.timeLimit ?? null,
      personaNames: item.personaNames,
      personaColors: item.personaColors,
      scenario_titles: item.scenario_titles,
      score: item.score ?? null,
      simulation_id: item.simulation_id,
      department_id: (() => {
        const deptIds = item.department_ids;
        if (
          deptIds &&
          Array.isArray(deptIds) &&
          deptIds.length > 0 &&
          deptIds[0]
        ) {
          return deptIds[0];
        }
        return "";
      })() as string,
      scenario_ids: item.scenario_ids,
      isArchived: item.isArchived,
      showView: item.showView,
      showContinue: item.showContinue,
      practiceSimulation: item.practiceSimulation ?? false,
      passPct: item.passPct || 70,
      cohortNames: item.cohortNames,
      ...(item.practiceScenarioId && {
        practiceScenarioId: item.practiceScenarioId,
      }),
    })
  );

  // Extract options from API response
  type HistoryDataWithOptions = HomeHistoryOut & {
    profileOptions?: Array<{ value: string; label: string; count?: number }>;
    simulationOptions?: Array<{ value: string; label: string; count?: number }>;
    scenarioOptions?: Array<{ value: string; label: string; count?: number }>;
  };
  const historyDataWithOptions =
    historyData as unknown as HistoryDataWithOptions;

  const profileOptions = historyDataWithOptions.profileOptions || [];
  const simulationOptions = historyDataWithOptions.simulationOptions || [];
  const scenarioOptions = historyDataWithOptions.scenarioOptions || [];

  return (
    <SimulationHistory
      data={transformedHistoryData}
      totalCount={historyData.totalCount}
      pageIndex={historyPage}
      pageSize={historyPageSize}
      showExport={true}
      showArchive={false}
      singleProfile={true}
      revalidateAttemptAction={revalidateAttemptAction}
      initialFilters={defaultFilters}
      profileOptions={profileOptions}
      simulationOptions={simulationOptions}
      scenarioOptions={scenarioOptions}
    />
  );
}
