/**
 * Reports.tsx
 * Server-backed reports table
 */
"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useAnalytics } from "@/contexts/analytics-context";
import {
  TAPerformanceData,
  useReportColumns,
} from "@/hooks/use-report-columns";
import { getReports, type ReportRow } from "@/utils/api/analytics/get-reports";
import { ReportsDataTable } from "./ReportsDataTable";

export default function Reports() {
  const router = useRouter();

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
  const [rows, setRows] = useState<ReportRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getReports({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          cohortIds: selectedCohortIds,
          roles: selectedRoles as unknown as string[],
          simulationFilters,
        });
        if (!cancelled) {
          setRows(data);
          setLoadError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setRows([]);
          setLoadError((e as Error)?.message || "Failed to load reports");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [startDate, endDate, selectedCohortIds, selectedRoles, simulationFilters]);

  const personaOptions = useMemo(() => {
    const ids = new Set<string>();
    (rows ?? []).forEach((r) =>
      (r.personasTested || []).forEach((id) => ids.add(id))
    );
    return Array.from(ids).map((id) => ({ value: id, label: id }));
  }, [rows]);
  const scenarioOptions = useMemo(() => {
    const ids = new Set<string>();
    (rows ?? []).forEach((r) =>
      (r.scenarioIds || []).forEach((id) => ids.add(id))
    );
    return Array.from(ids).map((id) => ({ value: id, label: id }));
  }, [rows]);
  const simulationOptions = useMemo(() => {
    const ids = new Set<string>();
    (rows ?? []).forEach((r) =>
      (r.simulationIds || []).forEach((id) => ids.add(id))
    );
    return Array.from(ids).map((id) => ({ value: id, label: id }));
  }, [rows]);

  const { columns } = useReportColumns({
    showExport: true,
    onViewReport: handleViewReport,
    personaOptions,
    scenarioOptions,
    simulationOptions,
  });

  const taPerformanceData = useMemo((): TAPerformanceData[] => {
    if (!rows) return [];
    return rows.map((r) => ({
      id: r.id,
      firstName: r.firstName,
      lastName: r.lastName,
      username: r.username,
      averageScore: r.averageScore,
      completionPercentage: r.completionPercentage,
      firstAttemptPassRate: r.firstAttemptPassRate,
      highestScore: r.highestScore,
      messagesPerSession: r.messagesPerSession,
      personaResponseTimes: r.personaResponseTimes,
      sessionEfficiency: r.sessionEfficiency,
      stagnationRate: r.stagnationRate,
      timeSpent: r.timeSpent,
      totalAttempts: r.totalAttempts,
      riskLevel: r.riskLevel,
      riskDetails: r.riskDetails,
      avgScore: r.averageScore,
      completedSessions: r.completedSessions,
      totalSessions: r.totalSessions,
      completionRate:
        r.totalSessions > 0
          ? Math.round((r.completedSessions / r.totalSessions) * 100)
          : 0,
      initials: `${r.firstName} ${r.lastName}`
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase(),
      skillBreakdown: [],
      weakestSkill: { skill: "", score: 0, feedbackCount: 0 },
      strongestSkill: { skill: "", score: 0, feedbackCount: 0 },
      avgTimeMinutes:
        r.totalSessions > 0
          ? Math.round(r.timeSpent / r.totalSessions)
          : r.timeSpent,
      passRate: r.completionPercentage,
      trend: "stable",
      isStruggling:
        r.totalAttempts === 0 || (r.averageScore < 70 && r.totalAttempts > 0),
      hasNoSessions: r.totalSessions === 0,
      lastActivity: r.lastActivity ? new Date(r.lastActivity * 1000) : null,
      scenariosCompleted: r.scenariosCompleted,
      taCohorts: [],
      activeCohorts: 0,
      cohortComparison: [],
      bestCohortRank: 0,
      avgVsCohort: 0,
      role: "",
      personasTested: r.personasTested,
      scenarioIds: r.scenarioIds,
      simulationIds: r.simulationIds,
      hover: r.hover,
    }));
  }, [rows]);

  if (rows === null) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading reports...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Couldn’t load reports</h1>
          <p className="text-gray-600">{loadError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ReportsDataTable
        columns={columns}
        data={taPerformanceData}
        personaOptions={personaOptions}
        scenarioOptions={scenarioOptions}
        simulationOptions={simulationOptions}
        simulations={[]}
        showExport={true}
        onViewReport={handleViewReport}
      />
    </div>
  );
}
