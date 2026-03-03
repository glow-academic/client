/**
 * Shared analytics defaults and filter resolution.
 * Replaces duplicated getXxxFilters() logic across analytics pages.
 * Server-side only.
 */

import type { AuthProfileResponse } from "@/app/(main)/layout-server";
import { getAnalyticsFilters, getAuthProfile } from "@/app/(main)/layout-server";
import type { OutputOf } from "@/lib/api/types";

type AnalyticsFiltersOut = OutputOf<"/api/v5/auth/analytics", "post">;

export interface AnalyticsDefaults {
  startDate: string;
  endDate: string;
  cohortIds: string[];
  departmentIds: string[];
  roles: string[];
  simulationFilters: string[];
}

/**
 * Backward-compatible type alias matching the old AnalyticsFilters interface.
 * Used by components (e.g. Reports) that accept resolved filter values.
 */
export interface AnalyticsFilters {
  startDate: string;
  endDate: string;
  cohortIds?: string[];
  departmentIds?: string[];
  roles?: string[];
  simulationFilters?: string[];
}

export interface ParsedAnalyticsParams {
  startDate: string | null;
  endDate: string | null;
  cohortIds: string[] | null;
  departmentIds: string[] | null;
  roles: string[] | null;
  simulationFilters: string[] | null;
}

/**
 * Compute default analytics values from the layout context.
 * Uses React.cache via getLayoutContext to avoid duplicate requests.
 */
export async function computeAnalyticsDefaults(): Promise<{
  defaults: AnalyticsDefaults;
  profileContext: AuthProfileResponse;
  analyticsFilters: AnalyticsFiltersOut | null;
}> {
  const [profileContext, analyticsFilters] = await Promise.all([
    getAuthProfile(),
    getAnalyticsFilters(),
  ]);

  let startDate: Date;
  if (analyticsFilters?.date_range_earliest) {
    startDate = new Date(analyticsFilters.date_range_earliest);
    startDate.setHours(0, 0, 0, 0);
  } else {
    startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    startDate.setHours(0, 0, 0, 0);
  }

  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);

  return {
    defaults: {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      cohortIds: [],
      departmentIds: [],
      roles: [],
      simulationFilters: ["general"],
    },
    profileContext,
    analyticsFilters,
  };
}

/**
 * Resolve parsed search params against defaults and profile context.
 * Empty selections fall back to all IDs from profile context.
 */
export function resolveAnalyticsFilters(
  parsed: ParsedAnalyticsParams,
  defaults: AnalyticsDefaults,
  profileContext: AuthProfileResponse,
): AnalyticsDefaults {
  const startDate = parsed.startDate || defaults.startDate;
  const endDate = parsed.endDate || defaults.endDate;

  const selectedCohortIds = parsed.cohortIds || defaults.cohortIds;
  const selectedDepartmentIds = parsed.departmentIds || defaults.departmentIds;
  const selectedRoles = parsed.roles || defaults.roles;
  const simulationFilters =
    parsed.simulationFilters || defaults.simulationFilters;

  // Empty selections mean "all" — pass empty array to backend (backend treats null/empty as unfiltered)
  const cohortIds = selectedCohortIds;
  const departmentIds = selectedDepartmentIds;
  const roles =
    selectedRoles.length > 0
      ? selectedRoles
      : profileContext.scoped_roles || [];

  return {
    startDate,
    endDate,
    cohortIds,
    departmentIds,
    roles,
    simulationFilters,
  };
}
