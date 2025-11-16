"use client";

import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import * as React from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { DataTablePagination } from "@/components/common/table/DataTablePagination";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { ReportsDataTableToolbar } from "./ReportsDataTableToolbar";

// Import ReportsDataItem from Reports.tsx
interface ReportsDataItem {
  // Core identifiers
  profile_id: string;
  profileName: string;
  profileAlias: string;
  scenario_id?: string;
  simulation_id?: string;

  // The 10 core metrics with pre-computed values, thresholds, and hover data
  averageScore: {
    value: number | null; // null for N/A values
    formattedValue: string;
    thresholds: { gray: number; red: number; yellow: number; green: number };
    hover: {
      mean: number;
      median: number;
      mode: number;
    };
  };

  completionPercentage: {
    value: number | null; // null for N/A values
    formattedValue: string;
    thresholds: { gray: number; red: number; yellow: number; green: number };
    hover: {
      completed: number;
      total: number;
      percent: number;
    };
  };

  firstAttemptPassRate: {
    value: number | null; // null for N/A values
    formattedValue: string;
    thresholds: { gray: number; red: number; yellow: number; green: number };
    hover: {
      passed: number;
      total: number;
      percent: number;
    };
  };

  highestScore: {
    value: number | null; // null for N/A values
    formattedValue: string;
    thresholds: { gray: number; red: number; yellow: number; green: number };
    hover: {
      top: number[];
    };
  };

  messagesPerSession: {
    value: number | null; // null for N/A values
    formattedValue: string;
    thresholds: { gray: number; red: number; yellow: number; green: number };
    hover: {
      mean: number;
      median: number;
      count: number;
    };
  };

  personaResponseTimes: {
    value: number | null; // null for N/A values
    formattedValue: string;
    thresholds: { gray: number; red: number; yellow: number; green: number };
    hover: {
      meanSeconds: number;
      medianSeconds: number;
      samples: number;
    };
  };

  sessionEfficiency: {
    value: number | null; // null for N/A values
    formattedValue: string;
    thresholds: { gray: number; red: number; yellow: number; green: number };
    hover: {
      avgScorePercent: number;
      avgMinutes: number;
      efficiency: number;
    };
  };

  stagnationRate: {
    value: number | null; // null for N/A values
    formattedValue: string;
    thresholds: { gray: number; red: number; yellow: number; green: number };
    hover: {
      tracked: number;
      stagnant: number;
      ratePercent: number;
    };
  };

  timeSpent: {
    value: number | null; // null for N/A values
    formattedValue: string;
    thresholds: { gray: number; red: number; yellow: number; green: number };
    hover: {
      avgSessionMinutes: number;
      avgChatMinutes: number;
      avgOverallMinutes: number;
    };
  };

  totalAttempts: {
    value: number | null; // null for N/A values
    formattedValue: string;
    thresholds: { gray: number; red: number; yellow: number; green: number };
  };
}

export interface ReportsDataTableProps {
  columns: ColumnDef<ReportsDataItem>[];
  data: ReportsDataItem[];
  profileOptions: { value: string; label: string }[];
  scenarioOptions: { value: string; label: string }[];
  simulationOptions: { value: string; label: string }[];
  simulations: Array<{ id: string; title: string }>;
  showExport?: boolean;
  onViewReport: (profileId: string) => void;
}

