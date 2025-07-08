"use client";
import { DataTableColumnHeader } from "@/components/common/history/data-table-column-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery } from "@tanstack/react-query";
import { ColumnDef, Row, Table } from "@tanstack/react-table";
import {
  AlertTriangle,
  ArrowUp,
  Clock,
  MessageCircle,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import { useMemo } from "react";

import { getAllAgents } from "@/utils/queries/agents/get-all-agents";
import { getAllClasses } from "@/utils/queries/classes/get-all-classes";
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";

// Enhanced types for the TA performance data
export interface TAPerformanceData {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
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
  messagesPerSession: number;
  totalAttempts: number;
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
}

export function useReportsColumns({
  showExport = true,
  onViewReport,
}: {
  showExport?: boolean;
  onViewReport: (profileId: string) => void;
}) {
  // Fetch data for filter options
  const { data: _profiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getAllProfiles(),
  });

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: () => getAllClasses(),
  });

  const { data: cohorts } = useQuery({
    queryKey: ["cohorts"],
    queryFn: () => getAllCohorts(),
  });

  const { data: agents } = useQuery({
    queryKey: ["agents"],
    queryFn: () => getAllAgents(),
  });

  // Create filter options
  const performanceOptions = useMemo(
    () => [
      {
        value: "all",
        label: "All TAs",
      },
      {
        value: "struggling",
        label: "Struggling",
      },
      {
        value: "performing-well",
        label: "Performing Well",
      },
    ],
    []
  );

  const classOptions = useMemo(() => {
    if (!classes) return [];
    return classes.map((classItem) => ({
      value: classItem.id,
      label: classItem.name,
    }));
  }, [classes]);

  const cohortOptions = useMemo(() => {
    if (!cohorts) return [];
    return cohorts.map((cohort) => ({
      value: cohort.id,
      label: cohort.title,
    }));
  }, [cohorts]);

  const agentOptions = useMemo(() => {
    if (!agents) return [];
    return agents.map((agent) => ({
      value: agent.id,
      label: agent.name,
    }));
  }, [agents]);

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
      // Rank column
      {
        accessorKey: "rank",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="#" />
        ),
        cell: ({ row }) => {
          const index = row.index;
          return (
            <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary font-bold text-[10px]">
              {index + 1}
            </div>
          );
        },
        enableSorting: false,
        enableHiding: false,
      },
      // Name column
      {
        accessorKey: "firstName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Name" />
        ),
        cell: ({ row }) => {
          const ta = row.original;
          return (
            <div className="flex items-center gap-1">
              <div
                className="font-medium text-xs cursor-pointer hover:text-primary hover:underline truncate"
                onClick={() => onViewReport(ta.id)}
                title={`${ta.firstName} ${ta.lastName}`}
              >
                {ta.firstName} {ta.lastName}
              </div>
              {ta.isStruggling && (
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
              className="text-xs text-muted-foreground truncate"
              title={ta.username}
            >
              {ta.username}
            </div>
          );
        },
        enableSorting: true,
      },
      // Score column
      {
        accessorKey: "avgScore",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Score" />
        ),
        cell: ({ row }) => {
          const ta = row.original;
          return (
            <div className="text-center">
              <Badge
                variant={
                  ta.avgScore >= 80
                    ? "default"
                    : ta.avgScore >= 70
                      ? "secondary"
                      : "destructive"
                }
                className="text-[10px] font-medium px-1 py-0 h-4"
              >
                {ta.hasNoSessions ? "N/A" : `${ta.avgScore}%`}
              </Badge>
            </div>
          );
        },
        filterFn: (row, _, value) => {
          const ta = row.original;
          if (value.includes("all")) return true;
          if (value.includes("struggling")) return ta.isStruggling;
          if (value.includes("performing-well")) return !ta.isStruggling;
          return true;
        },
        enableSorting: true,
      },
      // Sessions column
      {
        accessorKey: "totalSessions",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Sessions" />
        ),
        cell: ({ row }) => {
          const ta = row.original;
          return (
            <div className="text-center">
              <div className="text-[10px] font-medium">
                {ta.completedSessions}/{ta.totalSessions}
              </div>
            </div>
          );
        },
        enableSorting: true,
      },
      // Pass Rate column
      {
        accessorKey: "passRate",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Pass" />
        ),
        cell: ({ row }) => {
          const ta = row.original;
          return (
            <div className="text-center">
              <div className="text-[10px] font-medium">
                {ta.hasNoSessions ? "N/A" : `${ta.passRate}%`}
              </div>
            </div>
          );
        },
        enableSorting: true,
      },
      // Avg Time column
      {
        accessorKey: "avgTimeMinutes",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Time" />
        ),
        cell: ({ row }) => {
          const ta = row.original;
          return (
            <div className="text-center">
              <div className="text-[10px] font-medium">
                {ta.hasNoSessions ? "N/A" : `${ta.avgTimeMinutes}m`}
              </div>
            </div>
          );
        },
        enableSorting: true,
      },
      // Completion Rate column
      {
        accessorKey: "completionRate",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Complete" />
        ),
        cell: ({ row }) => {
          const ta = row.original;
          return (
            <div className="text-center">
              <div className="text-[10px] font-medium">
                {ta.completionRate}%
              </div>
            </div>
          );
        },
        enableSorting: true,
      },
      // Trend column
      {
        accessorKey: "trend",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Trend" />
        ),
        cell: ({ row }) => {
          const ta = row.original;
          return (
            <div className="text-center">
              {ta.trend === "improving" ? (
                <div className="flex items-center justify-center text-green-600">
                  <TrendingUp className="h-2.5 w-2.5" />
                </div>
              ) : ta.trend === "declining" ? (
                <div className="flex items-center justify-center text-red-600">
                  <TrendingDown className="h-2.5 w-2.5" />
                </div>
              ) : (
                <div className="flex items-center justify-center text-gray-600">
                  <ArrowUp className="h-2.5 w-2.5 rotate-90" />
                </div>
              )}
            </div>
          );
        },
        enableSorting: true,
      },
      // Last Activity column
      {
        accessorKey: "lastActivity",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Last Activity" />
        ),
        cell: ({ row }) => {
          const ta = row.original;
          return (
            <div className="text-center">
              <div className="text-[10px] font-medium flex items-center justify-center gap-0.5">
                <Clock className="h-2.5 w-2.5" />
                <span className="truncate">
                  {ta.lastActivity
                    ? new Date(ta.lastActivity).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })
                    : "Never"}
                </span>
              </div>
            </div>
          );
        },
        enableSorting: true,
      },
      // Scenarios Completed column
      {
        accessorKey: "scenariosCompleted",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Scenarios" />
        ),
        cell: ({ row }) => {
          const ta = row.original;
          return (
            <div className="text-center">
              <div className="text-[10px] font-medium flex items-center justify-center gap-0.5">
                <Target className="h-2.5 w-2.5" />
                {ta.scenariosCompleted}
              </div>
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
      // Total Attempts column
      {
        accessorKey: "totalAttempts",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Total Attempts" />
        ),
        cell: ({ row }) => {
          const ta = row.original;
          return (
            <div className="text-center">
              <div className="text-[10px] font-medium">{ta.totalAttempts}</div>
            </div>
          );
        },
        enableSorting: true,
      },
      // Cohorts column
      {
        accessorKey: "taCohorts",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Cohorts" />
        ),
        cell: ({ row }) => {
          const ta = row.original;
          return (
            <div className="text-center">
              <div className="text-[10px] font-medium flex items-center justify-center gap-0.5">
                <Users className="h-2.5 w-2.5" />
                <span title={ta.taCohorts.join(", ")}>
                  {ta.taCohorts.length}
                </span>
              </div>
            </div>
          );
        },
        filterFn: (row, _, value) => {
          const ta = row.original;
          if (!value || value.length === 0) return true;
          return ta.cohortComparison.some((comparison) =>
            value.includes(comparison.cohortId)
          );
        },
        enableSorting: true,
      },
      // Cohort Rank column
      {
        accessorKey: "bestCohortRank",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Cohort Rank" />
        ),
        cell: ({ row }) => {
          const ta = row.original;
          return (
            <div className="text-center">
              <div className="text-[10px] font-medium flex items-center justify-center gap-0.5">
                <Trophy className="h-2.5 w-2.5" />
                {ta.bestCohortRank > 0 ? `#${ta.bestCohortRank}` : "N/A"}
              </div>
            </div>
          );
        },
        enableSorting: true,
      },
      // Avg vs Cohort column
      {
        accessorKey: "avgVsCohort",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="vs Cohort" />
        ),
        cell: ({ row }) => {
          const ta = row.original;
          return (
            <div className="text-center">
              <div
                className={`text-[10px] font-medium ${
                  ta.avgVsCohort > 0
                    ? "text-green-600"
                    : ta.avgVsCohort < 0
                      ? "text-red-600"
                      : "text-gray-600"
                }`}
              >
                {ta.avgVsCohort > 0 ? "+" : ""}
                {ta.avgVsCohort}%
              </div>
            </div>
          );
        },
        enableSorting: true,
      },
      // Status column
      {
        accessorKey: "isStruggling",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
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
                  None
                </Badge>
              ) : ta.isStruggling ? (
                <Badge
                  variant="secondary"
                  className="text-[10px] bg-orange-100 text-orange-800 px-1 py-0 h-4"
                >
                  Risk
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
    ];

    return reportColumns;
  }, [showExport, onViewReport]);

  return {
    columns,
    performanceOptions,
    classOptions,
    cohortOptions,
    agentOptions,
  };
}
