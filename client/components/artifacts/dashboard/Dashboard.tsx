"use client";

import type { OutputOf } from "@/lib/api/types";
import type {
  BulkArchiveAttemptsIn,
  BulkArchiveAttemptsOut,
} from "@/app/(main)/analytics/dashboard/page";

import DashboardHeader from "./DashboardHeader";
import DashboardPrimary from "./DashboardPrimary";
import DashboardSecondary from "./DashboardSecondary";
import DashboardFooter from "./DashboardFooter";
import SimulationHistory from "@/components/common/SimulationHistory";
type DashboardOut = OutputOf<"/api/v4/artifacts/dashboard/get", "post">;
type DashboardHistoryOut = NonNullable<DashboardOut["history"]>;

export interface DashboardProps {
  data: DashboardOut;
  // Section picker props
  rubricIds?: string[];
  rubricSearch?: string;
  rubricIndex?: number;
  simulationPickerIds?: string[];
  simulationPickerSearch?: string;
  simulationIndex?: number;
  parameterIds?: string[];
  parameterSearch?: string;
  parameterIndex?: number;
  scenarioIds?: string[];
  scenarioSearch?: string;
  scenarioIndex?: number;
  // History props
  historyPage?: number;
  historyPageSize?: number;
  defaultFilters?: {
    startDate: string;
    endDate: string;
    cohortIds: string[];
    departmentIds: string[];
    roles: string[];
  };
  bulkArchiveAttemptsAction?: (
    input: BulkArchiveAttemptsIn,
  ) => Promise<BulkArchiveAttemptsOut>;
  historyProfileSearch?: string;
  historySimulationSearch?: string;
  historyScenarioSearch?: string;
}

export default function Dashboard({
  data,
  rubricIds,
  rubricSearch,
  rubricIndex = 0,
  simulationPickerIds,
  simulationPickerSearch,
  simulationIndex = 0,
  parameterIds,
  parameterSearch,
  parameterIndex = 0,
  scenarioIds,
  scenarioSearch,
  scenarioIndex = 0,
  historyPage = 0,
  historyPageSize = 10,
  defaultFilters,
  bulkArchiveAttemptsAction,
  historyProfileSearch,
  historySimulationSearch,
  historyScenarioSearch,
}: DashboardProps) {
  // --- History extraction ---
  const historyData: DashboardHistoryOut = data.history || {
    data: [],
    total_count: 0,
    page: 0,
    page_size: historyPageSize,
    total_pages: 0,
  };

  const dataArray = historyData.data || [];
  const archivedCount = dataArray.filter(
    (item: { is_archived?: boolean | null }) => item.is_archived,
  ).length;
  const unarchivedCount = dataArray.filter(
    (item: { is_archived?: boolean | null }) => !item.is_archived,
  ).length;

  const profileOptions = (historyData.profile_options || []).map(
    (opt: {
      value?: string | null;
      label?: string | null;
      count?: number | null;
    }) => {
      const count = typeof opt.count === "number" ? opt.count : undefined;
      return {
        value: String(opt.value || ""),
        label: String(opt.label || ""),
        ...(count !== undefined && { count }),
      };
    },
  );
  const simulationOptions = (historyData.simulation_options || []).map(
    (opt: {
      value?: string | null;
      label?: string | null;
      count?: number | null;
    }) => {
      const count = typeof opt.count === "number" ? opt.count : undefined;
      return {
        value: String(opt.value || ""),
        label: String(opt.label || ""),
        ...(count !== undefined && { count }),
      };
    },
  );
  const scenarioOptions = (historyData.scenario_options || []).map(
    (opt: {
      value?: string | null;
      label?: string | null;
      count?: number | null;
    }) => {
      const count = typeof opt.count === "number" ? opt.count : undefined;
      return {
        value: String(opt.value || ""),
        label: String(opt.label || ""),
        ...(count !== undefined && { count }),
      };
    },
  );

  return (
    <div className="space-y-6" data-page="dashboard-index">
      {/* Header - full width */}
      <DashboardHeader data={data} />

      {/* Primary + Secondary in side-by-side grid */}
      <div
        className="grid gap-6 grid-cols-1 lg:grid-cols-[3fr_2fr] pb-2 items-stretch"
        style={{ gridAutoRows: "1fr" }}
      >
        <DashboardPrimary
          data={data}
          initialRubricIds={rubricIds}
          rubricSearch={rubricSearch}
          initialIndex={rubricIndex}
        />
        <DashboardSecondary
          data={data}
          initialSimulationIds={simulationPickerIds}
          simulationSearch={simulationPickerSearch}
          initialIndex={simulationIndex}
        />
      </div>

      {/* Footer - single boundary, internal 2-col grid */}
      <DashboardFooter
        data={data}
        initialParameterIds={parameterIds}
        parameterSearch={parameterSearch}
        initialParameterIndex={parameterIndex}
        initialScenarioIds={scenarioIds}
        scenarioSearch={scenarioSearch}
        initialScenarioIndex={scenarioIndex}
      />

      {/* History - below all graphs */}
      <div>
        <SimulationHistory
          data={dataArray}
          totalCount={historyData.total_count || 0}
          archivedCount={archivedCount}
          unarchivedCount={unarchivedCount}
          pageIndex={historyPage}
          pageSize={historyPageSize}
          showExport={false}
          showArchive={!!bulkArchiveAttemptsAction}
          singleProfile={false}
          initialFilters={defaultFilters}
          profileOptions={profileOptions}
          simulationOptions={simulationOptions}
          scenarioOptions={scenarioOptions}
          profileSearch={historyProfileSearch || ""}
          simulationSearch={historySimulationSearch || ""}
          scenarioSearch={historyScenarioSearch || ""}
          {...(bulkArchiveAttemptsAction && { bulkArchiveAttemptsAction })}
        />
      </div>

    </div>
  );
}
