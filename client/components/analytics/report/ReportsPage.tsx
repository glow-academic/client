/**
 * ReportsPage.tsx
 * Reports page for the analytics section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { useAnalytics } from "@/contexts/analytics-context";
import { useHeaderMetrics } from "@/hooks/use-header-metrics";
import { computeCurrent, type DataPoint } from "@/lib/analytics";
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

  const filters = {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    cohortIds: selectedCohortIds,
    roles: selectedRoles,
    simulationFilters,
  };

  const {
    raw: headerMetrics,
    summaries,
    isLoading,
    isError,
  } = useHeaderMetrics(filters);
  const { data: allScenarios } = useScenarios();
  const { data: allSimulations } = useSimulations();

  // Transform HeaderMetrics to ReportsDataItem[] using metric-recompute-utils
  const reportsData = useMemo(() => {
    if (!headerMetrics) return [];

    // Get all unique profile IDs from data points
    const allDataPoints = [
      ...(headerMetrics.averageScore?.dataPoints || []),
      ...(headerMetrics.completionPercentage?.dataPoints || []),
      ...(headerMetrics.firstAttemptPassRate?.dataPoints || []),
      ...(headerMetrics.highestScore?.dataPoints || []),
      ...(headerMetrics.messagesPerSession?.dataPoints || []),
      ...(headerMetrics.personaResponseTimes?.dataPoints || []),
      ...(headerMetrics.sessionEfficiency?.dataPoints || []),
      ...(headerMetrics.stagnationRate?.dataPoints || []),
      ...(headerMetrics.timeSpent?.dataPoints || []),
      ...(headerMetrics.totalAttempts?.dataPoints || []),
    ];

    const profileIds = [
      ...new Set(allDataPoints.map((p) => p.profileId).filter(Boolean)),
    ];

    return profileIds.map((profileId) => {
      // Get data points for this profile
      const profileDataPoints = allDataPoints.filter(
        (p) => p.profileId === profileId
      );

      // Extract scenario_id and simulation_id from the first data point
      const firstDataPoint = profileDataPoints[0];
      const scenario_id = firstDataPoint?.scenarioId || "";
      const simulation_id = firstDataPoint?.simulationId || "";

      // Helper function to compute current value from data points using existing logic
      const computeCurrentValue = (dataPoints: DataPoint[], method: string) => {
        if (!dataPoints.length) return 0;
        return computeCurrent(
          method as "avg" | "max" | "sum" | "rate" | "countDistinct",
          dataPoints
        );
      };

      return {
        profile_id: profileId,
        profileName: profileId, // Would be enhanced with actual profile data
        profileAlias: profileId,
        scenario_id,
        simulation_id,

        averageScore: {
          value: computeCurrentValue(
            profileDataPoints.filter((p) =>
              headerMetrics.averageScore?.dataPoints?.some((dp) => dp === p)
            ),
            headerMetrics.averageScore?.method || "avg"
          ),
          formattedValue: `${computeCurrentValue(
            profileDataPoints.filter((p) =>
              headerMetrics.averageScore?.dataPoints?.some((dp) => dp === p)
            ),
            headerMetrics.averageScore?.method || "avg"
          )}%`,
          thresholds: { gray: 0, red: 60, yellow: 75, green: 85 },
          hover: {
            mean: summaries?.averageScore?.mean ?? 0,
            median: summaries?.averageScore?.median ?? 0,
            mode: summaries?.averageScore?.mode ?? 0,
          },
        },

        completionPercentage: {
          value: computeCurrentValue(
            profileDataPoints.filter((p) =>
              headerMetrics.completionPercentage?.dataPoints?.some(
                (dp) => dp === p
              )
            ),
            headerMetrics.completionPercentage?.method || "rate"
          ),
          formattedValue: `${computeCurrentValue(
            profileDataPoints.filter((p) =>
              headerMetrics.completionPercentage?.dataPoints?.some(
                (dp) => dp === p
              )
            ),
            headerMetrics.completionPercentage?.method || "rate"
          )}%`,
          thresholds: { gray: 0, red: 60, yellow: 75, green: 85 },
          hover: {
            completed: summaries?.completionPercentage?.completed ?? 0,
            total: summaries?.completionPercentage?.total ?? 0,
            percent: summaries?.completionPercentage?.percent ?? 0,
          },
        },

        firstAttemptPassRate: {
          value: computeCurrentValue(
            profileDataPoints.filter((p) =>
              headerMetrics.firstAttemptPassRate?.dataPoints?.some(
                (dp) => dp === p
              )
            ),
            headerMetrics.firstAttemptPassRate?.method || "rate"
          ),
          formattedValue: `${computeCurrentValue(
            profileDataPoints.filter((p) =>
              headerMetrics.firstAttemptPassRate?.dataPoints?.some(
                (dp) => dp === p
              )
            ),
            headerMetrics.firstAttemptPassRate?.method || "rate"
          )}%`,
          thresholds: { gray: 0, red: 60, yellow: 75, green: 85 },
          hover: {
            passed: summaries?.firstAttemptPassRate?.passed ?? 0,
            total: summaries?.firstAttemptPassRate?.total ?? 0,
            percent: summaries?.firstAttemptPassRate?.percent ?? 0,
          },
        },

        highestScore: {
          value: computeCurrentValue(
            profileDataPoints.filter((p) =>
              headerMetrics.highestScore?.dataPoints?.some((dp) => dp === p)
            ),
            headerMetrics.highestScore?.method || "max"
          ),
          formattedValue: `${computeCurrentValue(
            profileDataPoints.filter((p) =>
              headerMetrics.highestScore?.dataPoints?.some((dp) => dp === p)
            ),
            headerMetrics.highestScore?.method || "max"
          )}%`,
          thresholds: { gray: 0, red: 70, yellow: 80, green: 90 },
          hover: {
            top: summaries?.highestScoreTop ?? [],
          },
        },

        messagesPerSession: {
          value: computeCurrentValue(
            profileDataPoints.filter((p) =>
              headerMetrics.messagesPerSession?.dataPoints?.some(
                (dp) => dp === p
              )
            ),
            headerMetrics.messagesPerSession?.method || "avg"
          ),
          formattedValue: `${computeCurrentValue(
            profileDataPoints.filter((p) =>
              headerMetrics.messagesPerSession?.dataPoints?.some(
                (dp) => dp === p
              )
            ),
            headerMetrics.messagesPerSession?.method || "avg"
          )}`,
          thresholds: { gray: 0, red: 5, yellow: 8, green: 12 },
          hover: {
            mean: summaries?.messagesPerSession?.mean ?? 0,
            median: summaries?.messagesPerSession?.median ?? 0,
            count: summaries?.messagesPerSession?.count ?? 0,
          },
        },

        personaResponseTimes: {
          value: computeCurrentValue(
            profileDataPoints.filter((p) =>
              headerMetrics.personaResponseTimes?.dataPoints?.some(
                (dp) => dp === p
              )
            ),
            headerMetrics.personaResponseTimes?.method || "avg"
          ),
          formattedValue: `${Math.round(
            computeCurrentValue(
              profileDataPoints.filter((p) =>
                headerMetrics.personaResponseTimes?.dataPoints?.some(
                  (dp) => dp === p
                )
              ),
              headerMetrics.personaResponseTimes?.method || "avg"
            ) / 60
          )}m`,
          thresholds: { gray: 0, red: 300, yellow: 180, green: 60 },
          hover: {
            meanSeconds: summaries?.personaResponseTimes?.meanSeconds ?? 0,
            medianSeconds: summaries?.personaResponseTimes?.medianSeconds ?? 0,
            samples: summaries?.personaResponseTimes?.samples ?? 0,
          },
        },

        sessionEfficiency: {
          value: computeCurrentValue(
            profileDataPoints.filter((p) =>
              headerMetrics.sessionEfficiency?.dataPoints?.some(
                (dp) => dp === p
              )
            ),
            headerMetrics.sessionEfficiency?.method || "avg"
          ),
          formattedValue: `${computeCurrentValue(
            profileDataPoints.filter((p) =>
              headerMetrics.sessionEfficiency?.dataPoints?.some(
                (dp) => dp === p
              )
            ),
            headerMetrics.sessionEfficiency?.method || "avg"
          )}%`,
          thresholds: { gray: 0, red: 60, yellow: 75, green: 85 },
          hover: {
            avgScorePercent: summaries?.sessionEfficiency?.efficiency ?? 0,
            avgMinutes: 0, // Would need to be calculated from other metrics
            efficiency: summaries?.sessionEfficiency?.efficiency ?? 0,
          },
        },

        stagnationRate: {
          value: computeCurrentValue(
            profileDataPoints.filter((p) =>
              headerMetrics.stagnationRate?.dataPoints?.some((dp) => dp === p)
            ),
            headerMetrics.stagnationRate?.method || "rate"
          ),
          formattedValue: `${computeCurrentValue(
            profileDataPoints.filter((p) =>
              headerMetrics.stagnationRate?.dataPoints?.some((dp) => dp === p)
            ),
            headerMetrics.stagnationRate?.method || "rate"
          )}%`,
          thresholds: { gray: 0, red: 25, yellow: 15, green: 5 },
          hover: {
            tracked: summaries?.stagnationRate?.tracked ?? 0,
            stagnant: summaries?.stagnationRate?.stagnant ?? 0,
            ratePercent: summaries?.stagnationRate?.ratePercent ?? 0,
          },
        },

        timeSpent: {
          value: Math.round(
            computeCurrentValue(
              profileDataPoints.filter((p) =>
                headerMetrics.timeSpent?.dataPoints?.some((dp) => dp === p)
              ),
              headerMetrics.timeSpent?.method || "avg"
            ) / 60
          ),
          formattedValue: `${Math.round(
            computeCurrentValue(
              profileDataPoints.filter((p) =>
                headerMetrics.timeSpent?.dataPoints?.some((dp) => dp === p)
              ),
              headerMetrics.timeSpent?.method || "avg"
            ) / 60
          )}m`,
          thresholds: { gray: 0, red: 90, yellow: 60, green: 30 },
          hover: {
            avgSessionMinutes: summaries?.timeSpent?.avgSessionMinutes ?? 0,
            avgChatMinutes: summaries?.timeSpent?.avgChatMinutes ?? 0,
            avgOverallMinutes: summaries?.timeSpent?.avgOverallMinutes ?? 0,
          },
        },

        totalAttempts: {
          value: computeCurrentValue(
            profileDataPoints.filter((p) =>
              headerMetrics.totalAttempts?.dataPoints?.some((dp) => dp === p)
            ),
            headerMetrics.totalAttempts?.method || "countDistinct"
          ),
          formattedValue: `${computeCurrentValue(
            profileDataPoints.filter((p) =>
              headerMetrics.totalAttempts?.dataPoints?.some((dp) => dp === p)
            ),
            headerMetrics.totalAttempts?.method || "countDistinct"
          )}`,
          thresholds: { gray: 0, red: 3, yellow: 5, green: 8 },
          hover: {
            attempts: summaries?.totalAttempts?.attempts ?? 0,
            uniqueSimulations: summaries?.totalAttempts?.uniqueSimulations ?? 0,
            perSimulationMean: summaries?.totalAttempts?.perSimulationMean ?? 0,
          },
        },
      };
    });
  }, [headerMetrics, summaries]);

  return (
    <Reports
      data={reportsData}
      isLoading={isLoading}
      isError={isError}
      allScenarios={allScenarios ?? []}
      allSimulations={allSimulations ?? []}
    />
  );
}
