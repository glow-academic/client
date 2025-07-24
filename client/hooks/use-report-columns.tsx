"use client";
import { DataTableColumnHeader } from "@/components/common/history/DataTableColumnHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery } from "@tanstack/react-query";
import { ColumnDef, Row, Table } from "@tanstack/react-table";
import {
  AlertTriangle,
  Clock,
  MessageCircle,
  Target,
  Timer,
} from "lucide-react";
import { useMemo } from "react";

import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { getAllPersonas } from "@/utils/queries/personas/get-all-personas";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";

// Enhanced types for the TA performance data with the 10 metrics
export interface TAPerformanceData {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  // The 10 metrics from header components
  averageScore: number;
  completionPercentage: number;
  firstAttemptPassRate: number;
  highestScore: number;
  messagesPerSession: number;
  personaResponseTimes: number; // in minutes
  sessionEfficiency: number; // percentage
  stagnationRate: number; // percentage
  timeSpent: number; // in minutes
  totalAttempts: number;
  // Risk assessment
  riskLevel: "good" | "warning" | "danger";
  riskDetails: {
    dangerCount: number;
    warningCount: number;
    goodCount: number;
  };
  // Legacy fields for compatibility
  avgScore: number;
  completedSessions: number;
  totalSessions: number;
  completionRate: number;
  initials: string;
  skillBreakdown: Array<{
    skill: string;
    score: number;
    feedbackCount: number;
  }>;
  weakestSkill: {
    skill: string;
    score: number;
    feedbackCount: number;
  };
  strongestSkill: {
    skill: string;
    score: number;
    feedbackCount: number;
  };
  avgTimeMinutes: number;
  passRate: number;
  trend: "improving" | "declining" | "stable";
  isStruggling: boolean;
  hasNoSessions: boolean;
  lastActivity: Date | null;
  scenariosCompleted: number;
  taCohorts: string[];
  activeCohorts: number;
  cohortComparison: Array<{
    cohortId: string;
    cohortName: string;
    cohortAvg: number;
    difference: number;
    rank: number;
  }>;
  bestCohortRank: number;
  avgVsCohort: number;
  // Additional fields for filtering
  personasTested: string[];
  scenarioIds: string[];
  simulationIds: string[];
}

export interface UseReportColumnsProps {
  showExport?: boolean;
  onViewReport: (profileId: string) => void;
}

