/**
 * analytics-context.tsx
 * Global context for analytics date range and cohort filtering
 * @AshokSaravanan222 & @siladiea
 * 01/20/2025
 */

"use client";

import { Cohort } from "@/types";
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { useQuery } from "@tanstack/react-query";
import { subDays } from "date-fns";
import React, { createContext, useContext, useMemo, useState } from "react";
import { useProfile } from "./profile-context";

interface AnalyticsContextType {
  // Date range state
  startDate: Date;
  endDate: Date;
  setDateRange: (start: Date, end: Date) => void;

  // Cohort filtering state
  selectedCohortIds: string[];
  setSelectedCohortIds: (cohortIds: string[]) => void;

  // Available cohorts data
  cohorts: Cohort[];
  isLoadingCohorts: boolean;

  // Effective cohort IDs for filtering (computed from selectedCohortIds and available cohorts)
  effectiveCohortIds: string[];

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
  // Default to last 30 days
  const [startDate, setStartDate] = useState<Date>(() =>
    subDays(new Date(), 30),
  );
  const [endDate, setEndDate] = useState<Date>(() => new Date());

  // Cohort filtering - empty array means all cohorts
  const [selectedCohortIds, setSelectedCohortIds] = useState<string[]>([]);

  // Get profile context to check user role and ID
  const { effectiveProfile } = useProfile();

  // Fetch available cohorts
  const { data: allCohorts = [], isLoading: isLoadingCohorts } = useQuery({
    queryKey: ["cohorts"],
    queryFn: () => getAllCohorts(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Filter cohorts based on user role
  const cohorts = useMemo(() => {
    if (!effectiveProfile) return allCohorts;

    // If user is instructional, only show cohorts they are part of
    if (effectiveProfile.role === "instructional") {
      return allCohorts.filter((cohort) =>
        cohort.profileIds?.includes(effectiveProfile.id),
      );
    }

    // For other roles (admin, etc.), show all cohorts
    return allCohorts;
  }, [allCohorts, effectiveProfile]);

  // Compute effective cohort IDs for filtering
  const effectiveCohortIds = useMemo(() => {
    // If specific cohorts are selected, use those
    if (selectedCohortIds.length > 0) {
      return selectedCohortIds;
    }

    // If no cohorts are selected (All cohorts), use all available cohorts for the user
    return cohorts.map((cohort) => cohort.id);
  }, [selectedCohortIds, cohorts]);

  const setDateRange = (start: Date, end: Date) => {
    setStartDate(start);
    setEndDate(end);
  };

  const clearFilters = () => {
    setStartDate(subDays(new Date(), 30));
    setEndDate(new Date());
    setSelectedCohortIds([]);
  };

  const hasActiveFilters = selectedCohortIds.length > 0;

  const value: AnalyticsContextType = {
    startDate,
    endDate,
    setDateRange,
    selectedCohortIds,
    setSelectedCohortIds,
    cohorts,
    isLoadingCohorts,
    effectiveCohortIds,
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
