/**
 * app/(main)/analytics/reports/[profileId]/page.tsx
 * Reports page for the user.
 * Decomposed into 4 independent Suspense-wrapped sections for parallel streaming.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import SimulationHistory from "@/components/artifacts/attempt/history/SimulationHistory";
import DashboardFooter from "@/components/artifacts/dashboard/DashboardFooter";
import DashboardHeader from "@/components/artifacts/dashboard/DashboardHeader";
import DashboardPrimary from "@/components/artifacts/dashboard/DashboardPrimary";
import DashboardSecondary from "@/components/artifacts/dashboard/DashboardSecondary";
import FooterSkeleton from "@/components/artifacts/dashboard/skeletons/FooterSkeleton";
import HeaderSkeleton from "@/components/artifacts/dashboard/skeletons/HeaderSkeleton";
import PrimarySkeleton from "@/components/artifacts/dashboard/skeletons/PrimarySkeleton";
import SecondarySkeleton from "@/components/artifacts/dashboard/skeletons/SecondarySkeleton";
import ProfileHeader from "@/components/artifacts/reports/ProfileHeader";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import {
  computeAnalyticsDefaults,
  resolveAnalyticsFilters,
} from "@/lib/search-params/analytics-defaults";
import type { Metadata } from "next";
import { Suspense } from "react";
import { loadProfileReportSearchParams } from "@/lib/search-params/profile-report";

/** ---- Strong types from OpenAPI ---- */
type HeaderIn = InputOf<"/api/v4/artifacts/dashboard/header", "post">;
type HeaderOut = OutputOf<"/api/v4/artifacts/dashboard/header", "post">;
type PrimaryIn = InputOf<"/api/v4/artifacts/dashboard/primary", "post">;
type PrimaryOut = OutputOf<"/api/v4/artifacts/dashboard/primary", "post">;
type SecondaryIn = InputOf<"/api/v4/artifacts/dashboard/secondary", "post">;
type SecondaryOut = OutputOf<"/api/v4/artifacts/dashboard/secondary", "post">;
type FooterIn = InputOf<"/api/v4/artifacts/dashboard/footer", "post">;
type FooterOut = OutputOf<"/api/v4/artifacts/dashboard/footer", "post">;
// History section
type ReportHistoryIn = InputOf<"/api/v4/artifacts/attempt/list", "post">;
type ReportHistoryOut = OutputOf<"/api/v4/artifacts/attempt/list", "post">;

/** ---- Section fetch functions ---- */
const getReportHeader = async (input: HeaderIn): Promise<HeaderOut> => {
  const bypassCache = await isHardRefresh();
  return api.post("/artifacts/dashboard/header", input, {
    cache: "no-store",
    ...(bypassCache && { headers: { "X-Bypass-Cache": "1" } }),
  });
};

const getReportPrimary = async (input: PrimaryIn): Promise<PrimaryOut> => {
  const bypassCache = await isHardRefresh();
  return api.post("/artifacts/dashboard/primary", input, {
    cache: "no-store",
    ...(bypassCache && { headers: { "X-Bypass-Cache": "1" } }),
  });
};

const getReportSecondary = async (input: SecondaryIn): Promise<SecondaryOut> => {
  const bypassCache = await isHardRefresh();
  return api.post("/artifacts/dashboard/secondary", input, {
    cache: "no-store",
    ...(bypassCache && { headers: { "X-Bypass-Cache": "1" } }),
  });
};

const getReportFooter = async (input: FooterIn): Promise<FooterOut> => {
  const bypassCache = await isHardRefresh();
  return api.post("/artifacts/dashboard/footer", input, {
    cache: "no-store",
    ...(bypassCache && { headers: { "X-Bypass-Cache": "1" } }),
  });
};

const getReportHistory = async (
  input: ReportHistoryIn
): Promise<ReportHistoryOut> => {
  const bypassCache = await isHardRefresh();
  return api.post("/artifacts/attempt/list", input, {
    cache: "no-store",
    ...(bypassCache && { headers: { "X-Bypass-Cache": "1" } }),
  });
};

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/api/v4/artifacts/reports/docs", "post">;
type DocsOut = OutputOf<"/api/v4/artifacts/reports/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/artifacts/reports/docs", input);
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ profileId: string }>;
}): Promise<Metadata> {
  const { profileId } = await params;
  const docs = await getDocs({ body: { entity_id: profileId } });
  return { title: docs.detail.title, description: docs.detail.description };
}

