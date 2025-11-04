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
import { api } from "@/lib/api/client";
import { keys } from "@/lib/query/keys";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import Reports from "./Reports";

export default function ReportsPage() {
  const {
    startDate,
    endDate,
    effectiveCohortIds,
    effectiveRoles,
    effectiveSimulationFilters,
  } = useAnalytics();
  const { effectiveDepartmentIds } = useProfile();

  const filters = useMemo(
    () => ({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      cohortIds: effectiveCohortIds,
      roles: effectiveRoles,
      simulationFilters: effectiveSimulationFilters,
      departmentIds: effectiveDepartmentIds,
    }),
    [
      startDate,
      endDate,
      effectiveCohortIds,
      effectiveRoles,
      effectiveSimulationFilters,
      effectiveDepartmentIds,
    ]
  );

  const rqOpts = useMemo(() => ({ enabled: true, staleTime: 60_000 }), []);

  // Single hook call with all data and entity mappings!
  const {
    data: bundle,
    isLoading,
    isError,
  } = useQuery({
    queryKey: keys.reports.with(filters),
    queryFn: () => api.post("/reports", { body: filters }),
    ...rqOpts,
  });

  // Transform bundle data to Reports component format
  const transformedData = useMemo(() => {
    if (!bundle?.data) return [];

    return bundle.data.map((profile) => ({
      profile_id: profile.profileId,
      profileName: `${profile.firstName} ${profile.lastName}`,
      profileAlias: profile.alias ?? "",
      scenario_id: "", // Not used for reports
      simulation_id: "", // Not used for reports

      // Metrics already have hover data from server
      averageScore: {
        value: (profile.metrics.averageScore.hover?.["mean"] as number) ?? 0,
        formattedValue: `${(profile.metrics.averageScore.hover?.["mean"] as number) ?? 0}%`,
        thresholds: { gray: 0, red: 60, yellow: 75, green: 85 },
        hover: profile.metrics.averageScore.hover as { mean: number; median: number; mode: number },
      },
      completionPercentage: {
        value: (profile.metrics.completionPercentage.hover?.["percent"] as number) ?? 0,
        formattedValue: `${(profile.metrics.completionPercentage.hover?.["percent"] as number) ?? 0}%`,
        thresholds: { gray: 0, red: 60, yellow: 75, green: 85 },
        hover: profile.metrics.completionPercentage.hover as { completed: number; total: number; percent: number },
      },
      firstAttemptPassRate: {
        value: (profile.metrics.firstAttemptPassRate.hover?.["percent"] as number) ?? 0,
        formattedValue: `${(profile.metrics.firstAttemptPassRate.hover?.["percent"] as number) ?? 0}%`,
        thresholds: { gray: 0, red: 60, yellow: 75, green: 85 },
        hover: profile.metrics.firstAttemptPassRate.hover as { passed: number; total: number; percent: number },
      },
      highestScore: {
        value:
          (profile.metrics.highestScore.hover?.["top"] as number[])?.[0] as number | null ??
          null,
        formattedValue: (
          profile.metrics.highestScore.hover?.["top"] as number[]
        )?.[0]
          ? `${((profile.metrics.highestScore.hover?.["top"] as number[])?.[0] as number) ?? 0}%`
          : "N/A",
        thresholds: { gray: 0, red: 70, yellow: 80, green: 90 },
        hover: profile.metrics.highestScore.hover as { top: number[] },
      },
      messagesPerSession: {
        value: (profile.metrics.messagesPerSession.hover?.["mean"] as number) ?? 0,
        formattedValue: `${(profile.metrics.messagesPerSession.hover?.["mean"] as number) ?? 0}`,
        thresholds: { gray: 0, red: 5, yellow: 8, green: 12 },
        hover: profile.metrics.messagesPerSession.hover as { mean: number; median: number; count: number },
      },
      personaResponseTimes: {
        value: (profile.metrics.personaResponseTimes.hover?.["meanSeconds"] as number) ?? 0,
        formattedValue: `${(profile.metrics.personaResponseTimes.hover?.["meanSeconds"] as number) ?? 0}s`,
        thresholds: { gray: 0, red: 300, yellow: 180, green: 60 },
        hover: profile.metrics.personaResponseTimes.hover as { meanSeconds: number; medianSeconds: number; samples: number },
      },
      sessionEfficiency: {
        value: (profile.metrics.sessionEfficiency.hover?.["efficiency"] as number) ?? 0,
        formattedValue: `${(profile.metrics.sessionEfficiency.hover?.["efficiency"] as number) ?? 0}%`,
        thresholds: { gray: 0, red: 60, yellow: 75, green: 85 },
        hover: profile.metrics.sessionEfficiency.hover as { avgScorePercent: number; avgMinutes: number; efficiency: number },
      },
      stagnationRate: {
        value: (profile.metrics.stagnationRate.hover?.["ratePercent"] as number) ?? 0,
        formattedValue: `${(profile.metrics.stagnationRate.hover?.["ratePercent"] as number) ?? 0}%`,
        thresholds: { gray: 0, red: 25, yellow: 15, green: 5 },
        hover: profile.metrics.stagnationRate.hover as { tracked: number; stagnant: number; ratePercent: number },
      },
      timeSpent: {
        value: (profile.metrics.timeSpent.hover?.["avgSessionMinutes"] as number) ?? 0,
        formattedValue: `${(profile.metrics.timeSpent.hover?.["avgSessionMinutes"] as number) ?? 0}m`,
        thresholds: { gray: 0, red: 90, yellow: 60, green: 30 },
        hover: profile.metrics.timeSpent.hover as { avgSessionMinutes: number; avgChatMinutes: number; avgOverallMinutes: number },
      },
      totalAttempts: {
        value: (profile.metrics.totalAttempts.hover?.["attempts"] as number) ?? 0,
        formattedValue: `${(profile.metrics.totalAttempts.hover?.["attempts"] as number) ?? 0}`,
        thresholds: { gray: 0, red: 3, yellow: 5, green: 8 },
        hover: profile.metrics.totalAttempts.hover as { attempts: number; uniqueSims: number; meanPerSim: number },
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
