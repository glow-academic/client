/**
 * Reports.tsx
 * Reports table using API response types directly, following fast/dumb UI principle
 */
"use client";
import { ColumnDef, Row, Table as TableType } from "@tanstack/react-table";
import { Clock, Download, MessageCircle, Target, Timer, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { ReportsOut } from "@/app/(main)/analytics/reports/page";
import { ExportPicker } from "@/components/common/forms/ExportPicker";
import { DataTableColumnHeader } from "@/components/common/table/DataTableColumnHeader";
import { DataTableFacetedFilter } from "@/components/common/table/DataTableFacetedFilter";
import { DataTablePagination } from "@/components/common/table/DataTablePagination";
import { DataTableViewOptions } from "@/components/common/table/DataTableViewOptions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AnalyticsFilters } from "@/utils/analytics-filters";
import {
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

interface ReportsProps {
  reportsData: ReportsOut;
  filters: AnalyticsFilters;
}

export default function Reports({ reportsData, filters }: ReportsProps) {
  const router = useRouter();

  // Extract data from API response
  const profiles = useMemo(() => reportsData?.data || [], [reportsData?.data]);
  const scenarioMapping = useMemo(
    () => reportsData?.scenario_mapping || {},
    [reportsData?.scenario_mapping]
  );
  const simulationMapping = useMemo(
    () => reportsData?.simulation_mapping || {},
    [reportsData?.simulation_mapping]
  );

  // Export state
  const [exportPopoverOpen, setExportPopoverOpen] = useState(false);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  const [brightspaceFormat, setBrightspaceFormat] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Table state
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    personaResponseTimes: false,
    stagnationRate: false,
    profileId: false,
    scenarios: false,
    simulations: false,
  });
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "averageScore", desc: true },
  ]);

  // Build options from API data
  const profileOptions = useMemo(() => {
    if (!profiles || profiles.length === 0) return [];

    const uniqueProfiles = profiles.reduce(
      (acc, profile) => {
        if (
          profile?.profileId &&
          profile?.firstName &&
          profile?.lastName &&
          !acc.find((p) => p.value === profile.profileId)
        ) {
          acc.push({
            value: profile.profileId,
            label: `${profile.firstName} ${profile.lastName}`,
          });
        }
        return acc;
      },
      [] as { value: string; label: string }[]
    );

    return uniqueProfiles;
  }, [profiles]);

  const scenarioOptions = useMemo(
    () =>
      Object.entries(scenarioMapping).map(([id, scenario]) => ({
        value: id,
        label: scenario.name,
      })),
    [scenarioMapping]
  );

  const simulationOptions = useMemo(
    () =>
      Object.entries(simulationMapping).map(([id, simulation]) => ({
        value: id,
        label: simulation.name,
      })),
    [simulationMapping]
  );

  const simulations = useMemo(
    () =>
      Object.entries(simulationMapping).map(([id, simulation]) => ({
        id,
        title: simulation.name,
      })),
    [simulationMapping]
  );

  // Define columns using typeof pattern
  const columns: ColumnDef<(typeof profiles)[number]>[] = useMemo(() => {
    const formatValue = (
      metric: (typeof profiles)[number]["metrics"][keyof (typeof profiles)[number]["metrics"]]
    ): string => {
      if (!metric.hasData) return "N/A";
      if (metric.currentValue == null) return "N/A";
      return `${metric.currentValue}${metric.valueField === "percent" ? "%" : metric.valueField === "seconds" ? "s" : metric.valueField === "minutes" ? "m" : ""}`;
    };

    const getBgColor = (
      metric: (typeof profiles)[number]["metrics"][keyof (typeof profiles)[number]["metrics"]],
      thresholds: { gray: number; red: number; yellow: number; green: number }
    ): string => {
      if (!metric.hasData || metric.currentValue == null) return "bg-gray-50";
      const value = metric.currentValue;
      if (value >= thresholds.green) return "bg-green-50";
      if (value >= thresholds.yellow) return "bg-yellow-50";
      return "bg-red-50";
    };

    const getHoverBullets = (
      metricKey: string,
      profile: (typeof profiles)[number]
    ): string[] => {
      const metric = profile.metrics[metricKey as keyof typeof profile.metrics];
      if (!metric?.hover) return [];

      const hover = metric.hover;
      const bullets: string[] = [];

      switch (metricKey) {
        case "averageScore":
          if (
            hover["mean"] != null &&
            hover["median"] != null &&
            hover["mode"] != null
          ) {
            bullets.push(
              `Mean: ${hover["mean"]}%`,
              `Median: ${hover["median"]}%`,
              `Mode: ${hover["mode"]}%`
            );
          }
          break;
        case "highestScore":
          if (Array.isArray(hover["top"])) {
            bullets.push(
              ...hover["top"].map((v, i) => `${i + 1}. ${v}%`).slice(0, 3)
            );
          }
          break;
        case "completionPercentage":
          if (
            hover["completed"] != null &&
            hover["total"] != null &&
            hover["percent"] != null
          ) {
            bullets.push(
              `Completed: ${hover["completed"]}/${hover["total"]}`,
              `Rate: ${hover["percent"]}%`
            );
          }
          break;
        case "firstAttemptPassRate":
          if (
            hover["passed"] != null &&
            hover["total"] != null &&
            hover["percent"] != null
          ) {
            bullets.push(
              `First-pass: ${hover["passed"]}/${hover["total"]}`,
              `Rate: ${hover["percent"]}%`
            );
          }
          break;
        case "messagesPerSession":
          if (
            hover["mean"] != null &&
            hover["median"] != null &&
            hover["count"] != null
          ) {
            bullets.push(
              `Mean msgs/chat: ${hover["mean"]}`,
              `Median msgs/chat: ${hover["median"]}`,
              `Chats counted: ${hover["count"]}`
            );
          }
          break;
        case "personaResponseTimes":
          if (
            hover["meanSeconds"] != null &&
            hover["medianSeconds"] != null &&
            hover["samples"] != null
          ) {
            bullets.push(
              `Mean: ${hover["meanSeconds"]}s`,
              `Median: ${hover["medianSeconds"]}s`,
              `Samples: ${hover["samples"]}`
            );
          }
          break;
        case "sessionEfficiency":
          if (
            hover["avgScorePercent"] != null &&
            hover["avgMinutes"] != null &&
            hover["efficiency"] != null
          ) {
            bullets.push(
              `Avg score: ${hover["avgScorePercent"]}%`,
              `Avg time: ${hover["avgMinutes"]}m`,
              `Efficiency: ${hover["efficiency"]}`
            );
          }
          break;
        case "stagnationRate":
          if (
            hover["tracked"] != null &&
            hover["stagnant"] != null &&
            hover["ratePercent"] != null
          ) {
            bullets.push(
              `Tracked: ${hover["tracked"]}`,
              `Stagnant: ${hover["stagnant"]}`,
              `Rate: ${hover["ratePercent"]}%`
            );
          }
          break;
        case "timeSpent":
          if (
            hover["avgSessionMinutes"] != null &&
            hover["avgChatMinutes"] != null &&
            hover["avgOverallMinutes"] != null
          ) {
            bullets.push(
              `Avg session: ${hover["avgSessionMinutes"]}m`,
              `Avg chat: ${hover["avgChatMinutes"]}m`,
              `Avg time spent: ${hover["avgOverallMinutes"]}m`
            );
          }
          break;
        case "totalAttempts":
          if (hover["attempts"] != null) {
            bullets.push(`Attempts: ${hover["attempts"]}`);
            if (hover["uniqueSims"] != null) {
              bullets.push(`Unique sims: ${hover["uniqueSims"]}`);
            }
            if (hover["meanPerSim"] != null) {
              bullets.push(`Mean/Sim: ${hover["meanPerSim"]}`);
            }
          }
          break;
      }

      return bullets;
    };

    return [
      // Select column
      {
        id: "select",
        header: ({
          table,
        }: {
          table: TableType<(typeof profiles)[number]>;
        }) => (
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
        cell: ({ row }: { row: Row<(typeof profiles)[number]> }) => (
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

      // Name column
      {
        id: "profileName",
        accessorFn: (row) => `${row.firstName} ${row.lastName}`,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Name" />
        ),
        cell: ({ row }) => {
          const profile = row.original;
          const displayName = `${profile.firstName} ${profile.lastName}`;
          return (
            <div
              className="flex items-center space-x-1 cursor-pointer hover:text-primary hover:underline justify-start pl-1 py-0 max-w-[130px]"
              onClick={() =>
                router.push(`/analytics/reports/p/${profile.profileId}`)
              }
              title={`${displayName}${profile.alias ? ` (${profile.alias})` : ""} - Click to view detailed report`}
              data-testid={`reports-profile-row-${profile.profileId}`}
            >
              <div className="flex flex-col items-start min-w-0 w-full">
                <span
                  className="text-xs font-medium truncate w-full"
                  title={displayName}
                >
                  {displayName}
                </span>
                {profile.alias && (
                  <span
                    className="text-xs text-muted-foreground truncate w-full"
                    title={profile.alias}
                  >
                    {profile.alias}
                  </span>
                )}
              </div>
            </div>
          );
        },
        enableSorting: true,
      },

      // Average Score column
      {
        id: "averageScore",
        accessorFn: (row) => row.metrics.averageScore.currentValue,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Avg Score" />
        ),
        cell: ({ row }) => {
          const profile = row.original;
          const metric = profile.metrics.averageScore;
          const bgColor = getBgColor(metric, {
            gray: 0,
            red: 60,
            yellow: 75,
            green: 85,
          });
          const bullets = getHoverBullets("averageScore", profile);
          const content = (
            <div
              className={`text-center px-1 py-0.5 rounded text-xs font-medium ${bgColor}`}
            >
              {formatValue(metric)}
            </div>
          );
          return bullets.length > 0 ? (
            <HoverCard openDelay={150} closeDelay={75}>
              <HoverCardTrigger asChild>
                <div>{content}</div>
              </HoverCardTrigger>
              <HoverCardContent>
                <div className="text-xs space-y-1">
                  <div className="font-medium">Details</div>
                  <ul className="list-disc pl-4">
                    {bullets.map((b, idx) => (
                      <li key={idx}>{b}</li>
                    ))}
                  </ul>
                </div>
              </HoverCardContent>
            </HoverCard>
          ) : (
            content
          );
        },
        enableSorting: true,
      },

      // Highest Score column
      {
        id: "highestScore",
        accessorFn: (row) => row.metrics.highestScore.currentValue,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Highest" />
        ),
        cell: ({ row }) => {
          const profile = row.original;
          const metric = profile.metrics.highestScore;
          const bgColor = getBgColor(metric, {
            gray: 0,
            red: 70,
            yellow: 80,
            green: 90,
          });
          const bullets = getHoverBullets("highestScore", profile);
          const content = (
            <div
              className={`text-center px-1 py-0.5 rounded text-xs font-medium ${bgColor}`}
            >
              {formatValue(metric)}
            </div>
          );
          return bullets.length > 0 ? (
            <HoverCard openDelay={150} closeDelay={75}>
              <HoverCardTrigger asChild>
                <div>{content}</div>
              </HoverCardTrigger>
              <HoverCardContent>
                <div className="text-xs space-y-1">
                  <div className="font-medium">Details</div>
                  <ul className="list-disc pl-4">
                    {bullets.map((b, idx) => (
                      <li key={idx}>{b}</li>
                    ))}
                  </ul>
                </div>
              </HoverCardContent>
            </HoverCard>
          ) : (
            content
          );
        },
        enableSorting: true,
      },

      // Completion Percentage column
      {
        id: "completionPercentage",
        accessorFn: (row) => row.metrics.completionPercentage.currentValue,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Completion" />
        ),
        cell: ({ row }) => {
          const profile = row.original;
          const metric = profile.metrics.completionPercentage;
          const bgColor = getBgColor(metric, {
            gray: 0,
            red: 60,
            yellow: 75,
            green: 85,
          });
          const bullets = getHoverBullets("completionPercentage", profile);
          const content = (
            <div
              className={`text-center px-1 py-0.5 rounded text-xs font-medium ${bgColor}`}
            >
              {formatValue(metric)}
            </div>
          );
          return bullets.length > 0 ? (
            <HoverCard openDelay={150} closeDelay={75}>
              <HoverCardTrigger asChild>
                <div>{content}</div>
              </HoverCardTrigger>
              <HoverCardContent>
                <div className="text-xs space-y-1">
                  <div className="font-medium">Details</div>
                  <ul className="list-disc pl-4">
                    {bullets.map((b, idx) => (
                      <li key={idx}>{b}</li>
                    ))}
                  </ul>
                </div>
              </HoverCardContent>
            </HoverCard>
          ) : (
            content
          );
        },
        enableSorting: true,
      },

      // First Attempt Pass Rate column
      {
        id: "firstAttemptPassRate",
        accessorFn: (row) => row.metrics.firstAttemptPassRate.currentValue,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="First Pass" />
        ),
        cell: ({ row }) => {
          const profile = row.original;
          const metric = profile.metrics.firstAttemptPassRate;
          const bgColor = getBgColor(metric, {
            gray: 0,
            red: 60,
            yellow: 75,
            green: 85,
          });
          const bullets = getHoverBullets("firstAttemptPassRate", profile);
          const content = (
            <div
              className={`text-center px-1 py-0.5 rounded text-xs font-medium ${bgColor}`}
            >
              {formatValue(metric)}
            </div>
          );
          return bullets.length > 0 ? (
            <HoverCard openDelay={150} closeDelay={75}>
              <HoverCardTrigger asChild>
                <div>{content}</div>
              </HoverCardTrigger>
              <HoverCardContent>
                <div className="text-xs space-y-1">
                  <div className="font-medium">Details</div>
                  <ul className="list-disc pl-4">
                    {bullets.map((b, idx) => (
                      <li key={idx}>{b}</li>
                    ))}
                  </ul>
                </div>
              </HoverCardContent>
            </HoverCard>
          ) : (
            content
          );
        },
        enableSorting: true,
      },

      // Messages Per Session column
      {
        id: "messagesPerSession",
        accessorFn: (row) => row.metrics.messagesPerSession.currentValue,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Msgs/Sess" />
        ),
        cell: ({ row }) => {
          const profile = row.original;
          const metric = profile.metrics.messagesPerSession;
          const bgColor = getBgColor(metric, {
            gray: 0,
            red: 5,
            yellow: 8,
            green: 12,
          });
          const bullets = getHoverBullets("messagesPerSession", profile);
          const content = (
            <div
              className={`text-center px-1 py-0.5 rounded text-xs font-medium flex items-center justify-center gap-0.5 ${bgColor}`}
            >
              <MessageCircle className="h-2.5 w-2.5" />
              {formatValue(metric)}
            </div>
          );
          return bullets.length > 0 ? (
            <HoverCard openDelay={150} closeDelay={75}>
              <HoverCardTrigger asChild>
                <div>{content}</div>
              </HoverCardTrigger>
              <HoverCardContent>
                <div className="text-xs space-y-1">
                  <div className="font-medium">Details</div>
                  <ul className="list-disc pl-4">
                    {bullets.map((b, idx) => (
                      <li key={idx}>{b}</li>
                    ))}
                  </ul>
                </div>
              </HoverCardContent>
            </HoverCard>
          ) : (
            content
          );
        },
        enableSorting: true,
      },

      // Persona Response Times column
      {
        id: "personaResponseTimes",
        accessorFn: (row) => row.metrics.personaResponseTimes.currentValue,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Response Time" />
        ),
        cell: ({ row }) => {
          const profile = row.original;
          const metric = profile.metrics.personaResponseTimes;
          // Inverted thresholds for response time (lower is better)
          const bgColor =
            !metric.hasData || metric.currentValue == null
              ? "bg-gray-50"
              : metric.currentValue <= 180
                ? "bg-green-50"
                : metric.currentValue <= 300
                  ? "bg-yellow-50"
                  : "bg-red-50";
          const bullets = getHoverBullets("personaResponseTimes", profile);
          const content = (
            <div
              className={`text-center px-1 py-0.5 rounded text-xs font-medium flex items-center justify-center gap-0.5 ${bgColor}`}
            >
              <Clock className="h-2.5 w-2.5" />
              {formatValue(metric)}
            </div>
          );
          return bullets.length > 0 ? (
            <HoverCard openDelay={150} closeDelay={75}>
              <HoverCardTrigger asChild>
                <div>{content}</div>
              </HoverCardTrigger>
              <HoverCardContent>
                <div className="text-xs space-y-1">
                  <div className="font-medium">Details</div>
                  <ul className="list-disc pl-4">
                    {bullets.map((b, idx) => (
                      <li key={idx}>{b}</li>
                    ))}
                  </ul>
                </div>
              </HoverCardContent>
            </HoverCard>
          ) : (
            content
          );
        },
        enableSorting: true,
      },

      // Session Efficiency column
      {
        id: "sessionEfficiency",
        accessorFn: (row) => row.metrics.sessionEfficiency.currentValue,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Efficiency" />
        ),
        cell: ({ row }) => {
          const profile = row.original;
          const metric = profile.metrics.sessionEfficiency;
          const bgColor = getBgColor(metric, {
            gray: 0,
            red: 60,
            yellow: 75,
            green: 85,
          });
          const bullets = getHoverBullets("sessionEfficiency", profile);
          const content = (
            <div
              className={`text-center px-1 py-0.5 rounded text-xs font-medium ${bgColor}`}
            >
              {formatValue(metric)}
            </div>
          );
          return bullets.length > 0 ? (
            <HoverCard openDelay={150} closeDelay={75}>
              <HoverCardTrigger asChild>
                <div>{content}</div>
              </HoverCardTrigger>
              <HoverCardContent>
                <div className="text-xs space-y-1">
                  <div className="font-medium">Details</div>
                  <ul className="list-disc pl-4">
                    {bullets.map((b, idx) => (
                      <li key={idx}>{b}</li>
                    ))}
                  </ul>
                </div>
              </HoverCardContent>
            </HoverCard>
          ) : (
            content
          );
        },
        enableSorting: true,
      },

      // Stagnation Rate column
      {
        id: "stagnationRate",
        accessorFn: (row) => row.metrics.stagnationRate.currentValue,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Stagnation" />
        ),
        cell: ({ row }) => {
          const profile = row.original;
          const metric = profile.metrics.stagnationRate;
          // Inverted thresholds for stagnation (lower is better)
          const bgColor =
            !metric.hasData || metric.currentValue == null
              ? "bg-gray-50"
              : metric.currentValue <= 15
                ? "bg-green-50"
                : metric.currentValue <= 25
                  ? "bg-yellow-50"
                  : "bg-red-50";
          const bullets = getHoverBullets("stagnationRate", profile);
          const content = (
            <div
              className={`text-center px-1 py-0.5 rounded text-xs font-medium ${bgColor}`}
            >
              {formatValue(metric)}
            </div>
          );
          return bullets.length > 0 ? (
            <HoverCard openDelay={150} closeDelay={75}>
              <HoverCardTrigger asChild>
                <div>{content}</div>
              </HoverCardTrigger>
              <HoverCardContent>
                <div className="text-xs space-y-1">
                  <div className="font-medium">Details</div>
                  <ul className="list-disc pl-4">
                    {bullets.map((b, idx) => (
                      <li key={idx}>{b}</li>
                    ))}
                  </ul>
                </div>
              </HoverCardContent>
            </HoverCard>
          ) : (
            content
          );
        },
        enableSorting: true,
      },

      // Time Spent column
      {
        id: "timeSpent",
        accessorFn: (row) => row.metrics.timeSpent.currentValue,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Time Spent" />
        ),
        cell: ({ row }) => {
          const profile = row.original;
          const metric = profile.metrics.timeSpent;
          // Inverted thresholds for time spent (lower is better)
          const bgColor =
            !metric.hasData || metric.currentValue == null
              ? "bg-gray-50"
              : metric.currentValue <= 60
                ? "bg-green-50"
                : metric.currentValue <= 90
                  ? "bg-yellow-50"
                  : "bg-red-50";
          const bullets = getHoverBullets("timeSpent", profile);
          const content = (
            <div
              className={`text-center px-1 py-0.5 rounded text-xs font-medium flex items-center justify-center gap-0.5 ${bgColor}`}
            >
              <Timer className="h-2.5 w-2.5" />
              {formatValue(metric)}
            </div>
          );
          return bullets.length > 0 ? (
            <HoverCard openDelay={150} closeDelay={75}>
              <HoverCardTrigger asChild>
                <div>{content}</div>
              </HoverCardTrigger>
              <HoverCardContent>
                <div className="text-xs space-y-1">
                  <div className="font-medium">Details</div>
                  <ul className="list-disc pl-4">
                    {bullets.map((b, idx) => (
                      <li key={idx}>{b}</li>
                    ))}
                  </ul>
                </div>
              </HoverCardContent>
            </HoverCard>
          ) : (
            content
          );
        },
        enableSorting: true,
      },

      // Total Attempts column
      {
        id: "totalAttempts",
        accessorFn: (row) => row.metrics.totalAttempts.currentValue,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Attempts" />
        ),
        cell: ({ row }) => {
          const profile = row.original;
          const metric = profile.metrics.totalAttempts;
          const bgColor = getBgColor(metric, {
            gray: 0,
            red: 3,
            yellow: 5,
            green: 8,
          });
          const bullets = getHoverBullets("totalAttempts", profile);
          const content = (
            <div
              className={`text-center px-1 py-0.5 rounded text-xs font-medium flex items-center justify-center gap-0.5 ${bgColor}`}
            >
              <Target className="h-2.5 w-2.5" />
              {formatValue(metric)}
            </div>
          );
          return bullets.length > 0 ? (
            <HoverCard openDelay={150} closeDelay={75}>
              <HoverCardTrigger asChild>
                <div>{content}</div>
              </HoverCardTrigger>
              <HoverCardContent>
                <div className="text-xs space-y-1">
                  <div className="font-medium">Details</div>
                  <ul className="list-disc pl-4">
                    {bullets.map((b, idx) => (
                      <li key={idx}>{b}</li>
                    ))}
                  </ul>
                </div>
              </HoverCardContent>
            </HoverCard>
          ) : (
            content
          );
        },
        enableSorting: true,
      },

      // Hidden columns for filtering
      {
        accessorKey: "profileId",
        id: "profileId",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        filterFn: (row, _id, value) => {
          if (!value || !Array.isArray(value) || value.length === 0)
            return true;
          const profileId = row.original.profileId;
          return value.includes(profileId);
        },
      },
      {
        id: "scenarios",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row) => row.scenarioIds ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("scenarios") as string[]) ?? [];
          if (!value || value.length === 0) return true;
          return value.some((v) => rowIds.includes(v));
        },
      },
      {
        id: "simulations",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row) => row.simulationIds ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("simulations") as string[]) ?? [];
          if (!value || value.length === 0) return true;
          return value.some((v) => rowIds.includes(v));
        },
      },
    ];
  }, [router]);

  // Create table instance
  const table = useReactTable({
    data: profiles,
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

  // Memoize table rows to avoid calling getRowModel() multiple times and prevent re-render issues
  // Extract pagination primitives directly to avoid object reference issues
  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  const tableRows = useMemo(() => {
    return table.getRowModel().rows;
  }, [
    // Use JSON.stringify for arrays to ensure stable comparison (arrays are compared by reference)
    JSON.stringify(sorting),
    JSON.stringify(columnFilters),
    profiles.length,
    // Use pagination primitives directly (not object references)
    pageIndex,
    pageSize,
  ]);

  // Export functionality
  const selectedRows = Object.keys(rowSelection).length;
  const allMetrics = [
    "highestScore",
    "averageScore",
    "completionPercentage",
    "firstAttemptPassRate",
    "messagesPerSession",
    "personaResponseTimes",
    "sessionEfficiency",
    "stagnationRate",
    "timeSpent",
    "totalAttempts",
  ];

  const getSelectedProfileIds = (): string[] => {
    const selectedRowsData =
      selectedRows > 0
        ? table.getFilteredSelectedRowModel().rows
        : table.getFilteredRowModel().rows;

    return selectedRowsData.map((row) => row.original.profileId);
  };

  const getSelectedSimulationIds = (): string[] => {
    const simulationColumn = table.getColumn("simulations");
    const filterValue = simulationColumn?.getFilterValue() as
      | string[]
      | undefined;
    return filterValue || [];
  };

  const getSelectedScenarioIds = (): string[] => {
    const scenarioColumn = table.getColumn("scenarios");
    const filterValue = scenarioColumn?.getFilterValue() as
      | string[]
      | undefined;
    return filterValue || [];
  };

  const handleExport = async () => {
    if (brightspaceFormat && selectedMetrics.length === 0) {
      toast.error("Please select at least one metric for Brightspace export");
      return;
    }

    const metricsToExport =
      selectedMetrics.length === 0 && !brightspaceFormat
        ? allMetrics
        : selectedMetrics;

    if (brightspaceFormat && simulations.length === 0) {
      toast.error("No simulations available for export");
      return;
    }

    try {
      setIsExporting(true);

      const profileIds = getSelectedProfileIds();
      const simulationIds = getSelectedSimulationIds();
      const scenarioIds = getSelectedScenarioIds();

      const response = await fetch("/api/documents/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filters,
          profileIds,
          simulationIds,
          scenarioIds,
          metrics: metricsToExport,
          brightspaceFormat,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          error: "Failed to export data",
        }));
        throw new Error(
          errorData.message || errorData.error || "Failed to export data"
        );
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      const contentDisposition = response.headers.get("content-disposition");
      const contentType = response.headers.get("content-type") || "";

      let filename: string;
      if (brightspaceFormat) {
        const isZip = contentType.includes("application/zip");
        filename = isZip
          ? `reports_export_${new Date().toISOString().slice(0, 10)}.zip`
          : `reports_export_${new Date().toISOString().slice(0, 10)}.csv`;
      } else {
        filename = `reports_export_${new Date().toISOString().slice(0, 10)}.csv`;
      }

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1];
        }
      }

      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(
        `Exported ${profileIds.length} ${profileIds.length === 1 ? "row" : "rows"} successfully`
      );
      setExportPopoverOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to export data"
      );
    } finally {
      setIsExporting(false);
    }
  };

  const isExportDisabled =
    isExporting || (brightspaceFormat && selectedMetrics.length === 0);

  // Get column references for toolbar
  const profileNameColumn = table.getColumn("profileName");
  const profileIdColumn = table.getColumn("profileId");
  const scenariosColumn = table.getColumn("scenarios");
  const simulationsColumn = table.getColumn("simulations");
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="space-y-6" data-testid="reports-table-container">
      <div className="space-y-2">
        {/* Toolbar */}
        <Popover open={exportPopoverOpen} onOpenChange={setExportPopoverOpen}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div className="flex flex-1 items-center space-x-2 flex-wrap">
              {/* Mobile: Wrap search and export button in 50/50 flex */}
              <div className="flex gap-2 w-full md:w-auto md:flex-initial mb-2 md:mb-0">
                <Input
                  placeholder="Search profiles by name or alias..."
                  value={(profileNameColumn?.getFilterValue() as string) ?? ""}
                  onChange={(event) =>
                    profileNameColumn?.setFilterValue(event.target.value)
                  }
                  className="h-8 flex-1 md:w-[150px] lg:w-[250px]"
                />
                {/* Export Button - Mobile */}
                <div className="flex-1 md:flex-initial md:w-auto md:hidden">
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      className="group w-full"
                    >
                      <Download className="mr-2 h-4 w-4 text-current" />
                      Export {selectedRows > 0 ? `(${selectedRows})` : ""}
                    </Button>
                  </PopoverTrigger>
                </div>
              </div>

              <div className="flex items-center space-x-2 flex-wrap mb-2">
                {/* Name Filter */}
                {profileIdColumn && profileOptions.length > 0 && (
                  <DataTableFacetedFilter
                    column={profileIdColumn}
                    title="Name"
                    options={profileOptions}
                  />
                )}

                {/* Scenario Filter */}
                {scenariosColumn && scenarioOptions.length > 0 && (
                  <DataTableFacetedFilter
                    column={scenariosColumn}
                    title="Scenario"
                    options={scenarioOptions}
                  />
                )}

                {/* Simulation Filter */}
                {simulationsColumn && simulationOptions.length > 0 && (
                  <DataTableFacetedFilter
                    column={simulationsColumn}
                    title="Simulation"
                    options={simulationOptions}
                  />
                )}

                {isFiltered && (
                  <Button
                    variant="ghost"
                    onClick={() => table.resetColumnFilters()}
                    className="h-8 px-2 lg:px-3 hidden md:flex"
                  >
                    Reset
                    <X className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2 mb-2">
              {/* Export Button - Desktop */}
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  className="group hidden md:inline-flex"
                >
                  <Download className="mr-2 h-4 w-4 text-current" />
                  Export {selectedRows > 0 ? `(${selectedRows})` : ""}
                </Button>
              </PopoverTrigger>
              <DataTableViewOptions table={table} hiddenColumns={["simulations"]} />
            </div>
          </div>
          {/* Shared Popover Content */}
          <PopoverContent className="w-96 p-4" align="end">
            <div className="space-y-4">
              <div className="space-y-3">
                <ExportPicker
                  selectedMetrics={selectedMetrics}
                  onSelect={setSelectedMetrics}
                  label="Metrics"
                  placeholder={
                    brightspaceFormat
                      ? "Choose at least one metric..."
                      : selectedMetrics.length === 0
                        ? "All metrics selected"
                        : "Select metrics to export..."
                  }
                  description="Choose one or more metrics to include in the export."
                />

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="brightspace-desktop"
                    checked={brightspaceFormat}
                    onCheckedChange={(checked) =>
                      setBrightspaceFormat(checked === true)
                    }
                  />
                  <label
                    htmlFor="brightspace-desktop"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Brightspace Format
                  </label>
                </div>

                {brightspaceFormat && (
                  <p className="text-xs text-muted-foreground">
                    Brightspace format exports one CSV file per selected metric.
                    {selectedMetrics.length > 1
                      ? " Multiple metrics are packaged in a ZIP file."
                      : " Single metric exports as a CSV file."}{" "}
                    Each CSV follows Brightspace gradebook import format.
                  </p>
                )}

                {!brightspaceFormat && (
                  <p className="text-xs text-muted-foreground">
                    Regular format exports a single CSV file with the selected
                    metrics.
                  </p>
                )}
              </div>

              <div className="pt-2 flex justify-end">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="w-full">
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={handleExport}
                          disabled={isExportDisabled}
                        >
                          {isExporting
                            ? "Exporting..."
                            : brightspaceFormat
                              ? selectedMetrics.length === 1
                                ? "Export to CSV"
                                : "Export to ZIP"
                              : "Export to CSV"}
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {brightspaceFormat && selectedMetrics.length === 0 && (
                      <TooltipContent>
                        <p>Brightspace export requires at least one metric</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Table */}
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
                      } ${header.id === "select" ? "w-12" : ""} ${
                        header.column.getCanSort() ? "pl-4" : ""
                      }`}
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
            {tableRows?.length ? (
              tableRows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="h-6 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() =>
                    router.push(
                      `/analytics/reports/p/${row.original.profileId}`
                    )
                  }
                >
                  {row.getVisibleCells().map((cell) => {
                    return (
                      <TableCell
                        key={cell.id}
                        className={`border-r px-2 py-1 ${
                          cell.column.id === "profileName"
                            ? "text-left"
                            : "text-center"
                        } ${cell.column.id === "select" ? "w-12" : ""}`}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
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

      {/* Pagination */}
      <DataTablePagination table={table} staff={true} />
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
