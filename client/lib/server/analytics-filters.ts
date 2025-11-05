/**
 * Analytics Search Params Utilities
 *
 * Converts between analytics filters and URL search params.
 * Only includes values in search params that differ from defaults.
 */

import { auth } from "@/auth";
import type { SimulationFilter } from "@/contexts/analytics-context";
import { api } from "@/lib/api/client";
import { cache } from "react";

export interface AnalyticsFilters {
  startDate: string;
  endDate: string;
  cohortIds?: string[];
  roles?: string[];
  simulationFilters?: SimulationFilter[];
  departmentIds?: string[];
  // profileId is excluded from search params
}

export interface DefaultAnalyticsFilters {
  startDate: string;
  endDate: string;
  cohortIds: string[];
  roles: string[];
  simulationFilters: SimulationFilter[];
  departmentIds: string[];
}

/**
 * Compare two arrays for deep equality (sorted)
 */
function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((val, idx) => val === sortedB[idx]);
}

/**
 * Compare two dates by ISO string (timezone-aware)
 */
function datesEqual(a: string, b: string): boolean {
  // Normalize to ISO strings for comparison
  const dateA = new Date(a);
  const dateB = new Date(b);
  return dateA.getTime() === dateB.getTime();
}

/**
 * Convert analytics filters to URL search params, only including non-default values
 */
export function filtersToSearchParams(
  filters: AnalyticsFilters,
  defaults: DefaultAnalyticsFilters
): URLSearchParams {
  const params = new URLSearchParams();

  // Only include startDate if it differs from default
  if (!datesEqual(filters.startDate, defaults.startDate)) {
    params.set("startDate", filters.startDate);
  }

  // Only include endDate if it differs from default
  if (!datesEqual(filters.endDate, defaults.endDate)) {
    params.set("endDate", filters.endDate);
  }

  // Only include cohortIds if it differs from default (non-empty array)
  if (
    filters.cohortIds &&
    filters.cohortIds.length > 0 &&
    !arraysEqual(filters.cohortIds, defaults.cohortIds)
  ) {
    params.set("cohortIds", filters.cohortIds.join(","));
  }

  // Only include roles if it differs from default (non-empty array)
  if (
    filters.roles &&
    filters.roles.length > 0 &&
    !arraysEqual(filters.roles, defaults.roles)
  ) {
    params.set("roles", filters.roles.join(","));
  }

  // Only include simulationFilters if it differs from default
  if (
    filters.simulationFilters &&
    !arraysEqual(filters.simulationFilters, defaults.simulationFilters)
  ) {
    params.set("simulationFilters", filters.simulationFilters.join(","));
  }

  // Only include departmentIds if it differs from default (non-empty array)
  if (
    filters.departmentIds &&
    filters.departmentIds.length > 0 &&
    !arraysEqual(filters.departmentIds, defaults.departmentIds)
  ) {
    params.set("departmentIds", filters.departmentIds.join(","));
  }

  return params;
}

/**
 * Parse search params back to analytics filters, merging with defaults
 */
export function searchParamsToFilters(
  searchParams: URLSearchParams,
  defaults: DefaultAnalyticsFilters
): AnalyticsFilters {
  const filters: AnalyticsFilters = {
    startDate: defaults.startDate,
    endDate: defaults.endDate,
  };

  // Parse startDate
  const startDateParam = searchParams.get("startDate");
  if (startDateParam) {
    filters.startDate = startDateParam;
  }

  // Parse endDate
  const endDateParam = searchParams.get("endDate");
  if (endDateParam) {
    filters.endDate = endDateParam;
  }

  // Parse cohortIds
  const cohortIdsParam = searchParams.get("cohortIds");
  if (cohortIdsParam) {
    filters.cohortIds = cohortIdsParam.split(",").filter(Boolean);
  }

  // Parse roles
  const rolesParam = searchParams.get("roles");
  if (rolesParam) {
    filters.roles = rolesParam.split(",").filter(Boolean);
  }

  // Parse simulationFilters
  const simulationFiltersParam = searchParams.get("simulationFilters");
  if (simulationFiltersParam) {
    const parsed = simulationFiltersParam
      .split(",")
      .filter(Boolean) as SimulationFilter[];
    // Validate that all values are valid SimulationFilter values
    const validFilters: SimulationFilter[] = [
      "general",
      "practice",
      "archived",
    ];
    filters.simulationFilters = parsed.filter((f) => validFilters.includes(f));
  }

  // Parse departmentIds
  const departmentIdsParam = searchParams.get("departmentIds");
  if (departmentIdsParam) {
    filters.departmentIds = departmentIdsParam.split(",").filter(Boolean);
  }

  return filters;
}

export const getDefaultAnalyticsFilters = cache(
  async (searchParams?: URLSearchParams) => {
    const session = await auth();

    // Fetch profile context to get earliestAttemptDate
    const profileContext = await api.post("/profile/context", {
      body: {
        actualProfileId: session?.user?.profileId || "",
        effectiveProfileId: session?.effectiveProfileId || "",
        pathname: "/",
      },
    });

    // Compute startDate using same logic as analytics context
    let startDate: Date;
    if (profileContext.earliestAttemptDate) {
      startDate = new Date(profileContext.earliestAttemptDate);
      startDate.setHours(0, 0, 0, 0);
    } else {
      // Fallback to 30 days ago (matching analytics context)
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
    }

    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    const defaults = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      cohortIds: [] as string[],
      roles: [] as string[],
      simulationFilters: ["general" as const],
      departmentIds: [] as string[],
      // profileId omitted - allows cross-user caching
    };

    // If search params are provided, merge them with defaults
    if (searchParams) {
      return searchParamsToFilters(searchParams, defaults);
    }

    return defaults;
  }
);
