/**
 * ReportsPage.tsx
 * Reports page for the analytics section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

"use client";

import { useAnalytics } from "@/contexts/analytics-context";
import { useDepartments } from "@/contexts/departments-context";
import {
  AverageScoreMetricResponse,
  CompletionPercentageMetricResponse,
  computeCurrent,
  FirstAttemptPassRateMetricResponse,
  HighestScoreMetricResponse,
  MessagesPerSessionMetricResponse,
  PersonaResponseTimesMetricResponse,
  SessionEfficiencyMetricResponse,
  StagnationRateMetricResponse,
  TimeSpentMetricResponse,
  TotalAttemptsMetricResponse,
} from "@/lib/analytics";
import { useAnalyticsReportsBundle } from "@/lib/api/hooks/analytics";
import { useProfiles } from "@/lib/api/hooks/profiles";
import { useScenariosByDepartmentIdBatch } from "@/lib/api/hooks/scenarios";
import { useSimulationsByDepartmentIdBatch } from "@/lib/api/hooks/simulations";

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
  const { effectiveDepartmentIds } = useDepartments();

  const filters = useMemo(
    () => ({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      cohortIds: selectedCohortIds,
      roles: selectedRoles,
      simulationFilters,
    }),
    [startDate, endDate, selectedCohortIds, selectedRoles, simulationFilters],
  );

  const rqOpts = useMemo(() => ({ enabled: true, staleTime: 60_000 }), []);

  // Single hook call instead of 10 separate calls!
  const {
    data: reportsData,
    isLoading,
    isError,
  } = useAnalyticsReportsBundle(filters, rqOpts);
  const { data: allScenarios } = useScenariosByDepartmentIdBatch(
    effectiveDepartmentIds,
  );
  const { data: allSimulations } = useSimulationsByDepartmentIdBatch(
    effectiveDepartmentIds,
  );
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
      }),
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
        thresholds: {
          gray: number;
          red: number;
          yellow: number;
          green: number;
        },
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
            (m) => {
              const metricData = m as AverageScoreMetricResponse;
              return computeCurrent(
                metricData.method,
                metricData.dataPoints || [],
              );
            },
            (n) => `${n}%`,
            { gray: 0, red: 60, yellow: 75, green: 85 },
          ),
          hover: profile.metrics.averageScore.hover,
        },

        completionPercentage: {
          ...formatMetric(
            profile.metrics.completionPercentage,
            (m) => {
              const metricData = m as CompletionPercentageMetricResponse;
              return computeCurrent(
                metricData.method,
                metricData.dataPoints || [],
              );
            },
            (n) => `${n}%`,
            { gray: 0, red: 60, yellow: 75, green: 85 },
          ),
          hover: profile.metrics.completionPercentage.hover,
        },

        firstAttemptPassRate: {
          ...formatMetric(
            profile.metrics.firstAttemptPassRate,
            (m) => {
              const metricData = m as FirstAttemptPassRateMetricResponse;
              return computeCurrent(
                metricData.method,
                metricData.dataPoints || [],
              );
            },
            (n) => `${n}%`,
            { gray: 0, red: 60, yellow: 75, green: 85 },
          ),
          hover: profile.metrics.firstAttemptPassRate.hover,
        },

        highestScore: {
          ...formatMetric(
            profile.metrics.highestScore,
            (m) => {
              const metricData = m as HighestScoreMetricResponse;
              return computeCurrent(
                metricData.method,
                metricData.dataPoints || [],
              );
            },
            (n) => `${n}%`,
            { gray: 0, red: 70, yellow: 80, green: 90 },
          ),
          hover: profile.metrics.highestScore.hover,
        },

        messagesPerSession: {
          ...formatMetric(
            profile.metrics.messagesPerSession,
            (m) => {
              const metricData = m as MessagesPerSessionMetricResponse;
              return computeCurrent(
                metricData.method,
                metricData.dataPoints || [],
              );
            },
            (n) => `${n}`,
            { gray: 0, red: 5, yellow: 8, green: 12 },
          ),
          hover: profile.metrics.messagesPerSession.hover,
        },

        personaResponseTimes: {
          ...formatMetric(
            profile.metrics.personaResponseTimes,
            (m) => {
              const metricData = m as PersonaResponseTimesMetricResponse;
              return computeCurrent(
                metricData.method,
                metricData.dataPoints || [],
              );
            },
            (n) => `${n}s`,
            { gray: 0, red: 300, yellow: 180, green: 60 },
          ),
          hover: profile.metrics.personaResponseTimes.hover,
        },

        sessionEfficiency: {
          ...formatMetric(
            profile.metrics.sessionEfficiency,
            (m) => {
              const metricData = m as SessionEfficiencyMetricResponse;
              return computeCurrent(
                metricData.method,
                metricData.dataPoints || [],
              );
            },
            (n) => `${n}%`,
            { gray: 0, red: 60, yellow: 75, green: 85 },
          ),
          hover: profile.metrics.sessionEfficiency.hover,
        },

        stagnationRate: {
          ...formatMetric(
            profile.metrics.stagnationRate,
            (m) => {
              const metricData = m as StagnationRateMetricResponse;
              return computeCurrent(
                metricData.method,
                metricData.dataPoints || [],
              );
            },
            (n) => `${n}%`,
            { gray: 0, red: 25, yellow: 15, green: 5 },
          ),
          hover: profile.metrics.stagnationRate.hover,
        },

        timeSpent: {
          ...formatMetric(
            profile.metrics.timeSpent,
            (m) => {
              const metricData = m as TimeSpentMetricResponse;
              return computeCurrent(
                metricData.method,
                metricData.dataPoints || [],
              );
            },
            (n) => `${n}m`,
            { gray: 0, red: 90, yellow: 60, green: 30 },
          ),
          hover: profile.metrics.timeSpent.hover,
        },

        totalAttempts: {
          ...formatMetric(
            profile.metrics.totalAttempts,
            (m) => {
              const metricData = m as TotalAttemptsMetricResponse;
              return computeCurrent(
                metricData.method,
                metricData.dataPoints || [],
                "value",
                metricData.keyField as "attemptId",
              );
            },
            (n) => `${n}`,
            { gray: 0, red: 3, yellow: 5, green: 8 },
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
