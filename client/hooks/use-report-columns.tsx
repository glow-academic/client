"use client";
import { DataTableColumnHeader } from "@/components/common/history/DataTableColumnHeader";
import { Checkbox } from "@/components/ui/checkbox";
import { useFilteredAnalyticsData } from "@/hooks/use-filtered-analytics-data";
import { getAllPersonas } from "@/utils/queries/personas/get-all-personas";
import { useQuery } from "@tanstack/react-query";
import { ColumnDef, Row, Table } from "@tanstack/react-table";
import { Clock, MessageCircle, Target, Timer } from "lucide-react";
import { useMemo } from "react";

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
  personaResponseTimes: number; // in seconds
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
  simulationMetrics?: Record<
    string,
    {
      averageScore: number;
      highestScore: number;
      completionPercentage: number;
      firstAttemptPassRate: number;
      timeSpent: number;
      messagesPerSession: number;
      sessionEfficiency: number;
      totalAttempts: number;
    }
  >;
  // Optional hover details provided by the server
  hover?:
    | {
        scoreStats?: {
          mean: number;
          median: number;
          mode: number;
          top?: number[];
        };
        timeStats?: {
          avgSessionMinutes: number;
          avgChatMinutes: number;
          avgOverallMinutes: number;
        };
        messageStats?: { mean: number; median: number; count: number };
        completionStats?: { completed: number; total: number; percent: number };
        firstAttemptStats?: { passed: number; total: number; percent: number };
        personaResponseStats?: {
          meanSeconds: number;
          medianSeconds: number;
          samples: number;
        };
        efficiencyStats?: {
          avgScorePercent: number;
          avgMinutes: number;
          efficiency: number;
        };
        stagnationStats?: {
          tracked: number;
          stagnant: number;
          ratePercent: number;
        };
      }
    | undefined;
}

export interface UseReportColumnsProps {
  showExport?: boolean;
  onViewReport: (profileId: string) => void;
  personaOptions?: { value: string; label: string }[];
  scenarioOptions?: { value: string; label: string }[];
  simulationOptions?: { value: string; label: string }[];
}

export function useReportColumns({
  showExport = true,
  onViewReport,
  personaOptions: personaOptArg = [],
  scenarioOptions: scenarioOptArg = [],
  simulationOptions: simulationOptArg = [],
}: UseReportColumnsProps) {
  const { data: filteredData, filters } = useFilteredAnalyticsData();
  const { data: personas } = useQuery({
    queryKey: ["personas"],
    queryFn: () => getAllPersonas(),
  });
  // Intentionally no local aliases of datasets; use filteredData within memos

  // Create filter options
  // Role filter is removed; role filtering is handled at a higher level
  const roleOptions: { value: string; label: string }[] = [];

  const cohortOptions = useMemo(() => {
    const source = filteredData?.cohorts ?? [];
    return source.map((cohort) => ({ value: cohort.id, label: cohort.title }));
  }, [filteredData?.cohorts]);

  const personaOptions = useMemo(() => {
    if (personaOptArg.length > 0) return personaOptArg;
    return (personas ?? [])
      .filter((persona) => persona.defaultPersona === true)
      .map((persona) => ({ value: persona.id, label: persona.name }));
  }, [personas, personaOptArg]);

  const scenarioOptions = useMemo(() => {
    if (scenarioOptArg.length > 0) return scenarioOptArg;
    const hasPractice = filters.simulationFilters.includes("practice");
    const source = filteredData?.scenarios ?? [];
    const filtered = source.filter((scenario) =>
      hasPractice ? true : !scenario.practiceScenario
    );
    return filtered.map((scenario) => ({
      value: scenario.id,
      label: scenario.name,
    }));
  }, [filteredData?.scenarios, filters.simulationFilters, scenarioOptArg]);

  const simulationOptions = useMemo(() => {
    if (simulationOptArg.length > 0) return simulationOptArg;
    const hasPractice = filters.simulationFilters.includes("practice");
    const source = filteredData?.simulations ?? [];
    const filtered = source.filter((simulation) =>
      hasPractice ? true : !simulation.practiceSimulation
    );
    return filtered.map((simulation) => ({
      value: simulation.id,
      label: simulation.title,
    }));
  }, [filteredData?.simulations, filters.simulationFilters, simulationOptArg]);

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
                  className="mr-2"
                  onClick={(e) => e.stopPropagation()}
                />
              ),
              cell: ({ row }: { row: Row<TAPerformanceData> }) => (
                <Checkbox
                  checked={row.getIsSelected()}
                  onCheckedChange={(value: boolean | "indeterminate") =>
                    row.toggleSelected(!!value)
                  }
                  aria-label="Select row"
                  className="mr-2"
                  onClick={(e) => e.stopPropagation()}
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
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Name" />
        ),
        cell: ({ row }) => {
          const ta = row.original;
          return (
            <div
              className="flex items-center space-x-1 cursor-pointer hover:text-primary hover:underline justify-start pl-1 py-0"
              onClick={() => onViewReport(ta.id)}
              title="Click to view detailed report"
            >
              <div className="flex flex-col items-start">
                <span className="text-xs font-medium">
                  {ta.firstName} {ta.lastName}
                </span>
                <span className="text-xs text-muted-foreground">
                  {ta.username}
                </span>
              </div>
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
            if (ta.personaResponseTimes <= 180) return "bg-green-50"; // 3 minutes in seconds
            if (ta.personaResponseTimes <= 300) return "bg-yellow-50"; // 5 minutes in seconds
            return "bg-red-50";
          };
          return (
            <div
              className={`text-center px-1 py-0.5 rounded text-xs font-medium flex items-center justify-center gap-0.5 ${getBackgroundColor()}`}
            >
              <Clock className="h-2.5 w-2.5" />
              {ta.hasNoSessions ? "N/A" : `${ta.personaResponseTimes}s`}
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
            if (ta.hasNoSessions) return "bg-gray-50";
            if (ta.totalAttempts >= 8) return "bg-green-50";
            if (ta.totalAttempts >= 5) return "bg-yellow-50";
            return "bg-red-50";
          };
          return (
            <div
              className={`text-center px-1 py-0.5 rounded text-xs font-medium flex items-center justify-center gap-0.5 ${getBackgroundColor()}`}
            >
              <Target className="h-2.5 w-2.5" />
              {ta.hasNoSessions ? "N/A" : ta.totalAttempts}
            </div>
          );
        },
        enableSorting: true,
      },

      // Hidden columns for filtering
      // Removed role column filter; handled by higher-level analytics filters
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
      // Cohort filter removed; handled at top-level analytics filters
    ];

    return reportColumns;
  }, [showExport, onViewReport]);

  return {
    columns,
    roleOptions,
    cohortOptions,
    personaOptions,
    scenarioOptions,
    simulationOptions,
  };
}
