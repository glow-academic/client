/**
 * Shared analytics defaults and filter resolution.
 * Replaces duplicated getXxxFilters() logic across analytics pages.
 * Server-side only.
 */

import type { OutputOf } from "@/lib/api/types";
import { getLayoutContext } from "@/app/(main)/layout-server";

type LayoutContextOut = OutputOf<"/api/v4/auth/context", "post">;

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
  profileContext: LayoutContextOut;
}> {
  const profileContext = await getLayoutContext({ body: {} });

  let startDate: Date;
  if (profileContext.earliest_attempt_date) {
    startDate = new Date(profileContext.earliest_attempt_date);
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
  };
}

/**
 * Resolve parsed search params against defaults and profile context.
 * Empty selections fall back to all IDs from profile context.
 */
export function resolveAnalyticsFilters(
  parsed: ParsedAnalyticsParams,
  defaults: AnalyticsDefaults,
  profileContext: LayoutContextOut,
): AnalyticsDefaults {
  const startDate = parsed.startDate || defaults.startDate;
  const endDate = parsed.endDate || defaults.endDate;

  const selectedCohortIds = parsed.cohortIds || defaults.cohortIds;
  const selectedDepartmentIds = parsed.departmentIds || defaults.departmentIds;
  const selectedRoles = parsed.roles || defaults.roles;
  const simulationFilters =
    parsed.simulationFilters || defaults.simulationFilters;

  // Empty selections mean "all" - fall back to profile context values
  const cohortIds =
    selectedCohortIds.length > 0
      ? selectedCohortIds
      : profileContext.cohort_ids || [];
  const departmentIds =
    selectedDepartmentIds.length > 0
      ? selectedDepartmentIds
      : profileContext.department_ids || [];
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
