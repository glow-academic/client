/**
 * ReportsPage.tsx
 * Reports page for the analytics section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

"use client";

import { useAnalytics } from "@/contexts/analytics-context";
import { useAnalyticsReportsBundle } from "@/lib/api/hooks/analytics";
import { useProfiles } from "@/lib/api/hooks/profiles";
import { useScenarios } from "@/lib/api/hooks/scenarios";
import { useSimulations } from "@/lib/api/hooks/simulations";

import { useMemo } from "react";
import Reports from "./Reports";

export default function ReportsPage() {
  const {
    startDate,
    endDate,
    selectedCohortIds,
    selectedRoles,
    simulationFilters,
  } = useAnalytics();

  const filters = useMemo(
    () => ({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      cohortIds: selectedCohortIds,
      roles: selectedRoles,
      simulationFilters,
    }),
    [startDate, endDate, selectedCohortIds, selectedRoles, simulationFilters]
  );

  const rqOpts = useMemo(() => ({ enabled: true, staleTime: 60_000 }), []);

  // Single hook call instead of 10 separate calls!
  const {
    data: reportsData,
    isLoading,
    isError,
  } = useAnalyticsReportsBundle(filters, rqOpts);
  const { data: allScenarios } = useScenarios();
  const { data: allSimulations } = useSimulations();
  const { data: allProfiles = [] } = useProfiles();

  // Profile lookup map for names
  const profileMap = useMemo(() => {
    const m = new Map<
      string,
      { firstName: string; lastName: string; alias: string }
    >();
    allProfiles.forEach((p) =>
      m.set(p.id, {
        firstName: p.firstName,
        lastName: p.lastName,
        alias: p.alias,
      })
    );
    return m;
  }, [allProfiles]);

  // Transform the data to match the existing Reports component interface
  const transformedData = useMemo(() => {
    if (!reportsData?.data) return [];

    return reportsData.data.map((profile) => {
      const profileInfo = profileMap.get(profile.profileId);
      const profileName = profileInfo
        ? `${profileInfo.firstName} ${profileInfo.lastName}`
        : profile.profileId;
      const profileAlias = profileInfo?.alias || profile.profileId;

      // Helper to format values with thresholds
      const formatMetric = (
        metric: { hasData: boolean; hover: Record<string, unknown> }, // The full metric object with hasData
        valueExtractor: (metric: {
          hasData: boolean;
          hover: Record<string, unknown>;
        }) => number | null,
        formatter: (n: number) => string,
        thresholds: { gray: number; red: number; yellow: number; green: number }
      ) => {
        if (!metric.hasData) {
          return {
            value: null,
            formattedValue: "N/A",
            thresholds,
          };
        }
        const value = valueExtractor(metric);
        return {
          value,
          formattedValue: value !== null ? formatter(value) : "N/A",
          thresholds,
        };
      };

      return {
        profile_id: profile.profileId,
        profileName,
        profileAlias,
        scenario_id: "", // Not available in bundle response
        simulation_id: "", // Not available in bundle response

        averageScore: {
          ...formatMetric(
            profile.metrics.averageScore,
            (m) => (m.hover as any).mean, // eslint-disable-line @typescript-eslint/no-explicit-any
            (n) => `${n}%`,
            { gray: 0, red: 60, yellow: 75, green: 85 }
          ),
          hover: profile.metrics.averageScore.hover,
        },

        completionPercentage: {
          ...formatMetric(
            profile.metrics.completionPercentage,
            (m) => (m.hover as any).percent, // eslint-disable-line @typescript-eslint/no-explicit-any
            (n) => `${n}%`,
            { gray: 0, red: 60, yellow: 75, green: 85 }
          ),
          hover: profile.metrics.completionPercentage.hover,
        },

        firstAttemptPassRate: {
          ...formatMetric(
            profile.metrics.firstAttemptPassRate,
            (m) => (m.hover as any).percent, // eslint-disable-line @typescript-eslint/no-explicit-any
            (n) => `${n}%`,
            { gray: 0, red: 60, yellow: 75, green: 85 }
          ),
          hover: profile.metrics.firstAttemptPassRate.hover,
        },

        highestScore: {
          ...formatMetric(
            profile.metrics.highestScore,
            (m) => (m.hover as any).top?.[0] || null, // eslint-disable-line @typescript-eslint/no-explicit-any
            (n) => `${n}%`,
            { gray: 0, red: 70, yellow: 80, green: 90 }
          ),
          hover: profile.metrics.highestScore.hover,
        },

        messagesPerSession: {
          ...formatMetric(
            profile.metrics.messagesPerSession,
            (m) => (m.hover as any).mean, // eslint-disable-line @typescript-eslint/no-explicit-any
            (n) => `${n}`,
            { gray: 0, red: 5, yellow: 8, green: 12 }
          ),
          hover: profile.metrics.messagesPerSession.hover,
        },

        personaResponseTimes: {
          ...formatMetric(
            profile.metrics.personaResponseTimes,
            (m) => (m.hover as any).meanSeconds, // eslint-disable-line @typescript-eslint/no-explicit-any
            (n) => `${Math.round(n / 60)}m`,
            { gray: 0, red: 300, yellow: 180, green: 60 }
          ),
          hover: profile.metrics.personaResponseTimes.hover,
        },

        sessionEfficiency: {
          ...formatMetric(
            profile.metrics.sessionEfficiency,
            (m) => (m.hover as any).efficiency, // eslint-disable-line @typescript-eslint/no-explicit-any
            (n) => `${n}%`,
            { gray: 0, red: 60, yellow: 75, green: 85 }
          ),
          hover: profile.metrics.sessionEfficiency.hover,
        },

        stagnationRate: {
          ...formatMetric(
            profile.metrics.stagnationRate,
            (m) => (m.hover as any).ratePercent, // eslint-disable-line @typescript-eslint/no-explicit-any
            (n) => `${n}%`,
            { gray: 0, red: 25, yellow: 15, green: 5 }
          ),
          hover: profile.metrics.stagnationRate.hover,
        },

        timeSpent: {
          ...formatMetric(
            profile.metrics.timeSpent,
            (m) => (m.hover as any).avgSessionMinutes, // eslint-disable-line @typescript-eslint/no-explicit-any
            (n) => `${n}m`,
            { gray: 0, red: 90, yellow: 60, green: 30 }
          ),
          hover: profile.metrics.timeSpent.hover,
        },

        totalAttempts: {
          ...formatMetric(
            profile.metrics.totalAttempts,
            (m) => (m.hover as any).attempts, // eslint-disable-line @typescript-eslint/no-explicit-any
            (n) => `${n}`,
            { gray: 0, red: 3, yellow: 5, green: 8 }
          ),
          hover: profile.metrics.totalAttempts.hover,
        },
      };
    });
  }, [reportsData, profileMap]);

  return (
    <Reports
      data={transformedData}
      isLoading={isLoading}
      isError={isError}
      allScenarios={allScenarios ?? []}
      allSimulations={allSimulations ?? []}
    />
  );
}
