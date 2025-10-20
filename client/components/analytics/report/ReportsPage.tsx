/**
 * ReportsPage.tsx
 * Reports page for the analytics section.
 * Refactored to use enhanced v2 bundle with entity mappings.
 * @AshokSaravanan222 & @siladiea
 * 10/15/2025
 */

"use client";

import { useAnalytics } from "@/contexts/analytics-context";
import { useProfile } from "@/contexts/profile-context";
import { useMemo } from "react";
import Reports from "./Reports";
import { useReports } from "@/lib/api/v2/hooks/reports";

export default function ReportsPage() {
  const {
    startDate,
    endDate,
    selectedCohortIds,
    selectedRoles,
    simulationFilters,
  } = useAnalytics();
  const { effectiveDepartmentIds } = useProfile();

  const filters = useMemo(
    () => ({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      cohortIds: selectedCohortIds,
      roles: selectedRoles,
      simulationFilters,
      departmentIds: effectiveDepartmentIds,
    }),
    [
      startDate,
      endDate,
      selectedCohortIds,
      selectedRoles,
      simulationFilters,
      effectiveDepartmentIds,
    ]
  );

  const rqOpts = useMemo(() => ({ enabled: true, staleTime: 60_000 }), []);

  // Single hook call with all data and entity mappings!
  const {
    data: bundle,
    isLoading,
    isError,
  } = useReports(filters, rqOpts);

  // Transform bundle data to Reports component format
  const transformedData = useMemo(() => {
    if (!bundle?.data) return [];

    return bundle.data.map((profile) => ({
      profile_id: profile.profileId,
      profileName: `${profile.firstName} ${profile.lastName}`,
      profileAlias: profile.alias,
      scenario_id: "", // Not used for reports
      simulation_id: "", // Not used for reports

      // Metrics already have hover data from server
      averageScore: {
        value: profile.metrics.averageScore.hover.mean,
        formattedValue: `${profile.metrics.averageScore.hover.mean}%`,
        thresholds: { gray: 0, red: 60, yellow: 75, green: 85 },
        hover: profile.metrics.averageScore.hover,
      },
      completionPercentage: {
        value: profile.metrics.completionPercentage.hover.percent,
        formattedValue: `${profile.metrics.completionPercentage.hover.percent}%`,
        thresholds: { gray: 0, red: 60, yellow: 75, green: 85 },
        hover: profile.metrics.completionPercentage.hover,
      },
      firstAttemptPassRate: {
        value: profile.metrics.firstAttemptPassRate.hover.percent,
        formattedValue: `${profile.metrics.firstAttemptPassRate.hover.percent}%`,
        thresholds: { gray: 0, red: 60, yellow: 75, green: 85 },
        hover: profile.metrics.firstAttemptPassRate.hover,
      },
      highestScore: {
        value: profile.metrics.highestScore.hover.top[0] ?? null,
        formattedValue: profile.metrics.highestScore.hover.top[0]
          ? `${profile.metrics.highestScore.hover.top[0]}%`
          : "N/A",
        thresholds: { gray: 0, red: 70, yellow: 80, green: 90 },
        hover: profile.metrics.highestScore.hover,
      },
      messagesPerSession: {
        value: profile.metrics.messagesPerSession.hover.mean,
        formattedValue: `${profile.metrics.messagesPerSession.hover.mean}`,
        thresholds: { gray: 0, red: 5, yellow: 8, green: 12 },
        hover: profile.metrics.messagesPerSession.hover,
      },
      personaResponseTimes: {
        value: profile.metrics.personaResponseTimes.hover.meanSeconds,
        formattedValue: `${profile.metrics.personaResponseTimes.hover.meanSeconds}s`,
        thresholds: { gray: 0, red: 300, yellow: 180, green: 60 },
        hover: profile.metrics.personaResponseTimes.hover,
      },
      sessionEfficiency: {
        value: profile.metrics.sessionEfficiency.hover.efficiency,
        formattedValue: `${profile.metrics.sessionEfficiency.hover.efficiency}%`,
        thresholds: { gray: 0, red: 60, yellow: 75, green: 85 },
        hover: profile.metrics.sessionEfficiency.hover,
      },
      stagnationRate: {
        value: profile.metrics.stagnationRate.hover.ratePercent,
        formattedValue: `${profile.metrics.stagnationRate.hover.ratePercent}%`,
        thresholds: { gray: 0, red: 25, yellow: 15, green: 5 },
        hover: profile.metrics.stagnationRate.hover,
      },
      timeSpent: {
        value: profile.metrics.timeSpent.hover.avgSessionMinutes,
        formattedValue: `${profile.metrics.timeSpent.hover.avgSessionMinutes}m`,
        thresholds: { gray: 0, red: 90, yellow: 60, green: 30 },
        hover: profile.metrics.timeSpent.hover,
      },
      totalAttempts: {
        value: profile.metrics.totalAttempts.hover.attempts,
        formattedValue: `${profile.metrics.totalAttempts.hover.attempts}`,
        thresholds: { gray: 0, red: 3, yellow: 5, green: 8 },
        hover: profile.metrics.totalAttempts.hover,
      },
    }));
  }, [bundle]);

  return (
    <Reports
      data={transformedData}
      scenarioMapping={bundle?.scenario_mapping ?? {}}
      simulationMapping={bundle?.simulation_mapping ?? {}}
      isLoading={isLoading}
      isError={isError}
    />
  );
}
