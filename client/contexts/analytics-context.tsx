/**
 * analytics-context.tsx
 * Global context for analytics date range and cohort filtering
 * @AshokSaravanan222 & @siladiea
 * 01/20/2025
 */

"use client";

import {
  filtersToSearchParams,
  searchParamsToFilters,
  type DefaultAnalyticsFilters,
} from "@/utils/analytics-filters";
import { subDays } from "date-fns";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useProfile } from "./profile-context";

type ProfileRole =
  | "superadmin"
  | "admin"
  | "instructional"
  | "member"
  | "guest"
  | "custom";

export type SimulationFilter = "practice" | "general" | "archived";

export interface AnalyticsContextType {
  // Date range state
  startDate: Date;
  endDate: Date;
  setDateRange: (start: Date, end: Date) => void;

  // Cohort filtering state
  selectedCohortIds: string[];
  setSelectedCohortIds: (cohortIds: string[]) => void;

  // Department filtering state
  selectedDepartmentIds: string[];
  setSelectedDepartmentIds: (departmentIds: string[]) => void;

  // Document filtering state
  selectedDocumentIds: string[];
  setSelectedDocumentIds: (documentIds: string[]) => void;

  // Role filtering state
  selectedRoles: ProfileRole[];
  setSelectedRoles: (roles: ProfileRole[]) => void;

  // Practice/Assigned/Archived filters
  simulationFilters: SimulationFilter[];
  setSimulationFilters: (filters: SimulationFilter[]) => void;

  // Effective values (computed from user selections)
  effectiveCohortIds: string[];
  effectiveDepartmentIds: string[];
  effectiveDocumentIds: string[];
  effectiveRoles: ProfileRole[];
  effectiveSimulationFilters: SimulationFilter[];

  // Utility functions
  clearFilters: () => void;
  hasActiveFilters: boolean;
}

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(
  undefined,
);

interface AnalyticsProviderProps {
  children: React.ReactNode;
}

