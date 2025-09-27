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

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { TAPerformanceData } from "@/hooks/use-report-columns";
import { ReportsDataTableToolbar } from "./ReportsDataTableToolbar";

export interface ReportsDataTableProps {
  columns: ColumnDef<TAPerformanceData>[];
  data: TAPerformanceData[];
  personaOptions: { value: string; label: string }[];
  scenarioOptions: { value: string; label: string }[];
  simulationOptions: { value: string; label: string }[];
  simulations: Array<{ id: string; title: string }>;
  showExport?: boolean;
  onViewReport: (profileId: string) => void;
}

export function ReportsDataTable({
  columns,
  data,
  personaOptions,
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
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  const renderWithHover = (
    key: string,
    content: React.ReactNode,
    taId: string
  ) => {
    const ta = data.find((d) => d.id === taId);
    const h = ta?.hover;
    let bullets: string[] = [];
    if (key === "averageScore" && h?.scoreStats) {
      bullets = [
        `Mean: ${h.scoreStats.mean}%`,
        `Median: ${h.scoreStats.median}%`,
        `Mode: ${h.scoreStats.mode}%`,
      ];
    } else if (key === "highestScore" && h?.scoreStats?.top) {
      bullets = h.scoreStats.top.length
        ? h.scoreStats.top.map((v, i) => `${i + 1}. ${v}%`)
        : ["No scores available"];
    } else if (key === "timeSpent" && h?.timeStats) {
      bullets = [
        `Avg session: ${h.timeStats.avgSessionMinutes}m`,
        `Avg chat: ${h.timeStats.avgChatMinutes}m`,
        `Avg time spent: ${h.timeStats.avgOverallMinutes}m`,
      ];
    } else if (key === "messagesPerSession" && h?.messageStats) {
      bullets = [
        `Mean msgs/chat: ${h.messageStats.mean}`,
        `Median msgs/chat: ${h.messageStats.median}`,
        `Chats counted: ${h.messageStats.count}`,
      ];
    } else if (key === "completionPercentage" && h?.completionStats) {
      bullets = [
        `Completed: ${h.completionStats.completed}/${h.completionStats.total}`,
        `Rate: ${h.completionStats.percent}%`,
      ];
    } else if (key === "firstAttemptPassRate" && h?.firstAttemptStats) {
      bullets = [
        `First-pass: ${h.firstAttemptStats.passed}/${h.firstAttemptStats.total}`,
        `Rate: ${h.firstAttemptStats.percent}%`,
      ];
    } else if (key === "personaResponseTimes" && h?.personaResponseStats) {
      bullets = [
        `Mean: ${h.personaResponseStats.meanSeconds}s`,
        `Median: ${h.personaResponseStats.medianSeconds}s`,
        `Samples: ${h.personaResponseStats.samples}`,
      ];
    } else if (key === "sessionEfficiency" && h?.efficiencyStats) {
      bullets = [
        `Avg score: ${h.efficiencyStats.avgScorePercent}%`,
        `Avg time: ${h.efficiencyStats.avgMinutes}m`,
        `Efficiency: ${h.efficiencyStats.efficiency}`,
      ];
    } else if (key === "stagnationRate" && h?.stagnationStats) {
      bullets = [
        `Tracked: ${h.stagnationStats.tracked}`,
        `Stagnant: ${h.stagnationStats.stagnant}`,
        `Rate: ${h.stagnationStats.ratePercent}%`,
      ];
    } else if (key === "totalAttempts") {
      bullets = [
        `Attempts: ${ta?.totalAttempts ?? 0}`,
        `Unique sims: ${(ta?.simulationIds ?? []).length}`,
        `Mean/Sim: ${((ta?.totalAttempts ?? 0) / Math.max(1, (ta?.simulationIds ?? []).length)).toFixed(2)}`,
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
        personaOptions={personaOptions}
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
                      className={`border-r py-1 text-xs text-center ${
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
                  onClick={() => onViewReport(row.original.id)}
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
                        className={`border-r px-2 py-1 text-center ${
                          cell.column.id === "select" ? "w-12" : ""
                        }`}
                      >
                        {shouldHover
                          ? renderWithHover(key, content, row.original.id)
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
    </div>
  );
}
