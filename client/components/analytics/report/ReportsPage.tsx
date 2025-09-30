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
import { useCohorts } from "@/lib/api/hooks/cohorts";
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

  const {
    raw: headerMetrics,
    summaries,
    isLoading,
    isError,
  } = useHeaderMetrics(filters, undefined, rqOpts);
  const { data: allScenarios } = useScenarios();
  const { data: allSimulations } = useSimulations();
  const { data: cohorts = [] } = useCohorts();
  const { data: allProfiles = [] } = useProfiles();

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

  // Get profiles from selected cohorts
  const baseProfileIds = useMemo(() => {
    const set = new Set<string>();
    cohorts
      .filter(
        (c) => !selectedCohortIds?.length || selectedCohortIds.includes(c.id)
      )
      .forEach((c) =>
        (c.profileIds || []).forEach((pid: string) => set.add(pid))
      );
    return Array.from(set);
  }, [cohorts, selectedCohortIds]);

  // Union: all profiles in cohorts + any with datapoints
  const profileIds = useMemo(() => {
    const s = new Set<string>(baseProfileIds);
    Object.values(metricByProfile).forEach((map) =>
      map?.forEach((_, id) => s.add(id))
    );
    return [...s];
  }, [baseProfileIds, metricByProfile]);

  // Profile lookup map
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

    // Helper to get profile names
    const getName = (pid: string) => {
      const p = profileMap.get(pid);
      if (!p) return { profileName: pid, profileAlias: pid }; // fallback
      return {
        profileName: `${p.firstName} ${p.lastName}`,
        profileAlias: p.alias,
      };
    };

    // Helper: compute or return N/A
    function computeMetric(
      method: string,
      dps: DataPoint[] | undefined,
      format: (n: number) => string,
      thresholds: { gray: number; red: number; yellow: number; green: number }
    ) {
      const arr = dps ?? [];
      if (arr.length === 0) {
        return {
          value: null as number | null,
          formattedValue: "N/A",
          thresholds,
        };
      }
      const v = compute(
        method as "avg" | "max" | "sum" | "rate" | "countDistinct",
        arr
      );
      return { value: v, formattedValue: format(v), thresholds };
    }

    return profileIds.map((pid) => {
      // scenario/simulation from any available dp for this profile
      const anyDp = (metricByProfile.averageScore.get(pid) ??
        metricByProfile.completionPercentage.get(pid) ??
        [])[0];

      const scenario_id = anyDp?.scenarioId ?? "";
      const simulation_id = anyDp?.simulationId ?? "";

      const nameBits = getName(pid);

      const avg = computeMetric(
        headerMetrics.averageScore?.method ?? "avg",
        valOf(metricByProfile.averageScore, pid),
        (n) => `${n}%`,
        { gray: 0, red: 60, yellow: 75, green: 85 }
      );

      const compl = computeMetric(
        headerMetrics.completionPercentage?.method ?? "rate",
        valOf(metricByProfile.completionPercentage, pid),
        (n) => `${n}%`,
        { gray: 0, red: 60, yellow: 75, green: 85 }
      );

      const fap = computeMetric(
        headerMetrics.firstAttemptPassRate?.method ?? "rate",
        valOf(metricByProfile.firstAttemptPassRate, pid),
        (n) => `${n}%`,
        { gray: 0, red: 60, yellow: 75, green: 85 }
      );

      const high = computeMetric(
        headerMetrics.highestScore?.method ?? "max",
        valOf(metricByProfile.highestScore, pid),
        (n) => `${n}%`,
        { gray: 0, red: 70, yellow: 80, green: 90 }
      );

      const mps = computeMetric(
        headerMetrics.messagesPerSession?.method ?? "avg",
        valOf(metricByProfile.messagesPerSession, pid),
        (n) => `${n}`,
        { gray: 0, red: 5, yellow: 8, green: 12 }
      );

      const prt = computeMetric(
        headerMetrics.personaResponseTimes?.method ?? "avg",
        valOf(metricByProfile.personaResponseTimes, pid),
        (n) => `${Math.round(n / 60)}m`,
        { gray: 0, red: 300, yellow: 180, green: 60 }
      );

      const eff = computeMetric(
        headerMetrics.sessionEfficiency?.method ?? "avg",
        valOf(metricByProfile.sessionEfficiency, pid),
        (n) => `${n}%`,
        { gray: 0, red: 60, yellow: 75, green: 85 }
      );

      const stag = computeMetric(
        headerMetrics.stagnationRate?.method ?? "rate",
        valOf(metricByProfile.stagnationRate, pid),
        (n) => `${n}%`,
        { gray: 0, red: 25, yellow: 15, green: 5 }
      );

      const time = computeMetric(
        headerMetrics.timeSpent?.method ?? "avg",
        valOf(metricByProfile.timeSpent, pid),
        (n) => `${Math.round(n / 60)}m`,
        { gray: 0, red: 90, yellow: 60, green: 30 }
      );

      const attempts = computeMetric(
        headerMetrics.totalAttempts?.method ?? "countDistinct",
        valOf(metricByProfile.totalAttempts, pid),
        (n) => `${n}`,
        { gray: 0, red: 3, yellow: 5, green: 8 }
      );

      return {
        profile_id: pid,
        profileName: nameBits.profileName,
        profileAlias: nameBits.profileAlias,
        scenario_id,
        simulation_id,

        averageScore: {
          ...avg,
          hover: {
            mean: summaries?.averageScore?.mean ?? 0,
            median: summaries?.averageScore?.median ?? 0,
            mode: summaries?.averageScore?.mode ?? 0,
          },
        },

        completionPercentage: {
          ...compl,
          hover: {
            completed: summaries?.completionPercentage?.completed ?? 0,
            total: summaries?.completionPercentage?.total ?? 0,
            percent: summaries?.completionPercentage?.percent ?? 0,
          },
        },

        firstAttemptPassRate: {
          ...fap,
          hover: {
            passed: summaries?.firstAttemptPassRate?.passed ?? 0,
            total: summaries?.firstAttemptPassRate?.total ?? 0,
            percent: summaries?.firstAttemptPassRate?.percent ?? 0,
          },
        },

        highestScore: {
          ...high,
          hover: { top: summaries?.highestScoreTop ?? [] },
        },

        messagesPerSession: {
          ...mps,
          hover: {
            mean: summaries?.messagesPerSession?.mean ?? 0,
            median: summaries?.messagesPerSession?.median ?? 0,
            count: summaries?.messagesPerSession?.count ?? 0,
          },
        },

        personaResponseTimes: {
          ...prt,
          hover: {
            meanSeconds: summaries?.personaResponseTimes?.meanSeconds ?? 0,
            medianSeconds: summaries?.personaResponseTimes?.medianSeconds ?? 0,
            samples: summaries?.personaResponseTimes?.samples ?? 0,
          },
        },

        sessionEfficiency: {
          ...eff,
          hover: {
            avgScorePercent: summaries?.sessionEfficiency?.efficiency ?? 0,
            avgMinutes: 0,
            efficiency: summaries?.sessionEfficiency?.efficiency ?? 0,
          },
        },

        stagnationRate: {
          ...stag,
          hover: {
            tracked: summaries?.stagnationRate?.tracked ?? 0,
            stagnant: summaries?.stagnationRate?.stagnant ?? 0,
            ratePercent: summaries?.stagnationRate?.ratePercent ?? 0,
          },
        },

        timeSpent: {
          ...time,
          hover: {
            avgSessionMinutes: summaries?.timeSpent?.avgSessionMinutes ?? 0,
            avgChatMinutes: summaries?.timeSpent?.avgChatMinutes ?? 0,
            avgOverallMinutes: summaries?.timeSpent?.avgOverallMinutes ?? 0,
          },
        },

        totalAttempts: {
          ...attempts,
          hover: {
            attempts: summaries?.totalAttempts?.attempts ?? 0,
            uniqueSimulations: summaries?.totalAttempts?.uniqueSimulations ?? 0,
            perSimulationMean: summaries?.totalAttempts?.perSimulationMean ?? 0,
          },
        },
      };
    });
  }, [headerMetrics, summaries, profileIds, metricByProfile, profileMap]);

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
