/**
 * analytics-context.tsx
 * Global context for analytics date range and cohort filtering
 * @AshokSaravanan222 & @siladiea
 * 01/20/2025
 */

"use client";

import { ProfileRole } from "@/types";
import { getEarliestAttemptDate } from "@/utils/attempt/get-earliest-attempt-date";
import { useQuery } from "@tanstack/react-query";
import { subDays } from "date-fns";
import { usePathname } from "next/navigation";
import React, { createContext, useContext, useMemo, useState } from "react";
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

  // Role filtering state
  selectedRoles: ProfileRole[];
  setSelectedRoles: (roles: ProfileRole[]) => void;

  // Practice/Assigned/Archived filters
  simulationFilters: SimulationFilter[];
  setSimulationFilters: (filters: SimulationFilter[]) => void;

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
  const { effectiveProfile } = useProfile();
  const pathname = usePathname();

  // Fetch earliest attempt date
  const { data: earliestAttemptDate } = useQuery({
    queryKey: ["earliest-attempt-date"],
    queryFn: () => getEarliestAttemptDate(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
  // Calculate the earliest date to use as default start date
  const earliestDate = useMemo(() => {
    if (earliestAttemptDate) {
      return earliestAttemptDate;
    }
    // Fallback to 30 days ago if no attempts available
    return subDays(new Date(), 30);
  }, [earliestAttemptDate]);

  // Default to earliest attempt date instead of last 30 days
  const [startDate, setStartDate] = useState<Date>(() => earliestDate);
  const [endDate, setEndDate] = useState<Date>(() => new Date());
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
  // Role filtering - empty array means all roles
  const [selectedRoles, setSelectedRoles] = useState<ProfileRole[]>(["ta"]);
  // New dual flags for practice/assigned filtering
  const [simulationFilters, setSimulationFilters] = useState<
    SimulationFilter[]
  >(["general"]);

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

  // Resolve effective roles: force TA-only for TA users
  const effectiveRoles = useMemo<ProfileRole[]>(() => {
    if (effectiveProfile?.role === "ta") return ["ta"] as ProfileRole[];
    return selectedRoles;
  }, [effectiveProfile?.role, selectedRoles]);

  // Resolve effective simulation filters: route-aware overrides
  const effectiveSimulationFilters = useMemo<SimulationFilter[]>(() => {
    if (isPracticePage) return ["practice"];
    if (isHomePage || isTALeaderboardPage) return ["general"];
    return simulationFilters;
  }, [isPracticePage, isHomePage, isTALeaderboardPage, simulationFilters]);

  const setDateRange = (start: Date, end: Date) => {
    setStartDate(start);
    setEndDate(end);
    setHasUserSetDateRange(true); // Mark that the user has set the date range
  };

  const clearFilters = () => {
    setStartDate(earliestDate);
    setEndDate(new Date());
    setSelectedCohortIds([]);
    setSelectedRoles([]);
    setSimulationFilters(["general"]);
    setHasUserSetDateRange(false); // Reset user-set date range
  };

  const hasActiveFilters = selectedCohortIds.length > 0;

  const value: AnalyticsContextType = {
    startDate,
    endDate,
    setDateRange,
    selectedCohortIds,
    setSelectedCohortIds,
    selectedRoles:
      selectedRoles === effectiveRoles ? selectedRoles : effectiveRoles,
    setSelectedRoles,
    simulationFilters:
      simulationFilters === effectiveSimulationFilters
        ? simulationFilters
        : effectiveSimulationFilters,
    setSimulationFilters,
    clearFilters,
    hasActiveFilters,
  };

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
