/**
 * Reports.tsx
 * Reports table using comprehensive bare data type following fast/dumb UI principle
 */
"use client";
import { ColumnDef, Row, Table as TableType } from "@tanstack/react-table";
import { Clock, MessageCircle, Target, Timer } from "lucide-react";
import { useRouter } from "next/navigation";

import { DataTableColumnHeader } from "@/components/common/table/DataTableColumnHeader";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMemo } from "react";
import { ReportsDataTable } from "./ReportsDataTable";

type MappingItem = {
  name: string;
  description: string;
};

type ScenarioMapping = Record<string, MappingItem>;
type SimulationMapping = Record<string, MappingItem>;

// Complete reports data type - follows fast/dumb UI principle with inline hover data and thresholds
interface ReportsDataItem {
  // Core identifiers
  profile_id: string;
  profileName: string;
  profileAlias: string;
  scenario_id?: string; // Used for filter construction like history
  simulation_id?: string; // Used for filter construction like history

  // The 10 core metrics with pre-computed values, thresholds, and hover data
  averageScore: {
    value: number | null; // null for N/A values
    formattedValue: string;
    thresholds: { gray: number; red: number; yellow: number; green: number }; // 0-100 scale for color determination
    // Hover shows: Mean: X%, Median: Y%, Mode: Z%
    hover: {
      mean: number;
      median: number;
      mode: number;
    };
  };

  completionPercentage: {
    value: number | null; // null for N/A values
    formattedValue: string;
    thresholds: { gray: number; red: number; yellow: number; green: number }; // 0-100 scale for color determination
    // Hover shows: Completed: X/Y, Rate: Z%
    hover: {
      completed: number;
      total: number;
      percent: number;
    };
  };

  firstAttemptPassRate: {
    value: number | null; // null for N/A values
    formattedValue: string;
    thresholds: { gray: number; red: number; yellow: number; green: number }; // 0-100 scale for color determination
    // Hover shows: First-pass: X/Y, Rate: Z%
    hover: {
      passed: number;
      total: number;
      percent: number;
    };
  };

  highestScore: {
    value: number | null; // null for N/A values
    formattedValue: string;
    thresholds: { gray: number; red: number; yellow: number; green: number }; // 0-100 scale for color determination
    // Hover shows: 1. X%, 2. Y%, 3. Z% (top scores)
    hover: {
      top: number[]; // Shows top scores list
    };
  };

  messagesPerSession: {
    value: number | null; // null for N/A values
    formattedValue: string;
    thresholds: { gray: number; red: number; yellow: number; green: number }; // 0-100 scale for color determination
    // Hover shows: Mean msgs/chat: X, Median msgs/chat: Y, Chats counted: Z
    hover: {
      mean: number;
      median: number;
      count: number;
    };
  };

  personaResponseTimes: {
    value: number | null; // null for N/A values
    formattedValue: string;
    thresholds: { gray: number; red: number; yellow: number; green: number }; // 0-100 scale for color determination
    // Hover shows: Mean: Xs, Median: Ys, Samples: Z
    hover: {
      meanSeconds: number;
      medianSeconds: number;
      samples: number;
    };
  };

  sessionEfficiency: {
    value: number | null; // null for N/A values
    formattedValue: string;
    thresholds: { gray: number; red: number; yellow: number; green: number }; // 0-100 scale for color determination
    // Hover shows: Avg score: X%, Avg time: Ym, Efficiency: Z
    hover: {
      avgScorePercent: number;
      avgMinutes: number;
      efficiency: number;
    };
  };

  stagnationRate: {
    value: number | null; // null for N/A values
    formattedValue: string;
    thresholds: { gray: number; red: number; yellow: number; green: number }; // 0-100 scale for color determination
    // Hover shows: Tracked: X, Stagnant: Y, Rate: Z%
    hover: {
      tracked: number;
      stagnant: number;
      ratePercent: number;
    };
  };

  timeSpent: {
    value: number | null; // null for N/A values
    formattedValue: string;
    thresholds: { gray: number; red: number; yellow: number; green: number }; // 0-100 scale for color determination
    // Hover shows: Avg session: Xm, Avg chat: Ym, Avg time spent: Zm
    hover: {
      avgSessionMinutes: number;
      avgChatMinutes: number;
      avgOverallMinutes: number;
    };
  };