export function AnalyticsProvider({ children }: AnalyticsProviderProps) {
  // Get profile context to check user role and ID
  const {
    effectiveProfile,
    earliestAttemptDate,
    cohortIds,
    departmentIds,
    scopedRoles,
  } = useProfile();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Calculate the earliest date to use as default start date
  // Round to start of day for stable query keys
  const earliestDate = useMemo(() => {
    if (earliestAttemptDate) {
      // Parse ISO string to Date object
      const date = new Date(earliestAttemptDate);
      date.setHours(0, 0, 0, 0);
      return date;
    }
    // Fallback to 30 days ago if no attempts available
    // Use a stable reference to prevent infinite loops
    const fallback = subDays(new Date(), 30);
    fallback.setHours(0, 0, 0, 0);
    return fallback;
  }, [earliestAttemptDate]);

  // Compute default filters (same logic as server-side)
  const defaultFilters = useMemo<DefaultAnalyticsFilters>(() => {
    const defaultStartDate = new Date(earliestDate);
    defaultStartDate.setHours(0, 0, 0, 0);
    const defaultEndDate = new Date();
    defaultEndDate.setHours(23, 59, 59, 999);

    return {
      startDate: defaultStartDate.toISOString(),
      endDate: defaultEndDate.toISOString(),
      cohortIds: [],
      roles: scopedRoles || [],
      simulationFilters: ["general"],
      departmentIds: [],
    };
  }, [earliestDate, scopedRoles]);

  // Initialize state from search params or defaults
  const getInitialFilters = useCallback(() => {
    if (searchParams.toString()) {
      const parsed = searchParamsToFilters(searchParams, defaultFilters);
      return {
        startDate: new Date(parsed.startDate),
        endDate: new Date(parsed.endDate),
        selectedCohortIds: parsed.cohortIds || [],
        selectedDepartmentIds: parsed.departmentIds || [],
        selectedRoles: (parsed.roles || []) as ProfileRole[],
        simulationFilters: (parsed.simulationFilters || [
          "general",
        ]) as SimulationFilter[],
      };
    }
    // Use defaults
    return {
      startDate: new Date(defaultFilters.startDate),
      endDate: new Date(defaultFilters.endDate),
      selectedCohortIds: [],
      selectedDepartmentIds: [],
      selectedRoles: [] as ProfileRole[],
      simulationFilters: ["general"] as SimulationFilter[],
    };
  }, [searchParams, defaultFilters]);

  const initialFilters = getInitialFilters();

  // Default to earliest attempt date instead of last 30 days
  // Round to day boundaries for stable query keys
  const [startDate, setStartDate] = useState<Date>(initialFilters.startDate);
  const [endDate, setEndDate] = useState<Date>(initialFilters.endDate);
  const [hasUserSetDateRange, setHasUserSetDateRange] = useState(false);

  // Helper to compare arrays
  const arraysEqual = useCallback((a: string[], b: string[]): boolean => {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((val, idx) => val === sortedB[idx]);
  }, []);

  // Sync search params to state on mount/change (only if search params change externally)
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Only sync if search params changed externally (not from our own updates)
    const currentFilters = getInitialFilters();
    if (
      currentFilters.startDate.getTime() !== startDate.getTime() ||
      currentFilters.endDate.getTime() !== endDate.getTime()
    ) {
      setStartDate(currentFilters.startDate);
      setEndDate(currentFilters.endDate);
      setHasUserSetDateRange(true);
    }
    if (!arraysEqual(currentFilters.selectedCohortIds, selectedCohortIds)) {
      setSelectedCohortIds(currentFilters.selectedCohortIds);
    }
    if (
      !arraysEqual(currentFilters.selectedDepartmentIds, selectedDepartmentIds)
    ) {
      setSelectedDepartmentIds(currentFilters.selectedDepartmentIds);
    }
    if (!arraysEqual(currentFilters.selectedRoles, selectedRoles)) {
      setSelectedRoles(currentFilters.selectedRoles);
    }
    if (!arraysEqual(currentFilters.simulationFilters, simulationFilters)) {
      setSimulationFilters(currentFilters.simulationFilters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString(), arraysEqual]);

  // Update start date when earliest date changes
  // Only auto-update if user hasn't manually set a date range
  React.useEffect(() => {
    if (
      !hasUserSetDateRange &&
      earliestDate.getTime() !== startDate.getTime()
    ) {
      setStartDate(earliestDate);
    }
  }, [earliestDate, startDate, hasUserSetDateRange]);

  // Cohort filtering - empty array means all cohorts
  const [selectedCohortIds, setSelectedCohortIds] = useState<string[]>(
    initialFilters.selectedCohortIds,
  );
  // Department filtering - empty array means all departments
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>(
    initialFilters.selectedDepartmentIds,
  );
  // Document filtering - empty array means all documents
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  // Role filtering - empty array means all roles
  const [selectedRoles, setSelectedRoles] = useState<ProfileRole[]>(
    initialFilters.selectedRoles,
  );
  // New dual flags for practice/assigned filtering
  const [simulationFilters, setSimulationFilters] = useState<
    SimulationFilter[]
  >(initialFilters.simulationFilters);

  // Sync filter state to search params
  const syncFiltersToSearchParams = useCallback(() => {
    // Start with current search params to preserve non-analytics params (e.g., history* params)
    const params = new URLSearchParams(searchParams.toString());

    const currentFilters: {
      startDate: string;
      endDate: string;
      cohortIds?: string[];
      roles?: string[];
      simulationFilters?: SimulationFilter[];
      departmentIds?: string[];
    } = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };

    if (selectedCohortIds.length > 0) {
      currentFilters.cohortIds = selectedCohortIds;
    }

    if (selectedRoles.length > 0) {
      currentFilters.roles = selectedRoles;
    }

    if (
      simulationFilters.length > 0 &&
      !arraysEqual(simulationFilters, ["general"])
    ) {
      currentFilters.simulationFilters = simulationFilters;
    }

    if (selectedDepartmentIds.length > 0) {
      currentFilters.departmentIds = selectedDepartmentIds;
    }

    // Get analytics-only params from filtersToSearchParams
    const analyticsParams = filtersToSearchParams(
      currentFilters,
      defaultFilters,
    );

    // Update only analytics-related params, preserving all other params (e.g., history*)
    // Delete all existing analytics params first
    params.delete("startDate");
    params.delete("endDate");
    params.delete("cohortIds");
    params.delete("roles");
    params.delete("simulationFilters");
    params.delete("departmentIds");

    // Then set only non-default analytics params
    analyticsParams.forEach((value, key) => {
      params.set(key, value);
    });

    const newSearch = params.toString();
    const currentSearch = searchParams.toString();

    // Only update if search params actually changed
    if (newSearch !== currentSearch) {
      const newUrl = newSearch ? `${pathname}?${newSearch}` : pathname || "/";
      router.replace(newUrl, { scroll: false });
      // Force server components to re-render with updated search params
      router.refresh();
    }
  }, [
    startDate,
    endDate,
    selectedCohortIds,
    selectedRoles,
    simulationFilters,
    selectedDepartmentIds,
    defaultFilters,
    pathname,
    router,
    searchParams,
    arraysEqual,
  ]);

  // Debounce search params updates
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = setTimeout(() => {
      syncFiltersToSearchParams();
    }, 100);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [syncFiltersToSearchParams]);

  // Compute effective cohort IDs (all user cohorts if none selected)
  const effectiveCohortIds = useMemo(
    () => (selectedCohortIds.length > 0 ? selectedCohortIds : cohortIds),
    [selectedCohortIds, cohortIds],
  );

  // Compute effective department IDs (all user departments if none selected)
  const effectiveDepartmentIds = useMemo(
    () =>
      selectedDepartmentIds.length > 0 ? selectedDepartmentIds : departmentIds,
    [selectedDepartmentIds, departmentIds],
  );

  // Compute effective document IDs (all documents if none selected)
  // Note: We'll need to get documentIds from profile context or fetch them separately
  // For now, empty array means all documents (will be handled by analytics queries)
  const effectiveDocumentIds = useMemo(
    () => selectedDocumentIds,
    [selectedDocumentIds],
  );

  // Route-aware flags
  const isPracticePage = useMemo(
    () => pathname?.startsWith("/practice") === true,
    [pathname],
  );
  const isHomePage = useMemo(() => pathname === "/home", [pathname]);
  const isLeaderboardPage = useMemo(
    () => pathname === "/leaderboard",
    [pathname],
  );

  // Resolve effective roles: force member-only for member users, default to all when empty
  const effectiveRoles = useMemo<ProfileRole[]>(() => {
    if (effectiveProfile?.role === "member") return ["member"] as ProfileRole[];
    // Empty selection means all roles
    if (selectedRoles.length === 0) {
      return ["superadmin", "admin", "instructional", "member", "guest"];
    }
    return selectedRoles;
  }, [effectiveProfile?.role, selectedRoles]);

  // Resolve effective simulation filters: route-aware overrides, default to all when empty
  const effectiveSimulationFilters = useMemo<SimulationFilter[]>(() => {
    if (isPracticePage) return ["practice"];
    if (isHomePage || isLeaderboardPage) return ["general"];
    // Empty selection means all simulation types
    if (simulationFilters.length === 0) {
      return ["general", "practice", "archived"];
    }
    return simulationFilters;
  }, [isPracticePage, isHomePage, isLeaderboardPage, simulationFilters]);

  const setDateRange = useCallback((start: Date, end: Date) => {
    // Round to day boundaries for stable query keys
    const roundedStart = new Date(start);
    roundedStart.setHours(0, 0, 0, 0);
    const roundedEnd = new Date(end);
    roundedEnd.setHours(23, 59, 59, 999);
    setStartDate(roundedStart);
    setEndDate(roundedEnd);
    setHasUserSetDateRange(true); // Mark that the user has set the date range
    // Search params will be synced via effect
  }, []);

  const clearFilters = useCallback(() => {
    // Round to day boundaries for stable query keys
    const roundedEarliest = new Date(earliestDate);
    roundedEarliest.setHours(0, 0, 0, 0);
    const roundedNow = new Date();
    roundedNow.setHours(23, 59, 59, 999);
    setStartDate(roundedEarliest);
    setEndDate(roundedNow);
    setSelectedCohortIds([]);
    setSelectedDepartmentIds([]);
    setSelectedDocumentIds([]);
    setSelectedRoles([]);
    setSimulationFilters(["general"]);
    setHasUserSetDateRange(false); // Reset user-set date range
    // Search params will be synced via effect - will clear to defaults
  }, [earliestDate]);

  const hasActiveFilters =
    selectedCohortIds.length > 0 ||
    selectedDepartmentIds.length > 0 ||
    selectedDocumentIds.length > 0;

  // Wrap setters to trigger search params sync
  const wrappedSetSelectedCohortIds = useCallback((cohortIds: string[]) => {
    setSelectedCohortIds(cohortIds);
  }, []);

  const wrappedSetSelectedDepartmentIds = useCallback(
    (departmentIds: string[]) => {
      setSelectedDepartmentIds(departmentIds);
    },
    [],
  );

  const wrappedSetSelectedDocumentIds = useCallback((documentIds: string[]) => {
    setSelectedDocumentIds(documentIds);
  }, []);

  const wrappedSetSelectedRoles = useCallback((roles: ProfileRole[]) => {
    setSelectedRoles(roles);
  }, []);

  const wrappedSetSimulationFilters = useCallback(
    (filters: SimulationFilter[]) => {
      setSimulationFilters(filters);
    },
    [],
  );

  const value: AnalyticsContextType = useMemo(
    () => ({
      startDate,
      endDate,
      setDateRange,
      selectedCohortIds,
      setSelectedCohortIds: wrappedSetSelectedCohortIds,
      selectedDepartmentIds,
      setSelectedDepartmentIds: wrappedSetSelectedDepartmentIds,
      selectedDocumentIds,
      setSelectedDocumentIds: wrappedSetSelectedDocumentIds,
      selectedRoles,
      setSelectedRoles: wrappedSetSelectedRoles,
      simulationFilters,
      setSimulationFilters: wrappedSetSimulationFilters,
      effectiveCohortIds,
      effectiveDepartmentIds,
      effectiveDocumentIds,
      effectiveRoles,
      effectiveSimulationFilters,
      clearFilters,
      hasActiveFilters,
    }),
    [
      startDate,
      endDate,
      setDateRange,
      selectedCohortIds,
      wrappedSetSelectedCohortIds,
      selectedDepartmentIds,
      wrappedSetSelectedDepartmentIds,
      selectedDocumentIds,
      wrappedSetSelectedDocumentIds,
      effectiveRoles,
      wrappedSetSelectedRoles,
      effectiveSimulationFilters,
      wrappedSetSimulationFilters,
      effectiveCohortIds,
      effectiveDepartmentIds,
      effectiveDocumentIds,
      clearFilters,
      hasActiveFilters,
      selectedRoles,
      simulationFilters,
    ],
  );

  return (
    <AnalyticsContext.Provider value={value}>
      {children}
    </AnalyticsContext.Provider>
  );
}

export function useAnalytics() {
  const context = useContext(AnalyticsContext);
  if (context === undefined) {
    throw new Error("useAnalytics must be used within an AnalyticsProvider");
  }
  return context;
}
