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
import { useAnalytics } from "@/contexts/analytics-context";
import { TAPerformanceData } from "@/hooks/use-report-columns";
import { buildFilteredViewForTa } from "@/utils/analytics/report/filtering";
import {
  computeAttemptsStats,
  computeAverageScoreStats,
  computeCompletionStats,
  computeFirstAttemptPassStats,
  computeMessageStats,
  computePersonaResponseStats,
  computeSessionEfficiencyStats,
  computeStagnationStats,
  computeTimeStats,
  computeTopScores,
} from "@/utils/analytics/report/stats";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getSimulationMessagesByChats } from "@/utils/queries/simulation_messages/get-simulation-messages-by-chats";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { useQuery } from "@tanstack/react-query";
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
  const analytics = useAnalytics();
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

  // Fetch datasets once here to support hover stats. Scope by visible rows' profile ids to minimize payloads.
  const visibleProfileIds = React.useMemo(
    () => table.getRowModel().rows.map((r) => r.original.id),
    [table]
  );

  const { data: rubrics = [] } = useQuery({
    queryKey: ["rubrics"],
    queryFn: () => getAllRubrics(),
    staleTime: 5 * 60 * 1000,
  });
  const { data: sims = [] } = useQuery({
    queryKey: ["simulations"],
    queryFn: () => getAllSimulations(),
    staleTime: 5 * 60 * 1000,
  });
  const { data: scens = [] } = useQuery({
    queryKey: ["scenarios"],
    queryFn: () => getAllScenarios(),
    staleTime: 5 * 60 * 1000,
  });
  const { data: attempts = [] } = useQuery({
    queryKey: ["simulationAttempts", visibleProfileIds],
    queryFn: () => getSimulationAttemptsByProfiles(visibleProfileIds),
    enabled: visibleProfileIds.length > 0,
  });
  const { data: chats = [] } = useQuery({
    queryKey: ["simulationChats", attempts.map((a) => a.id)],
    queryFn: () => getSimulationChatsByAttempts(attempts.map((a) => a.id)),
    enabled: attempts.length > 0,
  });
  const { data: grades = [] } = useQuery({
    queryKey: ["simulationGrades", chats.map((c) => c.id)],
    queryFn: () =>
      getSimulationChatGradesBySimulationChats(chats.map((c) => c.id)),
    enabled: chats.length > 0,
  });
  const { data: messages = [] } = useQuery({
    queryKey: ["simulationMessages", chats.map((c) => c.id)],
    queryFn: () => getSimulationMessagesByChats(chats.map((c) => c.id)),
    enabled: chats.length > 0,
  });

  // Toolbar filter selections from the table state
  const personaFilter = React.useMemo(
    () =>
      (table.getColumn("personasTested")?.getFilterValue() as string[]) || [],
    [table]
  );
  const scenarioFilter = React.useMemo(
    () => (table.getColumn("scenarioIds")?.getFilterValue() as string[]) || [],
    [table]
  );
  const simulationFilter = React.useMemo(
    () =>
      (table.getColumn("simulationIds")?.getFilterValue() as string[]) || [],
    [table]
  );

  const buildView = React.useCallback(
    (profileId: string) =>
      buildFilteredViewForTa(
        profileId,
        {
          attempts,
          chats,
          grades,
          messages,
          simulations: sims,
          scenarios: scens,
          rubrics,
        },
        {
          startDate: analytics.startDate,
          endDate: analytics.endDate,
          effectiveCohortIds: analytics.effectiveCohortIds,
          selectedRoles: analytics.selectedRoles,
          showPractice: analytics.showPractice,
          showNormal: analytics.showNormal,
          cohorts: analytics.cohorts,
        },
        {
          personaIds: personaFilter,
          scenarioIds: scenarioFilter,
          simulationIds: simulationFilter,
        }
      ),
    [
      attempts,
      chats,
      grades,
      messages,
      sims,
      scens,
      rubrics,
      analytics.startDate,
      analytics.endDate,
      analytics.effectiveCohortIds,
      analytics.selectedRoles,
      analytics.showPractice,
      analytics.showNormal,
      analytics.cohorts,
      personaFilter,
      scenarioFilter,
      simulationFilter,
    ]
  );

  const renderWithHover = (
    key: string,
    content: React.ReactNode,
    taId: string
  ) => {
    const view = buildView(taId);
    let bullets: string[] = [];
    if (key === "averageScore") {
      const s = computeAverageScoreStats(view);
      bullets = [
        `Mean: ${s.mean}%`,
        `Median: ${s.median}%`,
        `Mode: ${s.mode}%`,
      ];
    } else if (key === "highestScore") {
      const top = computeTopScores(view, 3);
      bullets = top.length
        ? top.map((v, i) => `${i + 1}. ${v}%`)
        : ["No scores available"];
    } else if (key === "timeSpent") {
      const t = computeTimeStats(view);
      bullets = [
        `Avg session: ${t.avgSessionMinutes}m`,
        `Avg chat: ${t.avgChatMinutes}m`,
        `Avg time spent: ${t.avgOverallMinutes}m`,
      ];
    } else if (key === "messagesPerSession") {
      const m = computeMessageStats(view);
      bullets = [
        `Mean msgs/chat: ${m.mean}`,
        `Median msgs/chat: ${m.median}`,
        `Chats counted: ${m.count}`,
      ];
    } else if (key === "completionPercentage") {
      const c = computeCompletionStats(view);
      bullets = [`Completed: ${c.completed}/${c.total}`, `Rate: ${c.percent}%`];
    } else if (key === "firstAttemptPassRate") {
      const f = computeFirstAttemptPassStats(view);
      bullets = [`First-pass: ${f.passed}/${f.total}`, `Rate: ${f.percent}%`];
    } else if (key === "personaResponseTimes") {
      const r = computePersonaResponseStats(view);
      bullets = [
        `Mean: ${Math.round(r.meanSeconds / 60)}m`,
        `Median: ${Math.round(r.medianSeconds / 60)}m`,
        `Samples: ${r.samples}`,
      ];
    } else if (key === "sessionEfficiency") {
      const e = computeSessionEfficiencyStats(view);
      bullets = [
        `Avg score: ${e.avgScorePercent}%`,
        `Avg time: ${e.avgMinutes}m`,
        `Efficiency: ${e.efficiency}`,
      ];
    } else if (key === "stagnationRate") {
      const s = computeStagnationStats(view);
      bullets = [
        `Tracked: ${s.tracked}`,
        `Stagnant: ${s.stagnant}`,
        `Rate: ${s.ratePercent}%`,
      ];
    } else if (key === "totalAttempts") {
      const a = computeAttemptsStats(view);
      bullets = [
        `Attempts: ${a.attempts}`,
        `Unique sims: ${a.uniqueSimulations}`,
        `Mean/Sim: ${a.perSimulationMean}`,
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