interface ProfileReportsPageProps {
  params: Promise<{ profileId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ReportsPage({
  params,
  searchParams,
}: ProfileReportsPageProps) {
  const { profileId } = await params;

  // Parse search params via nuqs loader
  const q = loadProfileReportSearchParams(await searchParams);

  // Compute defaults and resolve filters
  const { defaults, profileContext } = await computeAnalyticsDefaults();
  const filters = resolveAnalyticsFilters(q, defaults, profileContext);

  // Section picker params
  const personaSimulationIds = q.personaSimulationIds ?? undefined;
  const personaSimulationsSearch = q.personaSimulationsSearch ?? undefined;
  const heatmapRubricIds = q.heatmapRubricIds ?? undefined;
  const heatmapRubricSearch = q.heatmapRubricSearch ?? undefined;
  const cohortSimulationIds = q.cohortSimulationIds ?? undefined;
  const cohortSimulationsSearch = q.cohortSimulationsSearch ?? undefined;
  const improvementSimulationIds = q.improvementSimulationIds ?? undefined;
  const improvementSimulationsSearch = q.improvementSimulationsSearch ?? undefined;
  const skillRubricIds = q.skillRubricIds ?? undefined;
  const skillRubricSearch = q.skillRubricSearch ?? undefined;
  const scenarioPerfParameterIds = q.scenarioPerfParameterIds ?? undefined;
  const scenarioPerfParamSearch = q.scenarioPerfParamSearch ?? undefined;
  const scenarioStatsParameterIds = q.scenarioStatsParameterIds ?? undefined;
  const scenarioStatsParamSearch = q.scenarioStatsParamSearch ?? undefined;
  const simPerfSimulationIds = q.simPerfSimulationIds ?? undefined;
  const simPerfSimulationSearch = q.simPerfSimulationSearch ?? undefined;

  // History params with defaults
  const historyPage = q.historyPage ?? 0;
  const historyPageSize = q.historyPageSize ?? 10;
  const historySearch = q.historySearch ?? undefined;
  const historySimulationIds = q.historySimulationIds ?? undefined;
  const historyScenarioIds = q.historyScenarioIds ?? undefined;
  const historyInfiniteMode = q.historyInfiniteMode ?? undefined;
  const historySortBy = q.historySortBy ?? "date";
  const historySortOrder = q.historySortOrder ?? "desc";

  // Common body params for all sections (includes profile targeting)
  const commonBody = {
    start_date: filters.startDate,
    end_date: filters.endDate,
    cohort_ids: filters.cohortIds,
    department_ids: filters.departmentIds,
    roles: filters.roles,
    simulation_filters: filters.simulationFilters,
    target_profile_id: profileId,
    actor_profile_id: profileContext.id || profileId,
    page_limit: 50,
    page_offset: 0,
  };

  // Suspense keys for each section
  const filterKey = [
    filters.startDate,
    filters.endDate,
    filters.cohortIds.join(","),
    filters.departmentIds.join(","),
    filters.roles.join(","),
    filters.simulationFilters.join(","),
    profileId,
  ].join("|");

  const headerKey = `header|${filterKey}`;

  const primaryKey = `primary|${filterKey}|${(personaSimulationIds || []).join(",")}|${personaSimulationsSearch || ""}|${(heatmapRubricIds || []).join(",")}|${heatmapRubricSearch || ""}`;

  const secondaryKey = `secondary|${filterKey}|${(cohortSimulationIds || []).join(",")}|${cohortSimulationsSearch || ""}|${(improvementSimulationIds || []).join(",")}|${improvementSimulationsSearch || ""}|${(skillRubricIds || []).join(",")}|${skillRubricSearch || ""}`;

  const footerKey = `footer|${filterKey}|${(scenarioPerfParameterIds || []).join(",")}|${scenarioPerfParamSearch || ""}|${(scenarioStatsParameterIds || []).join(",")}|${scenarioStatsParamSearch || ""}|${(simPerfSimulationIds || []).join(",")}|${simPerfSimulationSearch || ""}`;

  const historyKey = [
    "history",
    historyPage,
    historyPageSize,
    historySearch || "",
    (historySimulationIds || []).join(","),
    (historyScenarioIds || []).join(","),
    historyInfiniteMode === undefined
      ? "all"
      : historyInfiniteMode
        ? "inf"
        : "std",
    historySortBy,
    historySortOrder,
    filterKey,
  ].join("|");

  return (
    <div className="space-y-6">
      {/* Profile header with name/email/role - rendered from the header section data */}
      <Suspense key={`profile|${headerKey}`} fallback={<ProfileHeaderSkeleton />}>
        <ReportProfileHeaderSection commonBody={commonBody} />
      </Suspense>

      {/* Header - full width */}
      <Suspense key={headerKey} fallback={<HeaderSkeleton />}>
        <ReportHeaderSection commonBody={commonBody} />
      </Suspense>

      {/* Primary + Secondary in side-by-side grid */}
      <div
        className="grid gap-6 grid-cols-1 lg:grid-cols-[3fr_2fr] pb-2 items-stretch"
        style={{ gridAutoRows: "1fr" }}
      >
        <Suspense key={primaryKey} fallback={<PrimarySkeleton />}>
          <ReportPrimarySection
            commonBody={commonBody}
            personaSimulationIds={personaSimulationIds}
            personaSimulationsSearch={personaSimulationsSearch}
            heatmapRubricIds={heatmapRubricIds}
            heatmapRubricSearch={heatmapRubricSearch}
          />
        </Suspense>
        <Suspense key={secondaryKey} fallback={<SecondarySkeleton />}>
          <ReportSecondarySection
            commonBody={commonBody}
            profileId={profileId}
            cohortSimulationIds={cohortSimulationIds}
            cohortSimulationsSearch={cohortSimulationsSearch}
            improvementSimulationIds={improvementSimulationIds}
            improvementSimulationsSearch={improvementSimulationsSearch}
            skillRubricIds={skillRubricIds}
            skillRubricSearch={skillRubricSearch}
          />
        </Suspense>
      </div>

      {/* Footer - single boundary, internal 2-col grid */}
      <Suspense key={footerKey} fallback={<FooterSkeleton />}>
        <ReportFooterSection
          commonBody={commonBody}
          scenarioPerfParameterIds={scenarioPerfParameterIds}
          scenarioPerfParamSearch={scenarioPerfParamSearch}
          scenarioStatsParameterIds={scenarioStatsParameterIds}
          scenarioStatsParamSearch={scenarioStatsParamSearch}
          simPerfSimulationIds={simPerfSimulationIds}
          simPerfSimulationSearch={simPerfSimulationSearch}
        />
      </Suspense>

      {/* History section - filtered by profileId */}
      <div className="">
        <Suspense
          key={historyKey}
          fallback={
            <SimulationHistory
              data={[]}
              totalCount={0}
              archivedCount={0}
              unarchivedCount={0}
              pageIndex={historyPage}
              pageSize={historyPageSize}
              showExport={false}
              showArchive={false}
              singleProfile={true}
              initialFilters={{
                startDate: filters.startDate,
                endDate: filters.endDate,
                cohortIds: filters.cohortIds,
                departmentIds: filters.departmentIds,
                roles: filters.roles,
              }}
              profileOptions={[]}
              simulationOptions={[]}
              scenarioOptions={[]}
              isLoading={true}
            />
          }
        >
          <ReportHistorySection
            profileId={profileId}
            defaultFilters={filters}
            historyPage={historyPage}
            historyPageSize={historyPageSize}
            historySearch={historySearch}
            historySimulationIds={historySimulationIds}
            historyScenarioIds={historyScenarioIds}
            historyInfiniteMode={historyInfiniteMode}
            historySortBy={historySortBy}
            historySortOrder={historySortOrder}
          />
        </Suspense>
      </div>
    </div>
  );
}

/** ---- Inline async server components per section ---- */

type CommonBody = {
  start_date: string;
  end_date: string;
  cohort_ids: string[];
  department_ids: string[];
  roles: string[];
  simulation_filters: string[];
  target_profile_id: string;
  actor_profile_id: string;
  page_limit: number;
  page_offset: number;
};

function ProfileHeaderSkeleton() {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 outline outline-muted-foreground">
            <AvatarFallback>
              <Skeleton className="h-10 w-10 rounded-full" />
            </AvatarFallback>
          </Avatar>
          <div>
            <Skeleton className="h-7 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
      </div>
    </div>
  );
}

/** Fetch header data and render profile banner from it */
async function ReportProfileHeaderSection({
  commonBody,
}: {
  commonBody: CommonBody;
}) {
  const data = await getReportHeader({ body: commonBody });
  const profileData = {
    name: data.profile_name || null,
    emails: data.profile_emails || null,
    primary_email: data.profile_primary_email || null,
    role: data.profile_role || null,
  };
  return <ProfileHeader profileData={profileData} />;
}

async function ReportHeaderSection({
  commonBody,
}: {
  commonBody: CommonBody;
}) {
  const data = await getReportHeader({ body: commonBody });
  return <DashboardHeader data={data} />;
}

async function ReportPrimarySection({
  commonBody,
  personaSimulationIds,
  personaSimulationsSearch,
  heatmapRubricIds,
  heatmapRubricSearch,
}: {
  commonBody: CommonBody;
  personaSimulationIds?: string[] | undefined;
  personaSimulationsSearch?: string | undefined;
  heatmapRubricIds?: string[] | undefined;
  heatmapRubricSearch?: string | undefined;
}) {
  const data = await getReportPrimary({
    body: {
      ...commonBody,
      ...(personaSimulationIds?.length && {
        persona_simulation_ids: personaSimulationIds,
      }),
      ...(personaSimulationsSearch && {
        persona_simulations_search: personaSimulationsSearch,
      }),
      ...(heatmapRubricIds?.length && {
        heatmap_rubric_ids: heatmapRubricIds,
      }),
      ...(heatmapRubricSearch && {
        heatmap_rubric_search: heatmapRubricSearch,
      }),
    },
  });
  return (
    <DashboardPrimary
      data={data}
      initialPersonaSimulations={personaSimulationIds}
      initialHeatmapRubrics={heatmapRubricIds}
    />
  );
}

async function ReportSecondarySection({
  commonBody,
  profileId,
  cohortSimulationIds,
  cohortSimulationsSearch,
  improvementSimulationIds,
  improvementSimulationsSearch,
  skillRubricIds,
  skillRubricSearch,
}: {
  commonBody: CommonBody;
  profileId: string;
  cohortSimulationIds?: string[] | undefined;
  cohortSimulationsSearch?: string | undefined;
  improvementSimulationIds?: string[] | undefined;
  improvementSimulationsSearch?: string | undefined;
  skillRubricIds?: string[] | undefined;
  skillRubricSearch?: string | undefined;
}) {
  const data = await getReportSecondary({
    body: {
      ...commonBody,
      ...(cohortSimulationIds?.length && {
        cohort_simulation_ids: cohortSimulationIds,
      }),
      ...(cohortSimulationsSearch && {
        cohort_simulations_search: cohortSimulationsSearch,
      }),
      ...(improvementSimulationIds?.length && {
        improvement_simulation_ids: improvementSimulationIds,
      }),
      ...(improvementSimulationsSearch && {
        improvement_simulations_search: improvementSimulationsSearch,
      }),
      ...(skillRubricIds?.length && {
        skill_rubric_ids: skillRubricIds,
      }),
      ...(skillRubricSearch && {
        skill_rubric_search: skillRubricSearch,
      }),
    },
  });
  return (
    <DashboardSecondary
      data={data}
      profileId={profileId}
      initialCohortSimulations={cohortSimulationIds}
      initialImprovementSimulations={improvementSimulationIds}
      initialSkillRubrics={skillRubricIds}
    />
  );
}

async function ReportFooterSection({
  commonBody,
  scenarioPerfParameterIds,
  scenarioPerfParamSearch,
  scenarioStatsParameterIds,
  scenarioStatsParamSearch,
  simPerfSimulationIds,
  simPerfSimulationSearch,
}: {
  commonBody: CommonBody;
  scenarioPerfParameterIds?: string[] | undefined;
  scenarioPerfParamSearch?: string | undefined;
  scenarioStatsParameterIds?: string[] | undefined;
  scenarioStatsParamSearch?: string | undefined;
  simPerfSimulationIds?: string[] | undefined;
  simPerfSimulationSearch?: string | undefined;
}) {
  const data = await getReportFooter({
    body: {
      ...commonBody,
      ...(scenarioPerfParameterIds?.length && {
        scenario_perf_parameter_ids: scenarioPerfParameterIds,
      }),
      ...(scenarioPerfParamSearch && {
        scenario_perf_param_search: scenarioPerfParamSearch,
      }),
      ...(scenarioStatsParameterIds?.length && {
        scenario_stats_parameter_ids: scenarioStatsParameterIds,
      }),
      ...(scenarioStatsParamSearch && {
        scenario_stats_param_search: scenarioStatsParamSearch,
      }),
      ...(simPerfSimulationIds?.length && {
        sim_perf_simulation_ids: simPerfSimulationIds,
      }),
      ...(simPerfSimulationSearch && {
        sim_perf_simulation_search: simPerfSimulationSearch,
      }),
    },
  });
  return (
    <DashboardFooter
      data={data}
      initialScenarioPerfParameters={scenarioPerfParameterIds}
      initialScenarioStatsParameters={scenarioStatsParameterIds}
      initialSimPerfSimulations={simPerfSimulationIds}
    />
  );
}

/** ---- Inline history section component (only used here) ---- */
async function ReportHistorySection({
  profileId,
  defaultFilters,
  historyPage,
  historyPageSize,
  historySearch,
  historySimulationIds,
  historyScenarioIds,
  historyInfiniteMode,
  historySortBy,
  historySortOrder,
}: {
  profileId: string;
  defaultFilters: {
    startDate: string;
    endDate: string;
    cohortIds: string[];
    departmentIds: string[];
    roles: string[];
    simulationFilters: string[];
  };
  historyPage: number;
  historyPageSize: number;
  historySearch?: string | undefined;
  historySimulationIds?: string[] | undefined;
  historyScenarioIds?: string[] | undefined;
  historyInfiniteMode?: boolean | undefined;
  historySortBy: string;
  historySortOrder: string;
}) {
  const historyFilters: ReportHistoryIn = {
    body: {
      practice: false,
      target_profile_id: profileId,
      start_date: defaultFilters.startDate,
      end_date: defaultFilters.endDate,
      department_ids: defaultFilters.departmentIds,
      page: historyPage,
      page_size: historyPageSize,
      show_archived: false,
      ...(historySearch && { search: historySearch }),
      ...(historySimulationIds &&
        historySimulationIds.length > 0 && {
          simulation_ids: historySimulationIds,
        }),
      ...(historyScenarioIds &&
        historyScenarioIds.length > 0 && {
          scenario_ids: historyScenarioIds,
        }),
      ...(historyInfiniteMode !== undefined && {
        infinite_mode: historyInfiniteMode,
      }),
      sort_by: historySortBy,
      sort_order: historySortOrder,
    },
  };

  const historyData = await getReportHistory(historyFilters);

  const dataArray = historyData.data || [];
  const archivedCount = dataArray.filter((item: { is_archived?: boolean | null }) => item.is_archived).length;
  const unarchivedCount = dataArray.filter((item: { is_archived?: boolean | null }) => !item.is_archived).length;

  const simulationOptions = (historyData.simulation_options || []).map(
    (opt: { value?: string | null; label?: string | null; count?: number | null }) => {
      const count = typeof opt.count === "number" ? opt.count : undefined;
      return {
        value: String(opt.value || ""),
        label: String(opt.label || ""),
        ...(count !== undefined && { count }),
      };
    }
  );
  const scenarioOptions = (historyData.scenario_options || []).map(
    (opt: { value?: string | null; label?: string | null; count?: number | null }) => {
      const count = typeof opt.count === "number" ? opt.count : undefined;
      return {
        value: String(opt.value || ""),
        label: String(opt.label || ""),
        ...(count !== undefined && { count }),
      };
    }
  );

  return (
    <SimulationHistory
      data={dataArray}
      totalCount={historyData.total_count || 0}
      archivedCount={archivedCount}
      unarchivedCount={unarchivedCount}
      pageIndex={historyPage}
      pageSize={historyPageSize}
      showExport={false}
      showArchive={false}
      singleProfile={true}
      initialFilters={{
        startDate: defaultFilters.startDate,
        endDate: defaultFilters.endDate,
        cohortIds: defaultFilters.cohortIds,
        departmentIds: defaultFilters.departmentIds,
        roles: defaultFilters.roles,
      }}
      profileOptions={[]}
      simulationOptions={simulationOptions}
      scenarioOptions={scenarioOptions}
    />
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type GetProfileOut = {
  name: string | null;
  emails: string[] | null;
  primary_email: string | null;
  role: string | null;
};
export type { ReportHistoryIn, ReportHistoryOut, HeaderIn as ReportsOverviewIn, HeaderOut as ReportsOverviewOut };