export function ReportsDataTable({
  columns,
  data,
  profileOptions,
  scenarioOptions,
  simulationOptions,
  simulations,
  showExport = true,
  onViewReport,
}: ReportsDataTableProps) {
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({
      personasTested: false,
      scenarioIds: false,
      simulationIds: false,
      taCohortIds: false,
      personaResponseTimes: false,
      stagnationRate: false,
      profileId: false,
      scenarios: false,
      simulations: false,
    });
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "averageScore", desc: true }, // Default sort by score descending
  ]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    initialState: {
      pagination: {
        pageSize: 100,
      },
    },
  });

  const renderWithHover = (
    key: string,
    content: React.ReactNode,
    profileId: string
  ) => {
    const item = data.find((d) => d.profile_id === profileId);
    let bullets: string[] = [];

    if (key === "averageScore" && item?.averageScore?.hover) {
      const h = item.averageScore.hover;
      bullets = [
        `Mean: ${h.mean}%`,
        `Median: ${h.median}%`,
        `Mode: ${h.mode}%`,
      ];
    } else if (key === "highestScore" && item?.highestScore?.hover) {
      const h = item.highestScore.hover;
      bullets = h.top.length
        ? h.top.map((v, i) => `${i + 1}. ${v}%`)
        : ["No scores available"];
    } else if (key === "timeSpent" && item?.timeSpent?.hover) {
      const h = item.timeSpent.hover;
      bullets = [
        `Avg session: ${h.avgSessionMinutes}m`,
        `Avg chat: ${h.avgChatMinutes}m`,
        `Avg time spent: ${h.avgOverallMinutes}m`,
      ];
    } else if (
      key === "messagesPerSession" &&
      item?.messagesPerSession?.hover
    ) {
      const h = item.messagesPerSession.hover;
      bullets = [
        `Mean msgs/chat: ${h.mean}`,
        `Median msgs/chat: ${h.median}`,
        `Chats counted: ${h.count}`,
      ];
    } else if (
      key === "completionPercentage" &&
      item?.completionPercentage?.hover
    ) {
      const h = item.completionPercentage.hover;
      bullets = [`Completed: ${h.completed}/${h.total}`, `Rate: ${h.percent}%`];
    } else if (
      key === "firstAttemptPassRate" &&
      item?.firstAttemptPassRate?.hover
    ) {
      const h = item.firstAttemptPassRate.hover;
      bullets = [`First-pass: ${h.passed}/${h.total}`, `Rate: ${h.percent}%`];
    } else if (
      key === "personaResponseTimes" &&
      item?.personaResponseTimes?.hover
    ) {
      const h = item.personaResponseTimes.hover;
      bullets = [
        `Mean: ${h.meanSeconds}s`,
        `Median: ${h.medianSeconds}s`,
        `Samples: ${h.samples}`,
      ];
    } else if (key === "sessionEfficiency" && item?.sessionEfficiency?.hover) {
      const h = item.sessionEfficiency.hover;
      bullets = [
        `Avg score: ${h.avgScorePercent}%`,
        `Avg time: ${h.avgMinutes}m`,
        `Efficiency: ${h.efficiency}`,
      ];
    } else if (key === "stagnationRate" && item?.stagnationRate?.hover) {
      const h = item.stagnationRate.hover;
      bullets = [
        `Tracked: ${h.tracked}`,
        `Stagnant: ${h.stagnant}`,
        `Rate: ${h.ratePercent}%`,
      ];
    } else if (key === "totalAttempts" && item?.totalAttempts) {
      bullets = [
        `Attempts: ${item.totalAttempts.value}`,
        `Formatted: ${item.totalAttempts.formattedValue}`,
      ];
    }
    return (
      <HoverCard openDelay={150} closeDelay={75}>
        <HoverCardTrigger asChild>
          <div>{content}</div>
        </HoverCardTrigger>
        {bullets.length > 0 && (
          <HoverCardContent>
            <div className="text-xs space-y-1">
              <div className="font-medium">Details</div>
              <ul className="list-disc pl-4">
                {bullets.slice(0, 3).map((b, idx) => (
                  <li key={idx}>{b}</li>
                ))}
              </ul>
            </div>
          </HoverCardContent>
        )}
      </HoverCard>
    );
  };

  return (
    <div className="space-y-2">
      <ReportsDataTableToolbar
        table={table}
        profileOptions={profileOptions}
        scenarioOptions={scenarioOptions}
        simulationOptions={simulationOptions}
        simulations={simulations}
        showExport={showExport}
      />
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="h-8">
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      className={`border-r py-1 text-xs ${
                        header.id === "profileName"
                          ? "text-left"
                          : "text-center"
                      } ${
                        header.id === "select" ? "w-12" : ""
                      } ${header.column.getCanSort() ? "pl-4" : ""}`}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="h-6 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => onViewReport(row.original.profile_id)}
                >
                  {row.getVisibleCells().map((cell) => {
                    const key = cell.column.id;
                    const content = flexRender(
                      cell.column.columnDef.cell,
                      cell.getContext()
                    );
                    const shouldHover = [
                      "averageScore",
                      "highestScore",
                      "timeSpent",
                      "messagesPerSession",
                      "completionPercentage",
                      "firstAttemptPassRate",
                      "personaResponseTimes",
                      "sessionEfficiency",
                      "stagnationRate",
                      "totalAttempts",
                    ].includes(key);
                    return (
                      <TableCell
                        key={cell.id}
                        className={`border-r px-2 py-1 ${
                          cell.column.id === "profileName"
                            ? "text-left"
                            : "text-center"
                        } ${cell.column.id === "select" ? "w-12" : ""}`}
                      >
                        {shouldHover
                          ? renderWithHover(
                              key,
                              content,
                              row.original.profile_id
                            )
                          : content}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center px-6"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} staff={true} />
    </div>
  );
}
