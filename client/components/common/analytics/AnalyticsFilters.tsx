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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAnalytics } from "@/contexts/analytics-context";
import { profileRole } from "@/utils/drizzle/schema";
import { useEffect, useMemo } from "react";
import { DateRange } from "react-day-picker";
export function AnalyticsFilters() {
  const {
    startDate,
    endDate,
    setDateRange,
    selectedCohortIds,
    setSelectedCohortIds,
    cohorts,
    selectedRoles,
    setSelectedRoles,
    includePractice,
    setIncludePractice,
  } = useAnalytics();

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

  const handleCohortSelect = (selectedCohorts: CohortPickerCohort[]) => {
    setSelectedCohortIds(selectedCohorts.map((cohort) => cohort.id));
  };

  const handleRoleSelect = (
    roles: (typeof profileRole.enumValues)[number][]
  ) => {
    // Narrow to ProfileRole
    const validRoles = profileRole.enumValues as readonly string[];
    const filtered = roles.filter((r) => validRoles.includes(r));
    setSelectedRoles(filtered as (typeof profileRole.enumValues)[number][]);
  };

  return (
    <div className="flex items-center gap-2">
      {/* Include Practice Switch */}
      <div className="flex items-center gap-2 pr-2">
        <Switch
          id="include-practice"
          checked={includePractice}
          onCheckedChange={(checked) => setIncludePractice(!!checked)}
        />
        <Label htmlFor="include-practice">Include practice</Label>
      </div>

      {/* Date Range Picker */}
      <DatePickerWithRange
        dateRange={dateRange}
        setDateRange={handleDateRangeChange}
        className="w-auto"
      />

      {/* Cohort Picker */}
      <CohortPicker
        cohorts={cohortOptions}
        selectedCohorts={selectedCohorts}
        onSelect={handleCohortSelect}
        placeholder="All cohorts"
        hideSelectedChips={true}
      />

      {/* Role Picker */}
      <RolePicker
        roles={["superadmin", "admin", "instructional", "ta", "guest"]}
        selectedRoles={selectedRoles}
        onChange={handleRoleSelect}
        placeholder="All roles"
        className="min-w-[220px]"
      />
    </div>
  );
}
