/**
 * ReportsPage.tsx
 * Reports page for the analytics section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

"use client";

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

  const {
    raw: headerMetrics,
    summaries,
    isLoading,
    isError,
  } = useHeaderMetrics(filters, undefined, rqOpts);
  const { data: allScenarios } = useScenarios();
  const { data: allSimulations } = useSimulations();

  // Build per-metric Map<profileId, DataPoint[]>
  const metricByProfile = useMemo(() => {
    const indexMetric = (m?: { dataPoints?: DataPoint[] }) => {
      const map = new Map<string, DataPoint[]>();
      m?.dataPoints?.forEach((dp) => {
        const id = dp.profileId;
        if (!id) return;
        const arr = map.get(id);
        if (arr) arr.push(dp);
        else map.set(id, [dp]);
      });
      return map;
    };

    return {
      averageScore: indexMetric(headerMetrics?.averageScore),
      completionPercentage: indexMetric(headerMetrics?.completionPercentage),
      firstAttemptPassRate: indexMetric(headerMetrics?.firstAttemptPassRate),
      highestScore: indexMetric(headerMetrics?.highestScore),
      messagesPerSession: indexMetric(headerMetrics?.messagesPerSession),
      personaResponseTimes: indexMetric(headerMetrics?.personaResponseTimes),
      sessionEfficiency: indexMetric(headerMetrics?.sessionEfficiency),
      stagnationRate: indexMetric(headerMetrics?.stagnationRate),
      timeSpent: indexMetric(headerMetrics?.timeSpent),
      totalAttempts: indexMetric(headerMetrics?.totalAttempts),
    };
  }, [headerMetrics]);

  // Union of all profileIds across metrics
  const profileIds = useMemo(() => {
    const s = new Set<string>();
    Object.values(metricByProfile).forEach((map) => {
      map?.forEach((_, id) => s.add(id));
    });
    return [...s];
  }, [metricByProfile]);

  // Helpers
  const valOf = (map: Map<string, DataPoint[]> | undefined, id: string) =>
    map?.get(id) ?? [];
  const compute = (method: string, dps: DataPoint[]) =>
    computeCurrent(
      method as "avg" | "max" | "sum" | "rate" | "countDistinct",
      dps
    );

  // Build reports rows — compute each metric ONCE per profile
  const reportsData = useMemo(() => {
    if (!headerMetrics) return [];

    return profileIds.map((pid) => {
      // scenario/simulation from any available dp for this profile
      const anyDp = (metricByProfile.averageScore.get(pid) ??
        metricByProfile.completionPercentage.get(pid) ??
        [])[0];

      const scenario_id = anyDp?.scenarioId ?? "";
      const simulation_id = anyDp?.simulationId ?? "";

      const avgScoreRaw = compute(
        headerMetrics.averageScore?.method ?? "avg",
        valOf(metricByProfile.averageScore, pid)
      );
      const complRaw = compute(
        headerMetrics.completionPercentage?.method ?? "rate",
        valOf(metricByProfile.completionPercentage, pid)
      );
      const fapRaw = compute(
        headerMetrics.firstAttemptPassRate?.method ?? "rate",
        valOf(metricByProfile.firstAttemptPassRate, pid)
      );
      const highRaw = compute(
        headerMetrics.highestScore?.method ?? "max",
        valOf(metricByProfile.highestScore, pid)
      );
      const mpsRaw = compute(
        headerMetrics.messagesPerSession?.method ?? "avg",
        valOf(metricByProfile.messagesPerSession, pid)
      );
      const prtSecondsRaw = compute(
        headerMetrics.personaResponseTimes?.method ?? "avg",
        valOf(metricByProfile.personaResponseTimes, pid)
      );
      const effRaw = compute(
        headerMetrics.sessionEfficiency?.method ?? "avg",
        valOf(metricByProfile.sessionEfficiency, pid)
      );
      const stagRaw = compute(
        headerMetrics.stagnationRate?.method ?? "rate",
        valOf(metricByProfile.stagnationRate, pid)
      );
      const timeMinutes = Math.round(
        compute(
          headerMetrics.timeSpent?.method ?? "avg",
          valOf(metricByProfile.timeSpent, pid)
        ) / 60
      );
      const attemptsRaw = compute(
        headerMetrics.totalAttempts?.method ?? "countDistinct",
        valOf(metricByProfile.totalAttempts, pid)
      );

      return {
        profile_id: pid,
        profileName: pid,
        profileAlias: pid,
        scenario_id,
        simulation_id,

        averageScore: {
          value: avgScoreRaw,
          formattedValue: `${avgScoreRaw}%`,
          thresholds: { gray: 0, red: 60, yellow: 75, green: 85 },
          hover: {
            mean: summaries?.averageScore?.mean ?? 0,
            median: summaries?.averageScore?.median ?? 0,
            mode: summaries?.averageScore?.mode ?? 0,
          },
        },

        completionPercentage: {
          value: complRaw,
          formattedValue: `${complRaw}%`,
          thresholds: { gray: 0, red: 60, yellow: 75, green: 85 },
          hover: {
            completed: summaries?.completionPercentage?.completed ?? 0,
            total: summaries?.completionPercentage?.total ?? 0,
            percent: summaries?.completionPercentage?.percent ?? 0,
          },
        },

        firstAttemptPassRate: {
          value: fapRaw,
          formattedValue: `${fapRaw}%`,
          thresholds: { gray: 0, red: 60, yellow: 75, green: 85 },
          hover: {
            passed: summaries?.firstAttemptPassRate?.passed ?? 0,
            total: summaries?.firstAttemptPassRate?.total ?? 0,
            percent: summaries?.firstAttemptPassRate?.percent ?? 0,
          },
        },

        highestScore: {
          value: highRaw,
          formattedValue: `${highRaw}%`,
          thresholds: { gray: 0, red: 70, yellow: 80, green: 90 },
          hover: { top: summaries?.highestScoreTop ?? [] },
        },

        messagesPerSession: {
          value: mpsRaw,
          formattedValue: `${mpsRaw}`,
          thresholds: { gray: 0, red: 5, yellow: 8, green: 12 },
          hover: {
            mean: summaries?.messagesPerSession?.mean ?? 0,
            median: summaries?.messagesPerSession?.median ?? 0,
            count: summaries?.messagesPerSession?.count ?? 0,
          },
        },

        personaResponseTimes: {
          value: prtSecondsRaw,
          formattedValue: `${Math.round(prtSecondsRaw / 60)}m`,
          thresholds: { gray: 0, red: 300, yellow: 180, green: 60 },
          hover: {
            meanSeconds: summaries?.personaResponseTimes?.meanSeconds ?? 0,
            medianSeconds: summaries?.personaResponseTimes?.medianSeconds ?? 0,
            samples: summaries?.personaResponseTimes?.samples ?? 0,
          },
        },

        sessionEfficiency: {
          value: effRaw,
          formattedValue: `${effRaw}%`,
          thresholds: { gray: 0, red: 60, yellow: 75, green: 85 },
          hover: {
            avgScorePercent: summaries?.sessionEfficiency?.efficiency ?? 0,
            avgMinutes: 0,
            efficiency: summaries?.sessionEfficiency?.efficiency ?? 0,
          },
        },

        stagnationRate: {
          value: stagRaw,
          formattedValue: `${stagRaw}%`,
          thresholds: { gray: 0, red: 25, yellow: 15, green: 5 },
          hover: {
            tracked: summaries?.stagnationRate?.tracked ?? 0,
            stagnant: summaries?.stagnationRate?.stagnant ?? 0,
            ratePercent: summaries?.stagnationRate?.ratePercent ?? 0,
          },
        },

        timeSpent: {
          value: timeMinutes,
          formattedValue: `${timeMinutes}m`,
          thresholds: { gray: 0, red: 90, yellow: 60, green: 30 },
          hover: {
            avgSessionMinutes: summaries?.timeSpent?.avgSessionMinutes ?? 0,
            avgChatMinutes: summaries?.timeSpent?.avgChatMinutes ?? 0,
            avgOverallMinutes: summaries?.timeSpent?.avgOverallMinutes ?? 0,
          },
        },

        totalAttempts: {
          value: attemptsRaw,
          formattedValue: `${attemptsRaw}`,
          thresholds: { gray: 0, red: 3, yellow: 5, green: 8 },
          hover: {
            attempts: summaries?.totalAttempts?.attempts ?? 0,
            uniqueSimulations: summaries?.totalAttempts?.uniqueSimulations ?? 0,
            perSimulationMean: summaries?.totalAttempts?.perSimulationMean ?? 0,
          },
        },
      };
    });
  }, [headerMetrics, summaries, profileIds, metricByProfile]);

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
