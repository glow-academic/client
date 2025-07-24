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
import { DatePickerWithRange } from "@/components/ui/date-picker-range";
import { useAnalytics } from "@/contexts/analytics-context";
import { DateRange } from "react-day-picker";

export function AnalyticsFilters() {
  const {
    startDate,
    endDate,
    setDateRange,
    selectedCohortIds,
    setSelectedCohortIds,
    cohorts,
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

  const handleCohortSelect = (selectedCohorts: CohortPickerCohort[]) => {
    setSelectedCohortIds(selectedCohorts.map((cohort) => cohort.id));
  };

  return (
    <div className="flex items-center gap-2">
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
    </div>
  );
}
