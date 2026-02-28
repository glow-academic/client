"use client";

import type { OutputOf } from "@/lib/api/types";

import DashboardHeader from "@/components/artifacts/dashboard/DashboardHeader";
import DashboardPrimary from "@/components/artifacts/dashboard/DashboardPrimary";
import DashboardSecondary from "@/components/artifacts/dashboard/DashboardSecondary";
import DashboardFooter from "@/components/artifacts/dashboard/DashboardFooter";
import SimulationHistory from "@/components/common/SimulationHistory";
import ProfileHeader from "@/components/artifacts/reports/ProfileHeader";
type DashboardOut = OutputOf<"/api/v4/artifacts/dashboard/get", "post">;
type ReportHistoryOut = NonNullable<DashboardOut["history"]>;

export interface RecordProps {
  data: DashboardOut;
  profileData: {
    name: string | null;
    emails: string[] | null;
    primary_email: string | null;
    role: string | null;
  };
  // Section picker props
  profileId?: string;
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
    simulationFilters: string[];
  };
  initialColumnVisibility?: Record<string, boolean>;
}

export default function Record({
  data,
  profileData,
  profileId,
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
  initialColumnVisibility,
}: RecordProps) {
  // --- History extraction ---
  const historyData: ReportHistoryOut = data.history || {
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
    <div className="space-y-6">
      {/* Profile header with name/email/role */}
      <ProfileHeader profileData={profileData} />

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
          profileId={profileId}
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
          showArchive={false}
          singleProfile={true}
          initialFilters={
            defaultFilters
              ? {
                  startDate: defaultFilters.startDate,
                  endDate: defaultFilters.endDate,
                  cohortIds: defaultFilters.cohortIds,
                  departmentIds: defaultFilters.departmentIds,
                  roles: defaultFilters.roles,
                }
              : undefined
          }
          profileOptions={[]}
          simulationOptions={simulationOptions}
          scenarioOptions={scenarioOptions}
          initialColumnVisibility={initialColumnVisibility}
        />
      </div>

    </div>
  );
}
