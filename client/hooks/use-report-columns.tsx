"use client";
import { DataTableColumnHeader } from "@/components/common/history/DataTableColumnHeader";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery } from "@tanstack/react-query";
import { ColumnDef, Row, Table } from "@tanstack/react-table";
import {
  Clock,
  ExternalLink,
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
  role: string;
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
        value: "high",
        label: "High Performers (≥85%)",
      },
      {
        value: "medium",
        label: "Medium Performers (75-84%)",
      },
      {
        value: "low",
        label: "Low Performers (<75%)",
      },
    ],
    []
  );

  const roleOptions = useMemo(
    () => [
      {
        value: "ta",
        label: "Teaching Assistant",
      },
      {
        value: "instructor",
        label: "Instructor",
      },
      {
        value: "admin",
        label: "Administrator",
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

      // Name column with risk indicator
      {
        accessorKey: "firstName",
        header: "Name",
        cell: ({ row }) => {
          const ta = row.original;
          return (
            <div
              className="flex items-center space-x-2 cursor-pointer hover:text-primary hover:underline justify-start pl-2 py-0"
              onClick={() => onViewReport(ta.id)}
              title="Click to view detailed report"
            >
              <div className="flex flex-col items-start">
                <span className="text-sm font-medium">
                  {ta.firstName} {ta.lastName}
                </span>
                <span className="text-xs text-muted-foreground">
                  {ta.username}
                </span>
              </div>
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
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
          const getBackgroundColor = () => {
            if (ta.hasNoSessions) return "bg-gray-50";
            if (ta.averageScore >= 85) return "bg-green-50";
            if (ta.averageScore >= 75) return "bg-yellow-50";
            return "bg-red-50";
          };
          return (
            <div
              className={`text-center px-1 py-0.5 rounded text-xs font-medium ${getBackgroundColor()}`}
            >
              {ta.hasNoSessions ? "N/A" : `${ta.averageScore}%`}
            </div>
          );
        },
        filterFn: (row, _, value) => {
          const ta = row.original;
          if (value.includes("all")) return true;
          if (value.includes("high")) return ta.averageScore >= 85;
          if (value.includes("medium"))
            return ta.averageScore >= 75 && ta.averageScore < 85;
          if (value.includes("low")) return ta.averageScore < 75;
          return true;
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
          const getBackgroundColor = () => {
            if (ta.hasNoSessions) return "bg-gray-50";
            if (ta.completionPercentage >= 85) return "bg-green-50";
            if (ta.completionPercentage >= 75) return "bg-yellow-50";
            return "bg-red-50";
          };
          return (
            <div
              className={`text-center px-1 py-0.5 rounded text-xs font-medium ${getBackgroundColor()}`}
            >
              {ta.hasNoSessions ? "N/A" : `${ta.completionPercentage}%`}
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
          const getBackgroundColor = () => {
            if (ta.hasNoSessions) return "bg-gray-50";
            if (ta.firstAttemptPassRate >= 85) return "bg-green-50";
            if (ta.firstAttemptPassRate >= 75) return "bg-yellow-50";
            return "bg-red-50";
          };
          return (
            <div
              className={`text-center px-1 py-0.5 rounded text-xs font-medium ${getBackgroundColor()}`}
            >
              {ta.hasNoSessions ? "N/A" : `${ta.firstAttemptPassRate}%`}
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
          const getBackgroundColor = () => {
            if (ta.hasNoSessions) return "bg-gray-50";
            if (ta.highestScore >= 90) return "bg-green-50";
            if (ta.highestScore >= 80) return "bg-yellow-50";
            return "bg-red-50";
          };
          return (
            <div
              className={`text-center px-1 py-0.5 rounded text-xs font-medium ${getBackgroundColor()}`}
            >
              {ta.hasNoSessions ? "N/A" : `${ta.highestScore}%`}
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
          const getBackgroundColor = () => {
            if (ta.hasNoSessions) return "bg-gray-50";
            if (ta.messagesPerSession >= 12) return "bg-green-50";
            if (ta.messagesPerSession >= 8) return "bg-yellow-50";
            return "bg-red-50";
          };
          return (
            <div
              className={`text-center px-1 py-0.5 rounded text-xs font-medium flex items-center justify-center gap-0.5 ${getBackgroundColor()}`}
            >
              <MessageCircle className="h-2.5 w-2.5" />
              {ta.hasNoSessions ? "N/A" : ta.messagesPerSession}
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
          const getBackgroundColor = () => {
            if (ta.hasNoSessions) return "bg-gray-50";
            if (ta.personaResponseTimes <= 3) return "bg-green-50";
            if (ta.personaResponseTimes <= 5) return "bg-yellow-50";
            return "bg-red-50";
          };
          return (
            <div
              className={`text-center px-1 py-0.5 rounded text-xs font-medium flex items-center justify-center gap-0.5 ${getBackgroundColor()}`}
            >
              <Clock className="h-2.5 w-2.5" />
              {ta.hasNoSessions ? "N/A" : `${ta.personaResponseTimes}m`}
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
          const getBackgroundColor = () => {
            if (ta.hasNoSessions) return "bg-gray-50";
            if (ta.sessionEfficiency >= 85) return "bg-green-50";
            if (ta.sessionEfficiency >= 75) return "bg-yellow-50";
            return "bg-red-50";
          };
          return (
            <div
              className={`text-center px-1 py-0.5 rounded text-xs font-medium ${getBackgroundColor()}`}
            >
              {ta.hasNoSessions ? "N/A" : `${ta.sessionEfficiency}%`}
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
          const getBackgroundColor = () => {
            if (ta.hasNoSessions) return "bg-gray-50";
            if (ta.stagnationRate <= 15) return "bg-green-50";
            if (ta.stagnationRate <= 25) return "bg-yellow-50";
            return "bg-red-50";
          };
          return (
            <div
              className={`text-center px-1 py-0.5 rounded text-xs font-medium ${getBackgroundColor()}`}
            >
              {ta.hasNoSessions ? "N/A" : `${ta.stagnationRate}%`}
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
          const getBackgroundColor = () => {
            if (ta.hasNoSessions) return "bg-gray-50";
            if (ta.timeSpent <= 60) return "bg-green-50";
            if (ta.timeSpent <= 90) return "bg-yellow-50";
            return "bg-red-50";
          };
          return (
            <div
              className={`text-center px-1 py-0.5 rounded text-xs font-medium flex items-center justify-center gap-0.5 ${getBackgroundColor()}`}
            >
              <Timer className="h-2.5 w-2.5" />
              {ta.hasNoSessions ? "N/A" : `${ta.timeSpent}m`}
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
          const getBackgroundColor = () => {
            if (ta.totalAttempts >= 8) return "bg-green-50";
            if (ta.totalAttempts >= 5) return "bg-yellow-50";
            return "bg-red-50";
          };
          return (
            <div
              className={`text-center px-1 py-0.5 rounded text-xs font-medium flex items-center justify-center gap-0.5 ${getBackgroundColor()}`}
            >
              <Target className="h-2.5 w-2.5" />
              {ta.totalAttempts}
            </div>
          );
        },
        enableSorting: true,
      },

      // Hidden columns for filtering
      {
        accessorKey: "role",
        header: "Role",
        cell: () => null,
        enableSorting: false,
        enableHiding: false,
        enableColumnFilter: true,
        filterFn: (row, _, value) => {
          const ta = row.original;
          if (!value || value.length === 0) return true;
          return value.includes(ta.role);
        },
      },
      {
        accessorKey: "personasTested",
        header: "Personas Tested",
        cell: () => null,
        enableSorting: false,
        enableHiding: false,
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
        enableHiding: false,
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
        enableHiding: false,
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
    roleOptions,
    cohortOptions,
    personaOptions,
    scenarioOptions,
    simulationOptions,
  };
}
