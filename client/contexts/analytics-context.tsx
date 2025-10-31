/**
 * analytics-context.tsx
 * Global context for analytics date range and cohort filtering
 * @AshokSaravanan222 & @siladiea
 * 01/20/2025
 */

"use client";

import { ProfileRole } from "@/lib/api/v2/schemas/base";
import { subDays } from "date-fns";
import { usePathname } from "next/navigation";
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { useProfile } from "./profile-context";

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
  undefined
);

interface AnalyticsProviderProps {
  children: React.ReactNode;
}

export function AnalyticsProvider({ children }: AnalyticsProviderProps) {
  // Get profile context to check user role and ID
  const { effectiveProfile, earliestAttemptDate, cohortIds, departmentIds } = useProfile();
  const pathname = usePathname();

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

  // Default to earliest attempt date instead of last 30 days
  // Round to day boundaries for stable query keys
  const [startDate, setStartDate] = useState<Date>(() => {
    const date = new Date(earliestDate);
    date.setHours(0, 0, 0, 0);
    return date;
  });
  const [endDate, setEndDate] = useState<Date>(() => {
    const date = new Date();
    date.setHours(23, 59, 59, 999);
    return date;
  });
  const [hasUserSetDateRange, setHasUserSetDateRange] = useState(false);

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
  const [selectedCohortIds, setSelectedCohortIds] = useState<string[]>([]);
  // Department filtering - empty array means all departments
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>([]);
  // Document filtering - empty array means all documents
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  // Role filtering - empty array means all roles
  const [selectedRoles, setSelectedRoles] = useState<ProfileRole[]>(["ta"]);
  // New dual flags for practice/assigned filtering
  const [simulationFilters, setSimulationFilters] = useState<
    SimulationFilter[]
  >(["general"]);

  // Compute effective cohort IDs (all user cohorts if none selected)
  const effectiveCohortIds = useMemo(
    () => (selectedCohortIds.length > 0 ? selectedCohortIds : cohortIds),
    [selectedCohortIds, cohortIds]
  );

  // Compute effective department IDs (all user departments if none selected)
  const effectiveDepartmentIds = useMemo(
    () => (selectedDepartmentIds.length > 0 ? selectedDepartmentIds : departmentIds),
    [selectedDepartmentIds, departmentIds]
  );

  // Compute effective document IDs (all documents if none selected)
  // Note: We'll need to get documentIds from profile context or fetch them separately
  // For now, empty array means all documents (will be handled by analytics queries)
  const effectiveDocumentIds = useMemo(
    () => selectedDocumentIds,
    [selectedDocumentIds]
  );

  // Route-aware flags
  const isPracticePage = useMemo(
    () => pathname?.startsWith("/practice") === true,
    [pathname]
  );
  const isHomePage = useMemo(() => pathname === "/home", [pathname]);
  const isTALeaderboardPage = useMemo(
    () => pathname?.startsWith("/cohorts/c/") === true,
    [pathname]
  );

  // Resolve effective roles: force TA-only for TA users, default to all when empty
  const effectiveRoles = useMemo<ProfileRole[]>(() => {
    if (effectiveProfile?.role === "ta") return ["ta"] as ProfileRole[];
    // Empty selection means all roles
    if (selectedRoles.length === 0) {
      return ["superadmin", "admin", "instructional", "ta", "guest"];
    }
    return selectedRoles;
  }, [effectiveProfile?.role, selectedRoles]);

  // Resolve effective simulation filters: route-aware overrides, default to all when empty
  const effectiveSimulationFilters = useMemo<SimulationFilter[]>(() => {
    if (isPracticePage) return ["practice"];
    if (isHomePage || isTALeaderboardPage) return ["general"];
    // Empty selection means all simulation types
    if (simulationFilters.length === 0) {
      return ["general", "practice", "archived"];
    }
    return simulationFilters;
  }, [isPracticePage, isHomePage, isTALeaderboardPage, simulationFilters]);

  const setDateRange = useCallback((start: Date, end: Date) => {
    // Round to day boundaries for stable query keys
    const roundedStart = new Date(start);
    roundedStart.setHours(0, 0, 0, 0);
    const roundedEnd = new Date(end);
    roundedEnd.setHours(23, 59, 59, 999);
    setStartDate(roundedStart);
    setEndDate(roundedEnd);
    setHasUserSetDateRange(true); // Mark that the user has set the date range
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
  }, [earliestDate]);

  const hasActiveFilters = selectedCohortIds.length > 0 || selectedDepartmentIds.length > 0 || selectedDocumentIds.length > 0;

  const value: AnalyticsContextType = useMemo(
    () => ({
      startDate,
      endDate,
      setDateRange,
      selectedCohortIds,
      setSelectedCohortIds,
      selectedDepartmentIds,
      setSelectedDepartmentIds,
      selectedDocumentIds,
      setSelectedDocumentIds,
      selectedRoles,
      setSelectedRoles,
      simulationFilters,
      setSimulationFilters,
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
      setSelectedCohortIds,
      selectedDepartmentIds,
      setSelectedDepartmentIds,
      selectedDocumentIds,
      setSelectedDocumentIds,
      effectiveRoles,
      setSelectedRoles,
      effectiveSimulationFilters,
      setSimulationFilters,
      effectiveCohortIds,
      effectiveDepartmentIds,
      effectiveDocumentIds,
      clearFilters,
      hasActiveFilters,
      selectedRoles,
      simulationFilters,
    ]
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
