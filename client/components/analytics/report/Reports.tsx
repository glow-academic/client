/**
 * Reports.tsx
 * Server-backed reports table using analytics hooks
 */
"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { useAnalytics } from "@/contexts/analytics-context";
import { useHeaderMetrics } from "@/hooks/use-header-metrics";
import {
  TAPerformanceData,
  useReportColumns,
} from "@/hooks/use-report-columns";
import type { AnalyticsFilters } from "@/lib/analytics";
import { useProfiles } from "@/lib/api/hooks/profiles";
import { useSimulations } from "@/lib/api/hooks/simulations";
import {
  buildRowsFromMetrics,
  finalizeRow,
} from "@/utils/analytics/build-report-rows";
import { ReportsDataTable } from "./ReportsDataTable";

type PartialRow = {
  id: string;
  averageScore?: number;
  completionPercentage?: number;
  firstAttemptPassRate?: number;
  highestScore?: number;
  messagesPerSession?: number;
  personaResponseTimes?: number;
  sessionEfficiency?: number;
  stagnationRate?: number;
  timeSpent?: number;
  totalAttempts?: number;
};

export default function Reports() {
  const router = useRouter();
  const params = useSearchParams();
  const selectedProfileId = params.get("profileId") || undefined; // optional way to filter by one TA

  const handleViewReport = (profileId: string) => {
    router.push(`/analytics/reports/p/${profileId}`);
  };

  const {
    startDate,
    endDate,
    selectedCohortIds,
    selectedRoles,
    simulationFilters,
  } = useAnalytics();

  // Build the shared filters (do NOT set profileId here to get everyone's points)
  const filters: AnalyticsFilters = useMemo(
    () => ({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      cohortIds: selectedCohortIds,
      roles: selectedRoles as unknown as string[],
      simulationFilters,
      // profileId: undefined  <-- leave undefined for the grid; filter locally per profile
    }),
    [startDate, endDate, selectedCohortIds, selectedRoles, simulationFilters]
  );

  // Load the 10 metric payloads
  const { data: metrics, isLoading, isError } = useHeaderMetrics(filters);

  // Fold metrics → per-profile numbers
  const partialMap = useMemo(() => {
    if (!metrics) return new Map<string, PartialRow>();
    return buildRowsFromMetrics({
      averageScore: metrics.averageScore,
      completionPercentage: metrics.completionPercentage,
      firstAttemptPassRate: metrics.firstAttemptPassRate,
      highestScore: metrics.highestScore,
      messagesPerSession: metrics.messagesPerSession,
      personaResponseTimes: metrics.personaResponseTimes,
      sessionEfficiency: metrics.sessionEfficiency,
      stagnationRate: metrics.stagnationRate,
      timeSpent: metrics.timeSpent,
      totalAttempts: metrics.totalAttempts,
    });
  }, [metrics]);

  // Optional: narrow to a single profile if you want the grid scoped via URL (?profileId=…)
  const narrowedIds = useMemo(() => {
    const all = Array.from(partialMap.keys());
    return selectedProfileId
      ? all.filter((id) => id === selectedProfileId)
      : all;
  }, [partialMap, selectedProfileId]);

  // Use batched profiles query instead of individual useProfile calls
  const { data: profiles = [] } = useProfiles();

  // Create a map for quick profile lookup
  const profileMap = useMemo(() => {
    const map = new Map<
      string,
      { firstName?: string; lastName?: string; username?: string }
    >();
    profiles.forEach((profile) => {
      map.set(profile.id, {
        firstName: profile.firstName,
        lastName: profile.lastName,
        username: profile.alias, // Use alias instead of username
      });
    });
    return map;
  }, [profiles]);

  // Hydrate name fields per id
  const rows: TAPerformanceData[] = useMemo(() => {
    return narrowedIds.map((id) => {
      const base = partialMap.get(id)!;
      const profile = profileMap.get(id) ?? null;
      return finalizeRow(base, profile);
    });
  }, [narrowedIds, partialMap, profileMap]);

  const { data: allSimulations = [] } = useSimulations();

  // Your table expects options; build from data the same way you did before
  const personaOptions = useMemo(() => [], []);
  const scenarioOptions = useMemo(() => [], []);
  const simulationOptions = useMemo(() => [], []);

  const { columns } = useReportColumns({
    showExport: true,
    onViewReport: handleViewReport,
    personaOptions,
    scenarioOptions,
    simulationOptions,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="text-muted-foreground">Loading reports…</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Couldn't load reports</h1>
          <p className="text-gray-600">
            One or more analytics endpoints failed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ReportsDataTable
        columns={columns}
        data={rows}
        personaOptions={personaOptions}
        scenarioOptions={scenarioOptions}
        simulationOptions={simulationOptions}
        simulations={allSimulations}
        showExport={true}
        onViewReport={handleViewReport}
      />
    </div>
  );
}
