/**
 * AnalyticsFilters.tsx
 * Combined date picker and cohort picker for analytics pages
 * @AshokSaravanan222 & @siladiea
 * 01/20/2025
 */

"use client";

import {
  CohortPicker,
  Cohort as CohortPickerCohort,
} from "@/components/common/cohort/CohortPicker";
import { RolePicker } from "@/components/common/profile/RolePicker";
import { DatePickerWithRange } from "@/components/ui/date-picker-range";
// import { Label } from "@/components/ui/label";
import { PracticePicker } from "@/components/common/analytics/PracticePicker";
import { SimulationFilter, useAnalytics } from "@/contexts/analytics-context";
import type { ProfileRole } from "@/types";
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { DateRange } from "react-day-picker";

export interface AnalyticsFiltersProps {
  homePage?: boolean;
  reportPage?: boolean;
}

export function AnalyticsFilters({
  homePage = false,
  reportPage = false,
}: AnalyticsFiltersProps) {
  const {
    startDate,
    endDate,
    setDateRange,
    selectedCohortIds,
    setSelectedCohortIds,
    selectedRoles,
    setSelectedRoles,
    simulationFilters,
    setSimulationFilters,
  } = useAnalytics();

  const { data: cohorts = [] } = useQuery({
    queryKey: ["cohorts"],
    queryFn: () => getAllCohorts(),
  });

  // Local UI state to distinguish between "empty (all)" and "specific selections"
  const [practiceSelected, setPracticeSelected] = useState<SimulationFilter[]>(
    () => {
      const vals: SimulationFilter[] = [];
      if (simulationFilters.includes("general")) vals.push("general");
      if (simulationFilters.includes("practice")) vals.push("practice");
      if (simulationFilters.includes("archived")) vals.push("archived");
      // When all three are enabled functionally, start with empty to indicate "All simulations"
      return vals.length === 3 ? [] : vals;
    }
  );

  // Keep local selection in sync when context flags change externally
  useEffect(() => {
    const currentFilters: SimulationFilter[] = [];
    if (simulationFilters.includes("general")) currentFilters.push("general");
    if (simulationFilters.includes("practice")) currentFilters.push("practice");
    if (simulationFilters.includes("archived")) currentFilters.push("archived");

    // Update local state if it doesn't match the context
    if (
      currentFilters.length !== practiceSelected.length ||
      !currentFilters.every((filter) => practiceSelected.includes(filter))
    ) {
      setPracticeSelected(currentFilters);
    }
  }, [simulationFilters, practiceSelected]);

  // Convert to DateRange for the date picker component
  const dateRange: DateRange = {
    from: startDate,
    to: endDate,
  };

  const handleDateRangeChange = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      setDateRange(range.from, range.to);
    }
  };

  // Filter to only active cohorts and convert to the format expected by CohortPicker
  const activeCohorts = cohorts.filter((cohort) => cohort.active);

  const cohortOptions = activeCohorts.map((cohort) => ({
    id: cohort.id,
    title: cohort.title,
    description:
      cohort.description ||
      `Cohort with ${cohort.profileIds?.length || 0} members`,
    memberCount: cohort.profileIds?.length || 0,
  }));

  // Get selected cohorts for the picker
  const selectedCohorts = cohortOptions.filter((cohort) =>
    selectedCohortIds.includes(cohort.id)
  );

  // Calculate the earliest creation date of selected cohorts
  const selectedCohortsEarliestDate = useMemo(() => {
    if (selectedCohortIds.length === 0) {
      // If no specific cohorts selected, use all active cohorts
      const activeCohortDates = activeCohorts
        .map((cohort) => new Date(cohort.createdAt))
        .filter((date) => !isNaN(date.getTime()));

      if (activeCohortDates.length === 0) return null;
      return new Date(Math.min(...activeCohortDates.map((d) => d.getTime())));
    }

    // Get the earliest creation date among selected cohorts
    const selectedCohortDates = activeCohorts
      .filter((cohort) => selectedCohortIds.includes(cohort.id))
      .map((cohort) => new Date(cohort.createdAt))
      .filter((date) => !isNaN(date.getTime()));

    if (selectedCohortDates.length === 0) return null;
    return new Date(Math.min(...selectedCohortDates.map((d) => d.getTime())));
  }, [selectedCohortIds, activeCohorts]);

  // Automatically adjust date range when cohort selection changes
  useEffect(() => {
    if (
      selectedCohortsEarliestDate &&
      selectedCohortsEarliestDate.getTime() !== startDate.getTime()
    ) {
      // Only adjust if the new earliest date is different from current start date
      // and if the new date is earlier than current start date
      if (selectedCohortsEarliestDate < startDate) {
        setDateRange(selectedCohortsEarliestDate, endDate);
      }
    }
  }, [selectedCohortsEarliestDate, startDate, endDate, setDateRange]);

  // Automatically filter available roles and remove invalid selections when cohorts are selected
  useEffect(() => {
    if (selectedCohortIds.length > 0) {
      // When cohorts are selected, only allow "ta" and "instructional" roles
      // Remove any existing selections that aren't "ta" or "instructional"
      const validRoles = selectedRoles.filter(
        (role) => role === "ta" || role === "instructional"
      );
      if (validRoles.length !== selectedRoles.length) {
        setSelectedRoles(validRoles);
      }
    }
  }, [selectedCohortIds, selectedRoles, setSelectedRoles]);

  const handleCohortSelect = (cohorts: CohortPickerCohort[]) => {
    setSelectedCohortIds(cohorts.map((c) => c.id));
  };

  const handleRoleSelect = (roles: ProfileRole[]) => {
    setSelectedRoles(roles);
  };

  return (
    <div className="px-4">
      <div className="flex items-center gap-2">
        {/* General/Practice/Archived Selector (multi-select, matches RolePicker) */}
        {!homePage && (
          <PracticePicker
            selected={practiceSelected}
            onChange={(vals) => {
              // Update UI state first
              setPracticeSelected(vals);
              // Empty selection means all simulations (all three modes on)
              if (vals.length === 0) {
                setSimulationFilters(["general", "practice", "archived"]);
                return;
              }
              setSimulationFilters(vals);
            }}
            placeholder="All simulations"
          />
        )}

        {/* Role Picker */}
        {!homePage && !reportPage && (
          <RolePicker
            roles={
              selectedCohortIds.length > 0
                ? ["instructional", "ta"] // Only show ta and instructional when cohorts are selected
                : ["superadmin", "admin", "instructional", "ta", "guest"] // Show all roles when no cohorts selected
            }
            selectedRoles={selectedRoles}
            onChange={handleRoleSelect}
            placeholder="All roles"
          />
        )}

        {/* Cohort Picker */}
        <CohortPicker
          cohorts={cohortOptions}
          selectedCohorts={selectedCohorts}
          onSelect={handleCohortSelect}
          placeholder="Cohorts"
          hideSelectedChips={true}
        />

        {/* Date Range Picker */}
        <DatePickerWithRange
          dateRange={dateRange}
          setDateRange={handleDateRangeChange}
          className="w-auto"
        />
      </div>
    </div>
  );
}