export function useReportColumns({
  showExport = true,
  onViewReport,
}: UseReportColumnsProps) {
  // Fetch data for filter options
  const { data: _profiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getAllProfiles(),
  });

  const { data: cohorts } = useQuery({
    queryKey: ["cohorts"],
    queryFn: () => getAllCohorts(),
  });

  const { data: personas } = useQuery({
    queryKey: ["personas"],
    queryFn: () => getAllPersonas(),
  });

  const { data: scenarios } = useQuery({
    queryKey: ["scenarios"],
    queryFn: () => getAllScenarios(),
  });

  const { data: simulations } = useQuery({
    queryKey: ["simulations"],
    queryFn: () => getAllSimulations(),
  });

  // Create filter options
  const performanceOptions = useMemo(
    () => [
      {
        value: "all",
        label: "All TAs",
      },
      {
        value: "danger",
        label: "At Risk",
      },
      {
        value: "warning",
        label: "Warning",
      },
      {
        value: "good",
        label: "Good",
      },
    ],
    []
  );

  const cohortOptions = useMemo(() => {
    if (!cohorts) return [];
    return cohorts.map((cohort) => ({
      value: cohort.id,
      label: cohort.title,
    }));
  }, [cohorts]);

  const personaOptions = useMemo(() => {
    if (!personas) return [];
    return personas
      .filter((persona) => persona.defaultPersona === true)
      .map((persona) => ({
        value: persona.id,
        label: persona.name,
      }));
  }, [personas]);

  const scenarioOptions = useMemo(() => {
    if (!scenarios) return [];
    return scenarios.map((scenario) => ({
      value: scenario.id,
      label: scenario.name,
    }));
  }, [scenarios]);

  const simulationOptions = useMemo(() => {
    if (!simulations) return [];
    return simulations.map((simulation) => ({
      value: simulation.id,
      label: simulation.title,
    }));
  }, [simulations]);

  // Define columns
  const columns = useMemo(() => {
    const reportColumns: ColumnDef<TAPerformanceData>[] = [
      // Select column - only show if showExport is true
      ...(showExport
        ? [
            {
              id: "select",
              header: ({ table }: { table: Table<TAPerformanceData> }) => (
                <Checkbox
                  checked={
                    table.getIsAllPageRowsSelected() ||
                    (table.getIsSomePageRowsSelected() && "indeterminate")
                  }
                  onCheckedChange={(value: boolean | "indeterminate") =>
                    table.toggleAllPageRowsSelected(!!value)
                  }
                  aria-label="Select all"
                  className="translate-y-[2px]"
                />
              ),
              cell: ({ row }: { row: Row<TAPerformanceData> }) => (
                <Checkbox
                  checked={row.getIsSelected()}
                  onCheckedChange={(value: boolean | "indeterminate") =>
                    row.toggleSelected(!!value)
                  }
                  aria-label="Select row"
                  className="translate-y-[2px]"
                />
              ),
              enableSorting: false,
              enableHiding: false,
            },
          ]
        : []),

      // Name column
      {
        accessorKey: "firstName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Name" />
        ),
        cell: ({ row }) => {
          const ta = row.original;
          return (
            <div className="flex items-center justify-center gap-1">
              <div
                className="font-medium text-xs cursor-pointer hover:text-primary hover:underline truncate"
                onClick={() => onViewReport(ta.id)}
                title={`${ta.firstName} ${ta.lastName}`}
              >
                {ta.firstName} {ta.lastName}
              </div>
              {ta.riskLevel === "danger" && (
                <AlertTriangle className="h-2.5 w-2.5 text-red-600 flex-shrink-0" />
              )}
              {ta.riskLevel === "warning" && (
                <AlertTriangle className="h-2.5 w-2.5 text-orange-600 flex-shrink-0" />
              )}
            </div>
          );
        },
        filterFn: (row, _, value) => {
          const ta = row.original;
          const searchTerm = value.toLowerCase();
          return (
            ta.firstName.toLowerCase().includes(searchTerm) ||
            ta.lastName.toLowerCase().includes(searchTerm) ||
            ta.username.toLowerCase().includes(searchTerm)
          );
        },
        enableSorting: true,
      },

      // Alias column
      {
        accessorKey: "username",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Alias" />
        ),
        cell: ({ row }) => {
          const ta = row.original;
          return (
            <div
              className="text-xs text-muted-foreground truncate text-center"
              title={ta.username}
            >
              {ta.username}
            </div>
          );
        },
        enableSorting: true,
      },

      // Average Score column
      {
        accessorKey: "averageScore",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Avg Score" />
        ),
        cell: ({ row }) => {
          const ta = row.original;
          return (
            <div className="text-center">
              <Badge
                variant={
                  ta.averageScore >= 85
                    ? "default"
                    : ta.averageScore >= 75
                      ? "secondary"
                      : "destructive"
                }
                className="text-[10px] font-medium px-1 py-0 h-4"
              >
                {ta.hasNoSessions ? "N/A" : `${ta.averageScore}%`}
              </Badge>
            </div>
          );
        },
        enableSorting: true,
      },

      // Completion Percentage column
      {
        accessorKey: "completionPercentage",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Completion" />
        ),
        cell: ({ row }) => {
          const ta = row.original;
          return (
            <div className="text-center">
              <Badge
                variant={
                  ta.completionPercentage >= 85
                    ? "default"
                    : ta.completionPercentage >= 75
                      ? "secondary"
                      : "destructive"
                }
                className="text-[10px] font-medium px-1 py-0 h-4"
              >
                {ta.hasNoSessions ? "N/A" : `${ta.completionPercentage}%`}
              </Badge>
            </div>
          );
        },
        enableSorting: true,
      },

      // First Attempt Pass Rate column
      {
        accessorKey: "firstAttemptPassRate",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="First Pass" />
        ),
        cell: ({ row }) => {
          const ta = row.original;
          return (
            <div className="text-center">
              <Badge
                variant={
                  ta.firstAttemptPassRate >= 85
                    ? "default"
                    : ta.firstAttemptPassRate >= 75
                      ? "secondary"
                      : "destructive"
                }
                className="text-[10px] font-medium px-1 py-0 h-4"
              >
                {ta.hasNoSessions ? "N/A" : `${ta.firstAttemptPassRate}%`}
              </Badge>
            </div>
          );
        },
        enableSorting: true,
      },

      // Highest Score column
      {
        accessorKey: "highestScore",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Highest" />
        ),
        cell: ({ row }) => {
          const ta = row.original;
          return (
            <div className="text-center">
              <Badge
                variant={
                  ta.highestScore >= 90
                    ? "default"
                    : ta.highestScore >= 80
                      ? "secondary"
                      : "destructive"
                }
                className="text-[10px] font-medium px-1 py-0 h-4"
              >
                {ta.hasNoSessions ? "N/A" : `${ta.highestScore}%`}
              </Badge>
            </div>
          );
        },
        enableSorting: true,
      },

      // Messages Per Session column
      {
        accessorKey: "messagesPerSession",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Msgs/Sess" />
        ),
        cell: ({ row }) => {
          const ta = row.original;
          return (
            <div className="text-center">
              <div className="text-[10px] font-medium flex items-center justify-center gap-0.5">
                <MessageCircle className="h-2.5 w-2.5" />
                {ta.hasNoSessions ? "N/A" : ta.messagesPerSession}
              </div>
            </div>
          );
        },
        enableSorting: true,
      },

      // Persona Response Times column
      {
        accessorKey: "personaResponseTimes",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Response Time" />
        ),
        cell: ({ row }) => {
          const ta = row.original;
          return (
            <div className="text-center">
              <div className="text-[10px] font-medium flex items-center justify-center gap-0.5">
                <Clock className="h-2.5 w-2.5" />
                {ta.hasNoSessions ? "N/A" : `${ta.personaResponseTimes}m`}
              </div>
            </div>
          );
        },
        enableSorting: true,
      },

      // Session Efficiency column
      {
        accessorKey: "sessionEfficiency",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Efficiency" />
        ),
        cell: ({ row }) => {
          const ta = row.original;
          return (
            <div className="text-center">
              <Badge
                variant={
                  ta.sessionEfficiency >= 85
                    ? "default"
                    : ta.sessionEfficiency >= 75
                      ? "secondary"
                      : "destructive"
                }
                className="text-[10px] font-medium px-1 py-0 h-4"
              >
                {ta.hasNoSessions ? "N/A" : `${ta.sessionEfficiency}%`}
              </Badge>
            </div>
          );
        },
        enableSorting: true,
      },

      // Stagnation Rate column
      {
        accessorKey: "stagnationRate",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Stagnation" />
        ),
        cell: ({ row }) => {
          const ta = row.original;
          return (
            <div className="text-center">
              <Badge
                variant={
                  ta.stagnationRate <= 15
                    ? "default"
                    : ta.stagnationRate <= 25
                      ? "secondary"
                      : "destructive"
                }
                className="text-[10px] font-medium px-1 py-0 h-4"
              >
                {ta.hasNoSessions ? "N/A" : `${ta.stagnationRate}%`}
              </Badge>
            </div>
          );
        },
        enableSorting: true,
      },

      // Time Spent column
      {
        accessorKey: "timeSpent",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Time Spent" />
        ),
        cell: ({ row }) => {
          const ta = row.original;
          return (
            <div className="text-center">
              <div className="text-[10px] font-medium flex items-center justify-center gap-0.5">
                <Timer className="h-2.5 w-2.5" />
                {ta.hasNoSessions ? "N/A" : `${ta.timeSpent}m`}
              </div>
            </div>
          );
        },
        enableSorting: true,
      },

      // Total Attempts column
      {
        accessorKey: "totalAttempts",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Attempts" />
        ),
        cell: ({ row }) => {
          const ta = row.original;
          return (
            <div className="text-center">
              <div className="text-[10px] font-medium flex items-center justify-center gap-0.5">
                <Target className="h-2.5 w-2.5" />
                {ta.totalAttempts}
              </div>
            </div>
          );
        },
        enableSorting: true,
      },

      // Risk Level column
      {
        accessorKey: "riskLevel",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Risk Level" />
        ),
        cell: ({ row }) => {
          const ta = row.original;
          return (
            <div className="text-center">
              {ta.hasNoSessions ? (
                <Badge
                  variant="destructive"
                  className="text-[10px] px-1 py-0 h-4"
                >
                  No Data
                </Badge>
              ) : ta.riskLevel === "danger" ? (
                <Badge
                  variant="destructive"
                  className="text-[10px] px-1 py-0 h-4"
                >
                  At Risk
                </Badge>
              ) : ta.riskLevel === "warning" ? (
                <Badge
                  variant="secondary"
                  className="text-[10px] bg-orange-100 text-orange-800 px-1 py-0 h-4"
                >
                  Warning
                </Badge>
              ) : (
                <Badge
                  variant="default"
                  className="text-[10px] bg-green-100 text-green-800 px-1 py-0 h-4"
                >
                  Good
                </Badge>
              )}
            </div>
          );
        },
        filterFn: (row, _, value) => {
          const ta = row.original;
          if (value.includes("all")) return true;
          if (value.includes("danger")) return ta.riskLevel === "danger";
          if (value.includes("warning")) return ta.riskLevel === "warning";
          if (value.includes("good")) return ta.riskLevel === "good";
          return true;
        },
        enableSorting: true,
      },

      // Actions column
      {
        id: "actions",
        header: "Action",
        cell: ({ row }) => {
          const ta = row.original;
          return (
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[10px]"
              onClick={() => onViewReport(ta.id)}
            >
              View
            </Button>
          );
        },
        enableSorting: false,
        enableHiding: false,
      },

      // Hidden columns for filtering
      {
        accessorKey: "personasTested",
        header: "Personas Tested",
        cell: () => null,
        enableSorting: false,
        enableHiding: true,
        enableColumnFilter: true,
        filterFn: (row, _, value) => {
          const ta = row.original;
          if (!value || value.length === 0) return true;
          return ta.personasTested.some((personaId) =>
            value.includes(personaId)
          );
        },
      },
      {
        accessorKey: "scenarioIds",
        header: "Scenario IDs",
        cell: () => null,
        enableSorting: false,
        enableHiding: true,
        enableColumnFilter: true,
        filterFn: (row, _, value) => {
          const ta = row.original;
          if (!value || value.length === 0) return true;
          return ta.scenarioIds.some((scenarioId) =>
            value.includes(scenarioId)
          );
        },
      },
      {
        accessorKey: "simulationIds",
        header: "Simulation IDs",
        cell: () => null,
        enableSorting: false,
        enableHiding: true,
        enableColumnFilter: true,
        filterFn: (row, _, value) => {
          const ta = row.original;
          if (!value || value.length === 0) return true;
          return ta.simulationIds.some((simulationId) =>
            value.includes(simulationId)
          );
        },
      },
    ];

    return reportColumns;
  }, [showExport, onViewReport]);

  return {
    columns,
    performanceOptions,
    cohortOptions,
    personaOptions,
    scenarioOptions,
    simulationOptions,
  };
}
