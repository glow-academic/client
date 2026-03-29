/**
 * app/(main)/record/[recordId]/page.tsx
 * Canonical record (profile) page — dashboard report for a specific profile.
 * Uses a single /dashboard/get endpoint that returns all sections at once.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import Record from "@/components/artifacts/record/Record";
import { AnalyticsFilters } from "@/components/common/layout/AnalyticsFilters";
import { PageHeader } from "@/components/common/layout/PageHeader";
import { getProfileContext, refreshPage } from "@/app/(main)/layout-server";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import { readViewCookie } from "@/lib/view-cookie";
import type { Metadata } from "next";
import { loadProfileReportSearchParams } from "@/lib/search-params/profile-report";

/** ---- Strong types from OpenAPI ---- */
type DashboardIn = InputOf<"/dashboard/get", "post">;
type DashboardOut = OutputOf<"/dashboard/get", "post">;
type ReportHistoryOut = NonNullable<DashboardOut["history"]>;

/** ---- Fetch function ---- */
const getDashboard = async (input: DashboardIn): Promise<DashboardOut> => {
  const bypassCache = await isHardRefresh();
  return api.post("/dashboard/get", input, {
    cache: "no-store",
    ...(bypassCache && { headers: { "X-Bypass-Cache": "1" } }),
  });
};

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/reports/docs", "post">;
type DocsOut = OutputOf<"/reports/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/reports/docs", input);
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ recordId: string }>;
}): Promise<Metadata> {
  const { recordId } = await params;
  const docs = await getDocs({ body: { entity_id: recordId } });
  return { title: docs.detail.title, description: docs.detail.description };
}

interface RecordPageProps {
  params: Promise<{ recordId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function RecordPage({
  params,
  searchParams,
}: RecordPageProps) {
  const { recordId } = await params;

  // Parse search params via nuqs loader
  const q = loadProfileReportSearchParams(await searchParams);

  // Get profile context for actor_profile_id (cache()-wrapped, no extra request)
  const profileContext = await getProfileContext();

  // Compute initial date range from search params (with 30-day fallback)
  const defaultStartDate = (() => {
    if (q.startDate) return q.startDate;
    const d = new Date();
    d.setDate(d.getDate() - 30);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  })();
  const defaultEndDate = (() => {
    if (q.endDate) return q.endDate;
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d.toISOString();
  })();

  // Section picker params (canonical — shared across charts in each section)
  const rubricIds = q.rubricIds ?? undefined;
  const rubricSearch = q.rubricSearch ?? undefined;
  const rubricIndex = q.rubricIndex ?? 0;
  const simulationPickerIds = q.simulationPickerIds ?? undefined;
  const simulationPickerSearch = q.simulationPickerSearch ?? undefined;
  const simulationIndex = q.simulationIndex ?? 0;
  const parameterIds = q.parameterIds ?? undefined;
  const parameterSearch = q.parameterSearch ?? undefined;
  const parameterIndex = q.parameterIndex ?? 0;
  const scenarioIds = q.scenarioIds ?? undefined;
  const scenarioSearch = q.scenarioSearch ?? undefined;
  const scenarioIndex = q.scenarioIndex ?? 0;

  // History params with defaults
  const historyPage = q.historyPage ?? 0;
  const historyPageSize = q.historyPageSize ?? 10;
  const historySearch = q.historySearch ?? undefined;
  const _historySimulationIds = q.historySimulationIds ?? undefined;
  const historyScenarioIds = q.historyScenarioIds ?? undefined;
  const historyInfiniteMode = q.historyInfiniteMode ?? undefined;
  const historySortBy = q.historySortBy ?? "date";
  const historySortOrder = q.historySortOrder ?? "desc";

  // Single API call returning all dashboard data
  const data = await getDashboard({
    body: {
      start_date: defaultStartDate,
      end_date: defaultEndDate,
      ...(q.cohortIds && q.cohortIds.length > 0 && { cohort_ids: q.cohortIds }),
      ...(q.departmentIds && q.departmentIds.length > 0 && { department_ids: q.departmentIds }),
      ...(q.roles && q.roles.length > 0 && { roles: q.roles }),
      ...(q.simulationFilters && q.simulationFilters.length > 0 && { simulation_filters: q.simulationFilters }),
      target_profile_id: recordId,
      actor_profile_id: profileContext.id || recordId,
      page_limit: 50,
      page_offset: 0,
      // Section pickers (canonical)
      ...(rubricIds?.length && { rubric_ids: rubricIds }),
      ...(rubricSearch && { rubric_search: rubricSearch }),
      ...(simulationPickerIds?.length && { simulation_picker_ids: simulationPickerIds }),
      ...(simulationPickerSearch && { simulation_picker_search: simulationPickerSearch }),
      ...(parameterIds?.length && { parameter_ids: parameterIds }),
      ...(parameterSearch && { parameter_search: parameterSearch }),
      ...(scenarioIds?.length && { scenario_ids: scenarioIds }),
      ...(scenarioSearch && { scenario_search: scenarioSearch }),
      // History
      history_page: historyPage,
      history_page_size: historyPageSize,
      history_sort_by: historySortBy,
      history_sort_order: historySortOrder,
      ...(historySearch && { history_simulation_search: historySearch }),
      ...(historyScenarioIds?.length && { history_scenario_ids: historyScenarioIds }),
      ...(historyInfiniteMode !== undefined && { history_infinite_mode: historyInfiniteMode }),
    },
  });

  // Compute initial filters from inline facets (replaces computeAnalyticsDefaults)
  const facets = data.analytics;
  const initialFilters = {
    startDate: defaultStartDate,
    endDate: defaultEndDate,
    cohortIds: q.cohortIds ?? [],
    departmentIds: q.departmentIds ?? [],
    roles: q.roles ?? [],
    simulationFilters: q.simulationFilters ?? ["general"],
  };

  const profileData = {
    name: data.profile_name || null,
    emails: data.profile_emails || null,
    primary_email: data.profile_primary_email || null,
    role: data.profile_role || null,
  };

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { title: "Reports", section: "analytics", url: "/analytics/reports" },
          { title: "Profile" },
        ]}
        toolbar={
          <AnalyticsFilters
            refreshPage={refreshPage}
            analyticsFilters={facets}
          />
        }
      />
      <div className="px-4">
        <Record
          data={data}
          profileData={profileData}
          profileId={recordId}
          rubricIds={rubricIds}
          rubricSearch={rubricSearch}
          rubricIndex={rubricIndex}
          simulationPickerIds={simulationPickerIds}
          simulationPickerSearch={simulationPickerSearch}
          simulationIndex={simulationIndex}
          parameterIds={parameterIds}
          parameterSearch={parameterSearch}
          parameterIndex={parameterIndex}
          scenarioIds={scenarioIds}
          scenarioSearch={scenarioSearch}
          scenarioIndex={scenarioIndex}
          historyPage={historyPage}
          historyPageSize={historyPageSize}
          defaultFilters={initialFilters}
          initialColumnVisibility={await readViewCookie("history")}
        />
      </div>
    </>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type GetProfileOut = {
  name: string | null;
  emails: string[] | null;
  primary_email: string | null;
  role: string | null;
};
export type { ReportHistoryOut, DashboardIn as ReportsOverviewIn, DashboardOut as ReportsOverviewOut };
