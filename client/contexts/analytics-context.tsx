/**
 * analytics-context.tsx
 * Global context for analytics date range and cohort filtering
 * @AshokSaravanan222 & @siladiea
 * 01/20/2025
 */

"use client";

import { Cohort } from "@/types";
import { ProfileRole } from "@/types";
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { useQuery } from "@tanstack/react-query";
import { subDays } from "date-fns";
import React, { createContext, useContext, useMemo, useState } from "react";
import { useProfile } from "./profile-context";

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

  // Practice data include flag
  includePractice: boolean;
  setIncludePractice: (include: boolean) => void;

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
  undefined
);

interface AnalyticsProviderProps {
  children: React.ReactNode;
}

export function AnalyticsProvider({ children }: AnalyticsProviderProps) {
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
        cohort.profileIds?.includes(effectiveProfile.id)
      );
    }

    // For other roles (admin, etc.), show all cohorts
    return allCohorts;
  }, [allCohorts, effectiveProfile]);

  // Calculate the earliest cohort creation date to use as default start date
  const earliestCohortDate = useMemo(() => {
    if (cohorts.length === 0) {
      // Fallback to 30 days ago if no cohorts available
      return subDays(new Date(), 30);
    }

    const activeCohorts = cohorts.filter((cohort) => cohort.active);
    if (activeCohorts.length === 0) {
      // Fallback to 30 days ago if no active cohorts
      return subDays(new Date(), 30);
    }

    // Find the earliest creation date among active cohorts
    const creationDates = activeCohorts
      .map((cohort) => new Date(cohort.createdAt))
      .filter((date) => !isNaN(date.getTime())); // Filter out invalid dates

    if (creationDates.length === 0) {
      // Fallback to 30 days ago if no valid creation dates
      return subDays(new Date(), 30);
    }

    const earliestDate = new Date(
      Math.min(...creationDates.map((d) => d.getTime()))
    );
    return earliestDate;
  }, [cohorts]);

  // Default to earliest cohort creation date instead of last 30 days
  const [startDate, setStartDate] = useState<Date>(() => earliestCohortDate);
  const [endDate, setEndDate] = useState<Date>(() => new Date());
  const [hasUserSetDateRange, setHasUserSetDateRange] = useState(false);

  // Update start date when cohorts change and earliest date is different
  // Only auto-update if user hasn't manually set a date range
  React.useEffect(() => {
    if (
      !hasUserSetDateRange &&
      earliestCohortDate.getTime() !== startDate.getTime()
    ) {
      setStartDate(earliestCohortDate);
    }
  }, [earliestCohortDate, startDate, hasUserSetDateRange]);

  // Cohort filtering - empty array means all cohorts
  const [selectedCohortIds, setSelectedCohortIds] = useState<string[]>([]);
  // Role filtering - empty array means all roles
  const [selectedRoles, setSelectedRoles] = useState<ProfileRole[]>(["ta"]);
  // Include practice data in analytics
  const [includePractice, setIncludePractice] = useState<boolean>(false);

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
    setHasUserSetDateRange(true); // Mark that the user has set the date range
  };

  const clearFilters = () => {
    setStartDate(earliestCohortDate);
    setEndDate(new Date());
    setSelectedCohortIds([]);
    setSelectedRoles(["ta"]);
    setIncludePractice(false);
    setHasUserSetDateRange(false); // Reset user-set date range
  };

  const hasActiveFilters = selectedCohortIds.length > 0;

  const value: AnalyticsContextType = {
    startDate,
    endDate,
    setDateRange,
    selectedCohortIds,
    setSelectedCohortIds,
    selectedRoles,
    setSelectedRoles,
    includePractice,
    setIncludePractice,
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
