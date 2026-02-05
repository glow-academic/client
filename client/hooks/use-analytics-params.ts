/**
 * Client-side hook for analytics URL state management.
 * Replaces AnalyticsContext with nuqs useQueryStates.
 */

"use client";

import { useProfile } from "@/contexts/profile-context";
import { subDays } from "date-fns";
import { usePathname } from "next/navigation";
import { createParser, parseAsString, useQueryStates } from "nuqs";
import { useCallback, useMemo } from "react";

type ProfileRole =
  | "superadmin"
  | "admin"
  | "instructional"
  | "member"
  | "guest"
  | "custom";

export type SimulationFilter = "practice" | "general" | "archived";

/**
 * Custom parser for comma-separated arrays (client-side).
 * Maintains current URL format: `?cohortIds=id1,id2`
 */
const parseAsCommaSeparatedArray = createParser({
  parse: (value: string) => {
    if (!value) return null;
    const arr = value.split(",").filter(Boolean);
    return arr.length > 0 ? arr : null;
  },
  serialize: (value: string[]) => {
    if (!value || value.length === 0) return "";
    return value.join(",");
  },
});

const analyticsParamsClient = {
  startDate: parseAsString,
  endDate: parseAsString,
  cohortIds: parseAsCommaSeparatedArray,
  departmentIds: parseAsCommaSeparatedArray,
  roles: parseAsCommaSeparatedArray,
  simulationFilters: parseAsCommaSeparatedArray,
} as const;

export function useAnalyticsParams() {
  const pathname = usePathname();
  const {
    profile,
    earliestAttemptDate,
    cohortIds: profileCohortIds,
    departmentIds: profileDepartmentIds,
  } = useProfile();

  const [params, setParams] = useQueryStates(analyticsParamsClient, {
    shallow: false,
    history: "replace",
  });

  // Compute default start date from profile context
  const earliestDate = useMemo(() => {
    if (earliestAttemptDate) {
      const date = new Date(earliestAttemptDate);
      date.setHours(0, 0, 0, 0);
      return date;
    }
    const fallback = subDays(new Date(), 30);
    fallback.setHours(0, 0, 0, 0);
    return fallback;
  }, [earliestAttemptDate]);

  // Parse URL dates or use defaults
  const startDate = useMemo(() => {
    if (params.startDate) return new Date(params.startDate);
    return earliestDate;
  }, [params.startDate, earliestDate]);

  const endDate = useMemo(() => {
    if (params.endDate) return new Date(params.endDate);
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    return now;
  }, [params.endDate]);

  // Selected values (empty array means "all")
  const selectedCohortIds = params.cohortIds || [];
  const selectedDepartmentIds = params.departmentIds || [];
  const selectedRoles = (params.roles || []) as ProfileRole[];
  const simulationFilters = (params.simulationFilters || [
    "general",
  ]) as SimulationFilter[];

  // Route-aware flags
  const isPracticePage = pathname?.startsWith("/practice") === true;
  const isHomePage = pathname === "/home";
  const isLeaderboardPage = pathname === "/leaderboard";

  // Effective values (empty = all from profile context)
  const effectiveCohortIds = useMemo(
    () =>
      selectedCohortIds.length > 0 ? selectedCohortIds : profileCohortIds,
    [selectedCohortIds, profileCohortIds],
  );

  const effectiveDepartmentIds = useMemo(
    () =>
      selectedDepartmentIds.length > 0
        ? selectedDepartmentIds
        : profileDepartmentIds,
    [selectedDepartmentIds, profileDepartmentIds],
  );

  const effectiveRoles = useMemo<ProfileRole[]>(() => {
    if (profile?.role === "member") return ["member"];
    if (selectedRoles.length === 0) {
      return ["superadmin", "admin", "instructional", "member", "guest"];
    }
    return selectedRoles;
  }, [profile?.role, selectedRoles]);

  const effectiveSimulationFilters = useMemo<SimulationFilter[]>(() => {
    if (isPracticePage) return ["practice"];
    if (isHomePage || isLeaderboardPage) return ["general"];
    if (simulationFilters.length === 0) {
      return ["general", "practice", "archived"];
    }
    return simulationFilters;
  }, [isPracticePage, isHomePage, isLeaderboardPage, simulationFilters]);

  // Setters
  const setDateRange = useCallback(
    (start: Date, end: Date) => {
      const roundedStart = new Date(start);
      roundedStart.setHours(0, 0, 0, 0);
      const roundedEnd = new Date(end);
      roundedEnd.setHours(23, 59, 59, 999);
      setParams({
        startDate: roundedStart.toISOString(),
        endDate: roundedEnd.toISOString(),
      });
    },
    [setParams],
  );

  const setSelectedCohortIds = useCallback(
    (ids: string[]) => {
      setParams({ cohortIds: ids.length > 0 ? ids : null });
    },
    [setParams],
  );

  const setSelectedDepartmentIds = useCallback(
    (ids: string[]) => {
      setParams({ departmentIds: ids.length > 0 ? ids : null });
    },
    [setParams],
  );

  const setSelectedRoles = useCallback(
    (roles: ProfileRole[]) => {
      setParams({ roles: roles.length > 0 ? roles : null });
    },
    [setParams],
  );

  const setSimulationFilters = useCallback(
    (filters: SimulationFilter[]) => {
      // Don't serialize default value
      const isDefault =
        filters.length === 1 && filters[0] === "general";
      setParams({
        simulationFilters: isDefault ? null : filters.length > 0 ? filters : null,
      });
    },
    [setParams],
  );

  const clearFilters = useCallback(() => {
    setParams({
      startDate: null,
      endDate: null,
      cohortIds: null,
      departmentIds: null,
      roles: null,
      simulationFilters: null,
    });
  }, [setParams]);

  const hasActiveFilters =
    selectedCohortIds.length > 0 ||
    selectedDepartmentIds.length > 0;

  return {
    // Date range
    startDate,
    endDate,
    setDateRange,
    // Cohort filtering
    selectedCohortIds,
    setSelectedCohortIds,
    // Department filtering
    selectedDepartmentIds,
    setSelectedDepartmentIds,
    // Role filtering
    selectedRoles,
    setSelectedRoles,
    // Simulation type filters
    simulationFilters,
    setSimulationFilters,
    // Effective values
    effectiveCohortIds,
    effectiveDepartmentIds,
    effectiveRoles,
    effectiveSimulationFilters,
    // Utilities
    clearFilters,
    hasActiveFilters,
  };
}