  totalAttempts: {
    value: number | null; // null for N/A values
    formattedValue: string;
    thresholds: { gray: number; red: number; yellow: number; green: number }; // 0-100 scale for color determination
    // Hover shows: Attempts: X, Unique sims: Y, Mean/Sim: Z
    // Note: totalAttempts hover is computed from the main data, not stored separately
  };
}

interface ReportsInterface {
  data: ReportsDataItem[];
  scenarioMapping: ScenarioMapping;
  simulationMapping: SimulationMapping;
}

export default function Reports({
  data,
  scenarioMapping,
  simulationMapping,
}: ReportsInterface) {
  const router = useRouter();

  const handleViewReport = (profileId: string) => {
    router.push(`/analytics/reports/p/${profileId}`);
  };

  // Build scenario options from mapping
  const scenarioOptions = useMemo(
    () =>
      Object.entries(scenarioMapping).map(([id, scenario]) => ({
        value: id,
        label: scenario.name,
      })),
    [scenarioMapping],
  );

  // Build simulation options from mapping
  const simulationOptions = useMemo(
    () =>
      Object.entries(simulationMapping).map(([id, simulation]) => ({
        value: id,
        label: simulation.name,
      })),
    [simulationMapping],
  );

  // Build simulations array for ReportsDataTable
  const simulations = useMemo(
    () =>
      Object.entries(simulationMapping).map(([id, simulation]) => ({
        id,
        title: simulation.name,
      })),
    [simulationMapping],
  );

  // Create comprehensive columns matching useReportColumns pattern
  const columns: ColumnDef<ReportsDataItem>[] = [
    // Select column - only show if showExport is true
    ...(true
      ? [
          {
            id: "select",
            header: ({ table }: { table: TableType<ReportsDataItem> }) => (
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
            cell: ({ row }: { row: Row<ReportsDataItem> }) => (
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

    // Name column
    {
      accessorKey: "profileName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div
            className="flex items-center space-x-1 cursor-pointer hover:text-primary hover:underline justify-start pl-1 py-0"
            onClick={() => handleViewReport(item.profile_id)}
            title="Click to view detailed report"
            data-testid={`reports-profile-row-${item.profile_id}`}
          >
            <div className="flex flex-col items-start">
              <span className="text-xs font-medium">{item.profileName}</span>
              <span className="text-xs text-muted-foreground">
                {item.profileAlias}
              </span>
            </div>
          </div>
        );
      },
      enableSorting: true,
    },

    // Average Score column
    {
      id: "averageScore",
      accessorFn: (row) => row.averageScore.value,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Avg Score" />
      ),
      cell: ({ row }) => {
        const item = row.original;
        const v = item.averageScore.value;
        const getBackgroundColor = () => {
          if (v == null) return "bg-gray-50";
          if (v >= 85) return "bg-green-50";
          if (v >= 75) return "bg-yellow-50";
          return "bg-red-50";
        };
        return (
          <div
            className={`text-center px-1 py-0.5 rounded text-xs font-medium ${getBackgroundColor()}`}
          >
            {item.averageScore.formattedValue}
          </div>
        );
      },
      enableSorting: true,
    },

    // Highest Score column
    {
      id: "highestScore",
      accessorFn: (row) => row.highestScore.value,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Highest" />
      ),
      cell: ({ row }) => {
        const item = row.original;
        const v = item.highestScore.value;
        const getBackgroundColor = () => {
          if (v == null) return "bg-gray-50";
          if (v >= 90) return "bg-green-50";
          if (v >= 80) return "bg-yellow-50";
          return "bg-red-50";
        };
        return (
          <div
            className={`text-center px-1 py-0.5 rounded text-xs font-medium ${getBackgroundColor()}`}
          >
            {item.highestScore.formattedValue}
          </div>
        );
      },
      enableSorting: true,
    },

    // Completion Percentage column
    {
      id: "completionPercentage",
      accessorFn: (row) => row.completionPercentage.value,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Completion" />
      ),
      cell: ({ row }) => {
        const item = row.original;
        const v = item.completionPercentage.value;
        const getBackgroundColor = () => {
          if (v == null) return "bg-gray-50";
          if (v >= 85) return "bg-green-50";
          if (v >= 75) return "bg-yellow-50";
          return "bg-red-50";
        };
        return (
          <div
            className={`text-center px-1 py-0.5 rounded text-xs font-medium ${getBackgroundColor()}`}
          >
            {item.completionPercentage.formattedValue}
          </div>
        );
      },
      enableSorting: true,
    },

    // First Attempt Pass Rate column
    {
      id: "firstAttemptPassRate",
      accessorFn: (row) => row.firstAttemptPassRate.value,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="First Pass" />
      ),
      cell: ({ row }) => {
        const item = row.original;
        const v = item.firstAttemptPassRate.value;
        const getBackgroundColor = () => {
          if (v == null) return "bg-gray-50";
          if (v >= 85) return "bg-green-50";
          if (v >= 75) return "bg-yellow-50";
          return "bg-red-50";
        };
        return (
          <div
            className={`text-center px-1 py-0.5 rounded text-xs font-medium ${getBackgroundColor()}`}
          >
            {item.firstAttemptPassRate.formattedValue}
          </div>
        );
      },
      enableSorting: true,
    },

    // Messages Per Session column
    {
      id: "messagesPerSession",
      accessorFn: (row) => row.messagesPerSession.value,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Msgs/Sess" />
      ),
      cell: ({ row }) => {
        const item = row.original;
        const v = item.messagesPerSession.value;
        const getBackgroundColor = () => {
          if (v == null) return "bg-gray-50";
          if (v >= 12) return "bg-green-50";
          if (v >= 8) return "bg-yellow-50";
          return "bg-red-50";
        };
        return (
          <div
            className={`text-center px-1 py-0.5 rounded text-xs font-medium flex items-center justify-center gap-0.5 ${getBackgroundColor()}`}
          >
            <MessageCircle className="h-2.5 w-2.5" />
            {item.messagesPerSession.formattedValue}
          </div>
        );
      },
      enableSorting: true,
    },

    // Persona Response Times column
    {
      id: "personaResponseTimes",
      accessorFn: (row) => row.personaResponseTimes.value,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Response Time" />
      ),
      cell: ({ row }) => {
        const item = row.original;
        const v = item.personaResponseTimes.value;
        const getBackgroundColor = () => {
          if (v == null) return "bg-gray-50";
          if (v <= 180) return "bg-green-50"; // 3 minutes in seconds
          if (v <= 300) return "bg-yellow-50"; // 5 minutes in seconds
          return "bg-red-50";
        };
        return (
          <div
            className={`text-center px-1 py-0.5 rounded text-xs font-medium flex items-center justify-center gap-0.5 ${getBackgroundColor()}`}
          >
            <Clock className="h-2.5 w-2.5" />
            {item.personaResponseTimes.formattedValue}
          </div>
        );
      },
      enableSorting: true,
    },

    // Session Efficiency column
    {
      id: "sessionEfficiency",
      accessorFn: (row) => row.sessionEfficiency.value,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Efficiency" />
      ),
      cell: ({ row }) => {
        const item = row.original;
        const v = item.sessionEfficiency.value;
        const getBackgroundColor = () => {
          if (v == null) return "bg-gray-50";
          if (v >= 85) return "bg-green-50";
          if (v >= 75) return "bg-yellow-50";
          return "bg-red-50";
        };
        return (
          <div
            className={`text-center px-1 py-0.5 rounded text-xs font-medium ${getBackgroundColor()}`}
          >
            {item.sessionEfficiency.formattedValue}
          </div>
        );
      },
      enableSorting: true,
    },

    // Stagnation Rate column
    {
      id: "stagnationRate",
      accessorFn: (row) => row.stagnationRate.value,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Stagnation" />
      ),
      cell: ({ row }) => {
        const item = row.original;
        const v = item.stagnationRate.value;
        const getBackgroundColor = () => {
          if (v == null) return "bg-gray-50";
          if (v <= 15) return "bg-green-50";
          if (v <= 25) return "bg-yellow-50";
          return "bg-red-50";
        };
        return (
          <div
            className={`text-center px-1 py-0.5 rounded text-xs font-medium ${getBackgroundColor()}`}
          >
            {item.stagnationRate.formattedValue}
          </div>
        );
      },
      enableSorting: true,
    },

    // Time Spent column
    {
      id: "timeSpent",
      accessorFn: (row) => row.timeSpent.value,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Time Spent" />
      ),
      cell: ({ row }) => {
        const item = row.original;
        const v = item.timeSpent.value;
        const getBackgroundColor = () => {
          if (v == null) return "bg-gray-50";
          if (v <= 60) return "bg-green-50";
          if (v <= 90) return "bg-yellow-50";
          return "bg-red-50";
        };
        return (
          <div
            className={`text-center px-1 py-0.5 rounded text-xs font-medium flex items-center justify-center gap-0.5 ${getBackgroundColor()}`}
          >
            <Timer className="h-2.5 w-2.5" />
            {item.timeSpent.formattedValue}
          </div>
        );
      },
      enableSorting: true,
    },

    // Total Attempts column
    {
      id: "totalAttempts",
      accessorFn: (row) => row.totalAttempts.value,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Attempts" />
      ),
      cell: ({ row }) => {
        const item = row.original;
        const v = item.totalAttempts.value;
        const getBackgroundColor = () => {
          if (v == null) return "bg-gray-50";
          if (v >= 8) return "bg-green-50";
          if (v >= 5) return "bg-yellow-50";
          return "bg-red-50";
        };
        return (
          <div
            className={`text-center px-1 py-0.5 rounded text-xs font-medium flex items-center justify-center gap-0.5 ${getBackgroundColor()}`}
          >
            <Target className="h-2.5 w-2.5" />
            {item.totalAttempts.formattedValue}
          </div>
        );
      },
      enableSorting: true,
    },

    // Hidden columns for filtering
    {
      accessorKey: "scenario_id",
      header: "Scenario ID",
      cell: () => null,
      enableSorting: false,
      enableHiding: false,
      enableColumnFilter: true,
      filterFn: (row, _, value) => {
        const item = row.original;
        if (!value || value.length === 0) return true;
        return item.scenario_id ? value.includes(item.scenario_id) : false;
      },
    },
    {
      accessorKey: "simulation_id",
      header: "Simulation ID",
      cell: () => null,
      enableSorting: false,
      enableHiding: false,
      enableColumnFilter: true,
      filterFn: (row, _, value) => {
        const item = row.original;
        if (!value || value.length === 0) return true;
        return item.simulation_id ? value.includes(item.simulation_id) : false;
      },
    },
  ];

  return (
    <div className="space-y-6" data-testid="reports-table-container">
      <ReportsDataTable
        columns={columns}
        data={data}
        scenarioOptions={scenarioOptions}
        simulationOptions={simulationOptions}
        simulations={simulations}
        showExport={true}
        onViewReport={handleViewReport}
      />
    </div>
  );
}

export function ReportsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        {/* Toolbar skeleton */}
        <div className="flex items-center justify-between">
          <div className="flex flex-1 items-center space-x-2 flex-wrap">
            <div className="mb-2">
              {/* Search input */}
              <Skeleton className="h-8 w-[150px] lg:w-[250px]" />
            </div>

            <div className="flex items-center space-x-2 flex-wrap mb-2">
              {/* Filter buttons - many filters for reports */}
              <Skeleton className="h-8 w-[120px]" />
              <Skeleton className="h-8 w-[120px]" />
              <Skeleton className="h-8 w-[100px]" />
            </div>
          </div>

          <div className="flex items-center space-x-2 mb-2">
            {/* Export button */}
            <Skeleton className="h-8 w-24" />
            {/* Column visibility */}
            <Skeleton className="h-8 w-8" />
          </div>
        </div>

        {/* Table skeleton */}
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="h-8">
                <TableHead className="w-12">
                  <Skeleton className="h-4 w-4" />
                </TableHead>
                <TableHead>
                  <Skeleton className="h-4 w-24" />
                </TableHead>
                <TableHead>
                  <Skeleton className="h-4 w-28" />
                </TableHead>
                <TableHead>
                  <Skeleton className="h-4 w-28" />
                </TableHead>
                <TableHead>
                  <Skeleton className="h-4 w-32" />
                </TableHead>
                <TableHead>
                  <Skeleton className="h-4 w-28" />
                </TableHead>
                <TableHead>
                  <Skeleton className="h-4 w-32" />
                </TableHead>
                <TableHead>
                  <Skeleton className="h-4 w-28" />
                </TableHead>
                <TableHead>
                  <Skeleton className="h-4 w-32" />
                </TableHead>
                <TableHead>
                  <Skeleton className="h-4 w-28" />
                </TableHead>
                <TableHead>
                  <Skeleton className="h-4 w-32" />
                </TableHead>
                <TableHead>
                  <Skeleton className="h-4 w-28" />
                </TableHead>
                <TableHead>
                  <Skeleton className="h-4 w-24" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(10)].map((_, i) => (
                <TableRow key={i} className="h-6">
                  <TableCell className="w-12 text-center">
                    <Skeleton className="h-4 w-4" />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell className="text-center">
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell className="text-center">
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell className="text-center">
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell className="text-center">
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell className="text-center">
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell className="text-center">
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell className="text-center">
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell className="text-center">
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell className="text-center">
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell className="text-center">
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
