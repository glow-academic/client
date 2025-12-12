/**
 * Reports.tsx
 * Reports table using API response types directly, following fast/dumb UI principle
 */
"use client";
import { ColumnDef, Row, Table as TableType } from "@tanstack/react-table";
import { Clock, Download, MessageCircle, Target, Timer, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { ReportsOut } from "@/app/(main)/analytics/reports/page";
import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { EXPORT_METRICS } from "@/components/common/forms/export-metrics";
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
  useReactTable,
} from "@tanstack/react-table";

interface ReportsProps {
  reportsData: ReportsOut;
  filters: AnalyticsFilters;
  isLoading?: boolean;
  profileOptions: Array<{ value: string; label: string; count?: number }>;
  simulationOptions: Array<{ value: string; label: string; count?: number }>;
  scenarioOptions: Array<{ value: string; label: string; count?: number }>;
}

export default function Reports({
  reportsData,
  filters,
  isLoading = false,
  profileOptions,
  simulationOptions,
  scenarioOptions,
}: ReportsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Extract data from API response
  const profiles = useMemo(() => reportsData?.data || [], [reportsData?.data]);
  const simulationMapping = useMemo(
    () => reportsData?.simulation_mapping || {},
    [reportsData?.simulation_mapping],
  );

  // Extract pagination metadata from server response
  const page = reportsData?.page || 0;
  const pageSize = reportsData?.pageSize || 100;
  const totalPages = reportsData?.totalPages || 0;

  // Export state
  const [exportPopoverOpen, setExportPopoverOpen] = useState(false);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  const [brightspaceFormat, setBrightspaceFormat] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Table state (only UI state, not data state)
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    personaResponseTimes: false,
    stagnationRate: false,
    profileId: false,
    scenarios: false,
    simulations: false,
  });

  // Sync URL params for sorting
  const sortBy = searchParams.get("reportsSortBy") || "averageScore";
  const sortOrder = searchParams.get("reportsSortOrder") || "desc";
  const sorting: SortingState = useMemo(
    () => [{ id: sortBy, desc: sortOrder === "desc" }],
    [sortBy, sortOrder],
  );

  // Ref for the search input
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Local search state, initialized from URL
  const [searchTerm, setSearchTerm] = useState(
    searchParams.get("reportsSearch") || "",
  );

  // Ref to track debounce timeout for search
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Keep local state in sync if URL changes (back/forward, link, etc.)
  useEffect(() => {
    const urlSearch = searchParams.get("reportsSearch") || "";
    setSearchTerm(urlSearch);
  }, [searchParams]);

  // Whenever we have a searchTerm, keep the input focused
  useEffect(() => {
    if (!searchInputRef.current) return;
    if (!searchTerm) return; // don't auto-focus on completely empty state

    const el = searchInputRef.current;
    el.focus();
    const len = searchTerm.length;
    // put cursor at end of text
    try {
      el.setSelectionRange(len, len);
    } catch {
      // some browsers can be picky; ignore
    }
  }, [searchTerm]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Sync URL params for filters
  const reportsSearch = searchParams.get("reportsSearch") || "";
  const reportsProfileIdsParam = searchParams.get("reportsProfileIds");
  const reportsSimulationIdsParam = searchParams.get("reportsSimulationIds");
  const reportsScenarioIdsParam = searchParams.get("reportsScenarioIds");

  const reportsProfileIds = useMemo(
    () =>
      reportsProfileIdsParam
        ? reportsProfileIdsParam.split(",").filter(Boolean)
        : [],
    [reportsProfileIdsParam],
  );
  const reportsSimulationIds = useMemo(
    () =>
      reportsSimulationIdsParam
        ? reportsSimulationIdsParam.split(",").filter(Boolean)
        : [],
    [reportsSimulationIdsParam],
  );
  const reportsScenarioIds = useMemo(
    () =>
      reportsScenarioIdsParam
        ? reportsScenarioIdsParam.split(",").filter(Boolean)
        : [],
    [reportsScenarioIdsParam],
  );

  // Sync column filters with URL params (for DataTableFacetedFilter compatibility)
  const columnFilters: ColumnFiltersState = useMemo(() => {
    const filters: ColumnFiltersState = [];
    if (reportsProfileIds.length > 0) {
      filters.push({ id: "profileId", value: reportsProfileIds });
    }
    if (reportsSimulationIds.length > 0) {
      filters.push({ id: "simulations", value: reportsSimulationIds });
    }
    if (reportsScenarioIds.length > 0) {
      filters.push({ id: "scenarios", value: reportsScenarioIds });
    }
    return filters;
  }, [reportsProfileIds, reportsSimulationIds, reportsScenarioIds]);

  // Helper to update URL params (removes default values like updateHistoryParams)
  const updateURLParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === "") {
          params.delete(key);
        } else {
          // Remove default values from URL
          if (key === "reportsPage" && value === "0") {
            params.delete(key);
          } else if (key === "reportsPageSize" && value === "100") {
            params.delete(key);
          } else if (key === "reportsSortBy" && value === "averageScore") {
            params.delete(key);
          } else if (key === "reportsSortOrder" && value === "desc") {
            params.delete(key);
          } else {
            params.set(key, value);
          }
        }
      });
      router.push(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  // Commit search to URL (called on Enter or blur, or after debounce)
  const commitSearch = useCallback(
    (value: string) => {
      updateURLParams({
        reportsPage: "0",
        reportsSearch: value.trim() || null,
      });
    },
    [updateURLParams],
  );

  // Handle search input change with debounce
  const handleSearchChange = useCallback(
    (value: string) => {
      // Update local state immediately for responsive UI
      setSearchTerm(value);

      // Clear existing timeout
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      // If query becomes empty, commit immediately (no debounce)
      if (value === "") {
        commitSearch("");
        return;
      }

      // Otherwise, debounce the search (500ms delay)
      searchTimeoutRef.current = setTimeout(() => {
        commitSearch(value);
      }, 500);
    },
    [commitSearch],
  );

  // Options are now provided as props from server

  const simulations = useMemo(
    () =>
      Object.entries(simulationMapping).map(([id, simulation]) => ({
        id,
        title: simulation.name,
      })),
    [simulationMapping],
  );

  // Define columns using typeof pattern
  const columns: ColumnDef<(typeof profiles)[number]>[] = useMemo(() => {
    const formatValue = (
      metric: (typeof profiles)[number]["metrics"][keyof (typeof profiles)[number]["metrics"]],
    ): string => {
      if (!metric.hasData) return "N/A";
      if (metric.currentValue == null) return "N/A";
      return `${metric.currentValue}${metric.valueField === "percent" ? "%" : metric.valueField === "seconds" ? "s" : metric.valueField === "minutes" ? "m" : ""}`;
    };

    const getGradientClasses = (status: string | undefined): string => {
      if (status === "success")
        return "bg-gradient-to-br from-success/10 to-success/5 dark:from-success/20 dark:to-success/10 border-success/30";
      if (status === "warning")
        return "bg-gradient-to-br from-warning/10 to-warning/5 dark:from-warning/20 dark:to-warning/10 border-warning/30";
      if (status === "danger")
        return "bg-gradient-to-br from-destructive/10 to-destructive/5 dark:from-destructive/20 dark:to-destructive/10 border-destructive/30";
      return "bg-gradient-to-br from-muted to-muted/50 dark:from-muted dark:to-muted/50 border-border";
    };

    const getTextClasses = (status: string | undefined): string => {
      if (status === "success") return "text-success";
      if (status === "warning") return "text-warning";
      if (status === "danger") return "text-destructive";
      return "text-muted-foreground";
    };

    const getHoverBullets = (
      metricKey: string,
      profile: (typeof profiles)[number],
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
              `Mode: ${hover["mode"]}%`,
            );
          }
          break;
        case "highestScore":
          if (Array.isArray(hover["top"])) {
            bullets.push(
              ...hover["top"].map((v, i) => `${i + 1}. ${v}%`).slice(0, 3),
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
              `Rate: ${hover["percent"]}%`,
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
              `Rate: ${hover["percent"]}%`,
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
              `Chats counted: ${hover["count"]}`,
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
              `Samples: ${hover["samples"]}`,
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
              `Efficiency: ${hover["efficiency"]}`,
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
              `Rate: ${hover["ratePercent"]}%`,
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
              `Avg time spent: ${hover["avgOverallMinutes"]}m`,
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
              title={`${displayName}${(profile.emails && profile.emails.length > 0) || profile.primaryEmail ? ` (${profile.emails && profile.emails.length > 0 ? profile.emails.join(", ") : profile.primaryEmail || ""})` : ""} - Click to view detailed report`}
              data-testid={`reports-profile-row-${profile.profileId}`}
            >
              <div className="flex flex-col items-start min-w-0 w-full">
                <span
                  className="text-xs font-medium truncate w-full"
                  title={displayName}
                >
                  {displayName}
                </span>
                {((profile.emails && profile.emails.length > 0) ||
                  profile.primaryEmail) && (
                  <span
                    className="text-xs text-muted-foreground truncate w-full"
                    title={
                      profile.emails && profile.emails.length > 0
                        ? profile.emails.join(", ")
                        : profile.primaryEmail || ""
                    }
                  >
                    {profile.emails && profile.emails.length > 0
                      ? profile.emails.join(", ")
                      : profile.primaryEmail || ""}
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
          const gradientClasses = getGradientClasses(metric.status);
          const textClasses = getTextClasses(metric.status);
          const bullets = getHoverBullets("averageScore", profile);
          const content = (
            <div
              className={`text-center px-1 py-0.5 rounded text-xs font-medium ${gradientClasses} ${textClasses}`}
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
          const gradientClasses = getGradientClasses(metric.status);
          const textClasses = getTextClasses(metric.status);
          const bullets = getHoverBullets("highestScore", profile);
          const content = (
            <div
              className={`text-center px-1 py-0.5 rounded text-xs font-medium ${gradientClasses} ${textClasses}`}
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
          const gradientClasses = getGradientClasses(metric.status);
          const textClasses = getTextClasses(metric.status);
          const bullets = getHoverBullets("completionPercentage", profile);
          const content = (
            <div
              className={`text-center px-1 py-0.5 rounded text-xs font-medium ${gradientClasses} ${textClasses}`}
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
          const gradientClasses = getGradientClasses(metric.status);
          const textClasses = getTextClasses(metric.status);
          const bullets = getHoverBullets("firstAttemptPassRate", profile);
          const content = (
            <div
              className={`text-center px-1 py-0.5 rounded text-xs font-medium ${gradientClasses} ${textClasses}`}
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
          const gradientClasses = getGradientClasses(metric.status);
          const textClasses = getTextClasses(metric.status);
          const bullets = getHoverBullets("messagesPerSession", profile);
          const content = (
            <div
              className={`text-center px-1 py-0.5 rounded text-xs font-medium flex items-center justify-center gap-0.5 ${gradientClasses} ${textClasses}`}
            >
              <MessageCircle className={`h-2.5 w-2.5 ${textClasses}`} />
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
          const gradientClasses = getGradientClasses(metric.status);
          const textClasses = getTextClasses(metric.status);
          const bullets = getHoverBullets("personaResponseTimes", profile);
          const content = (
            <div
              className={`text-center px-1 py-0.5 rounded text-xs font-medium flex items-center justify-center gap-0.5 ${gradientClasses} ${textClasses}`}
            >
              <Clock className={`h-2.5 w-2.5 ${textClasses}`} />
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
          const gradientClasses = getGradientClasses(metric.status);
          const textClasses = getTextClasses(metric.status);
          const bullets = getHoverBullets("sessionEfficiency", profile);
          const content = (
            <div
              className={`text-center px-1 py-0.5 rounded text-xs font-medium ${gradientClasses} ${textClasses}`}
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
          const gradientClasses = getGradientClasses(metric.status);
          const textClasses = getTextClasses(metric.status);
          const bullets = getHoverBullets("stagnationRate", profile);
          const content = (
            <div
              className={`text-center px-1 py-0.5 rounded text-xs font-medium ${gradientClasses} ${textClasses}`}
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
          const gradientClasses = getGradientClasses(metric.status);
          const textClasses = getTextClasses(metric.status);
          const bullets = getHoverBullets("timeSpent", profile);
          const content = (
            <div
              className={`text-center px-1 py-0.5 rounded text-xs font-medium flex items-center justify-center gap-0.5 ${gradientClasses} ${textClasses}`}
            >
              <Timer className={`h-2.5 w-2.5 ${textClasses}`} />
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
          const gradientClasses = getGradientClasses(metric.status);
          const textClasses = getTextClasses(metric.status);
          const bullets = getHoverBullets("totalAttempts", profile);
          const content = (
            <div
              className={`text-center px-1 py-0.5 rounded text-xs font-medium flex items-center justify-center gap-0.5 ${gradientClasses} ${textClasses}`}
            >
              <Target className={`h-2.5 w-2.5 ${textClasses}`} />
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

  // Create table instance (server-driven, no client-side filtering/sorting/pagination)
  const table = useReactTable({
    data: profiles,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters, // Synced with URL params for UI display
      pagination: {
        pageIndex: page,
        pageSize: pageSize,
      },
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: (updater) => {
      // Update URL params when sorting changes
      const newSorting =
        typeof updater === "function" ? updater(sorting) : updater;
      if (newSorting.length > 0 && newSorting[0]) {
        const sort = newSorting[0];
        updateURLParams({
          reportsSortBy: sort.id,
          reportsSortOrder: sort.desc ? "desc" : "asc",
          reportsPage: "0", // Reset to first page on sort change
        });
      }
    },
    onColumnFiltersChange: (updater) => {
      // Update URL params when column filters change
      const newFilters =
        typeof updater === "function" ? updater(columnFilters) : updater;
      const profileFilter = newFilters.find((f) => f.id === "profileId");
      const simulationFilter = newFilters.find((f) => f.id === "simulations");
      const scenarioFilter = newFilters.find((f) => f.id === "scenarios");

      updateURLParams({
        reportsProfileIds:
          profileFilter &&
          Array.isArray(profileFilter.value) &&
          profileFilter.value.length > 0
            ? profileFilter.value.join(",")
            : null,
        reportsSimulationIds:
          simulationFilter &&
          Array.isArray(simulationFilter.value) &&
          simulationFilter.value.length > 0
            ? simulationFilter.value.join(",")
            : null,
        reportsScenarioIds:
          scenarioFilter &&
          Array.isArray(scenarioFilter.value) &&
          scenarioFilter.value.length > 0
            ? scenarioFilter.value.join(",")
            : null,
        reportsPage: "0", // Reset to first page on filter change
      });
    },
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: (updater) => {
      // Update URL params when pagination changes
      const currentPagination = { pageIndex: page, pageSize: pageSize };
      const newPagination =
        typeof updater === "function" ? updater(currentPagination) : updater;
      updateURLParams({
        reportsPage: String(newPagination.pageIndex),
        reportsPageSize: String(newPagination.pageSize),
      });
    },
    getCoreRowModel: getCoreRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    manualPagination: true, // Server-driven pagination
    manualSorting: true, // Server-driven sorting
    manualFiltering: true, // Server-driven filtering
    pageCount: totalPages,
  });

  // Table rows are just the profiles (already filtered/sorted/paginated by server)
  // With manualSorting: true, react-table should preserve the exact order from the data prop
  // The table object already depends on profiles (via data prop), so we don't need to include it here
  const tableRows = useMemo(() => {
    return table.getRowModel().rows;
  }, [table]);

  // Get visible columns for skeleton rows (matches actual rendered columns)
  const visibleColumns = table.getVisibleLeafColumns();

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
        ? table.getSelectedRowModel().rows
        : table.getRowModel().rows;

    return selectedRowsData.map((row) => row.original.profileId);
  };

  const getSelectedSimulationIds = (): string[] => {
    // Get from URL params (server-side filter)
    return reportsSimulationIds || [];
  };

  const getSelectedScenarioIds = (): string[] => {
    // Get from URL params (server-side filter)
    return reportsScenarioIds || [];
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
          errorData.message || errorData.error || "Failed to export data",
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
        `Exported ${profileIds.length} ${profileIds.length === 1 ? "row" : "rows"} successfully`,
      );
      setExportPopoverOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to export data",
      );
    } finally {
      setIsExporting(false);
    }
  };

  const isExportDisabled =
    isExporting || (brightspaceFormat && selectedMetrics.length === 0);

  // Get column references for toolbar
  const profileIdColumn = table.getColumn("profileId");
  const scenariosColumn = table.getColumn("scenarios");
  const simulationsColumn = table.getColumn("simulations");
  const isFiltered =
    reportsSearch !== "" ||
    (reportsProfileIds && reportsProfileIds.length > 0) ||
    (reportsSimulationIds && reportsSimulationIds.length > 0) ||
    (reportsScenarioIds && reportsScenarioIds.length > 0);

  return (
    <div className="space-y-6" data-testid="reports-table-container">
      <div className="space-y-2">
        {/* Toolbar */}
        <Popover open={exportPopoverOpen} onOpenChange={setExportPopoverOpen}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div className="flex flex-col md:flex-row md:flex-1 md:items-center md:space-x-2 gap-2 md:gap-0">
              {/* Mobile: Wrap search and export button in 50/50 flex */}
              <div className="flex gap-2 w-full md:w-auto md:flex-initial">
                <Input
                  ref={searchInputRef}
                  placeholder="Search profiles by name or email..."
                  value={searchTerm}
                  onChange={(event) => {
                    handleSearchChange(event.target.value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      // Clear timeout and commit immediately
                      if (searchTimeoutRef.current) {
                        clearTimeout(searchTimeoutRef.current);
                      }
                      commitSearch(event.currentTarget.value);
                    }
                  }}
                  onBlur={(event) => {
                    // Clear timeout and commit immediately on blur
                    if (searchTimeoutRef.current) {
                      clearTimeout(searchTimeoutRef.current);
                    }
                    // Commit on blur so URL stays in sync
                    if (
                      event.currentTarget.value !==
                      (searchParams.get("reportsSearch") || "")
                    ) {
                      commitSearch(event.currentTarget.value);
                    }
                  }}
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

              <div className="flex items-center space-x-2 flex-wrap">
                {isLoading ? (
                  <>
                    {/* Skeleton filters - show typical filter layout */}
                    <Skeleton className="h-8 w-[120px]" />
                    <Skeleton className="h-8 w-[140px]" />
                    <Skeleton className="h-8 w-[160px]" />
                  </>
                ) : (
                  <>
                    {/* Name Filter */}
                    {profileIdColumn && profileOptions.length > 0 && (
                      <DataTableFacetedFilter
                        column={profileIdColumn}
                        title="Name"
                        options={profileOptions}
                        isServerDriven={true}
                      />
                    )}

                    {/* Scenario Filter */}
                    {scenariosColumn && scenarioOptions.length > 0 && (
                      <DataTableFacetedFilter
                        column={scenariosColumn}
                        title="Scenario"
                        options={scenarioOptions}
                        isServerDriven={true}
                      />
                    )}

                    {/* Simulation Filter */}
                    {simulationsColumn && simulationOptions.length > 0 && (
                      <DataTableFacetedFilter
                        column={simulationsColumn}
                        title="Simulation"
                        options={simulationOptions}
                        isServerDriven={true}
                      />
                    )}
                  </>
                )}

                {isFiltered && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      updateURLParams({
                        reportsSearch: null,
                        reportsProfileIds: null,
                        reportsSimulationIds: null,
                        reportsScenarioIds: null,
                        reportsPage: "0",
                      });
                    }}
                    className="h-8 px-2 lg:px-3 hidden md:flex"
                  >
                    Reset
                    <X className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2">
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
              <DataTableViewOptions
                table={table}
                hiddenColumns={["simulations"]}
              />
            </div>
          </div>
          {/* Shared Popover Content */}
          <PopoverContent className="w-96 p-4" align="end">
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="grid gap-2">
                  <GenericPicker
                    items={EXPORT_METRICS}
                    selectedIds={selectedMetrics}
                    onSelect={setSelectedMetrics}
                    getId={(item) => item.value}
                    getLabel={(item) => item.label}
                    getSearchText={(item) => `${item.label} ${item.description || ""}`}
                    renderPreview={(item) => (
                      <div className="grid gap-2">
                        <h4 className="font-medium leading-none">{item.label || "No metric selected"}</h4>
                        <div className="text-sm text-muted-foreground">
                          {item.description || "No description available"}
                        </div>
                      </div>
                    )}
                    renderItem={(item, _isSelected) => {
                      const IconComponent = item.icon;
                      return (
                        <div className="flex items-center gap-3 w-full">
                          <div className="p-2 rounded-lg shadow-sm flex-shrink-0 bg-primary/10 border border-transparent group-data-[selected=true]:bg-primary/20 group-data-[selected=true]:border-primary-foreground">
                            <IconComponent className="h-4 w-4 text-primary group-data-[selected=true]:text-primary-foreground stroke-current" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{item.label}</div>
                            {item.description && (
                              <div className="text-sm text-muted-foreground truncate group-data-[selected=true]:text-primary-foreground group-data-[highlighted=true]:text-primary-foreground">
                                {item.description}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }}
                    renderButton={(selectedItems) => {
                      const firstMetric = selectedItems[0];
                      const IconComponent = firstMetric?.icon;
                      return (
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {firstMetric && IconComponent && (
                            <div className="p-1 rounded-md shadow-sm flex-shrink-0 bg-primary/10">
                              <IconComponent className="h-3.5 w-3.5 text-primary" />
                            </div>
                          )}
                          <span className="truncate">
                            {selectedMetrics.length === 0
                              ? brightspaceFormat
                                ? "Choose at least one metric..."
                                : "All metrics selected"
                              : selectedMetrics.length === 1
                                ? firstMetric?.label || "Select metrics to export..."
                                : `${selectedMetrics.length} selected`}
                          </span>
                        </div>
                      );
                    }}
                    renderChip={(item, onRemove) => {
                      const IconComponent = item.icon;
                      return (
                        <div className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-md text-sm">
                          <IconComponent className="h-3 w-3" />
                          <span>{item.label}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemove();
                            }}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    }}
                    placeholder={
                      brightspaceFormat
                        ? "Choose at least one metric..."
                        : selectedMetrics.length === 0
                          ? "All metrics selected"
                          : "Select metrics to export..."
                    }
                    multiSelect={true}
                    hideSelectedChips={false}
                    buttonClassName="w-full"
                    groupHeading="Metrics"
                    showLabel={true}
                    label="Metrics"
                    description="Choose one or more metrics to include in the export."
                  />
                </div>

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
                            header.getContext(),
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              // Skeleton rows while data is loading - match visible columns
              Array.from({ length: pageSize || 10 }).map((_, i) => (
                <TableRow key={`skeleton-${i}`} className="h-6">
                  {visibleColumns.map((column) => {
                    const id = column.id;

                    if (id === "select") {
                      return (
                        <TableCell
                          key={id}
                          className="border-r px-2 py-1 w-12 text-center"
                        >
                          <Skeleton className="h-4 w-4 rounded-sm" />
                        </TableCell>
                      );
                    }

                    if (id === "profileName") {
                      return (
                        <TableCell
                          key={id}
                          className="border-r px-2 py-1 text-left"
                        >
                          <Skeleton className="h-4 w-32" />
                        </TableCell>
                      );
                    }

                    // Default skeleton for metric columns
                    return (
                      <TableCell
                        key={id}
                        className="border-r px-2 py-1 text-center"
                      >
                        <Skeleton className="h-4 w-12 mx-auto" />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : tableRows?.length ? (
              tableRows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="h-6 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() =>
                    router.push(
                      `/analytics/reports/p/${row.original.profileId}`,
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
                          cell.getContext(),
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
      {isLoading ? (
        <div className="flex items-center px-2">
          {/* Mobile skeleton layout */}
          <div className="flex items-center flex-1 md:hidden">
            <div className="flex items-center space-x-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-[85px]" />
            </div>
            <div className="flex-1 flex items-center justify-center">
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="flex items-center space-x-2">
              <Skeleton className="h-8 w-8 rounded-md" />
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
          </div>
          {/* Desktop skeleton layout */}
          <div className="hidden md:flex items-center justify-between w-full">
            <div className="flex-1"></div>
            <div className="flex items-center space-x-6 lg:space-x-8">
              <div className="flex items-center space-x-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-[85px]" />
              </div>
              <Skeleton className="h-4 w-[100px]" />
              <div className="flex items-center space-x-2">
                <Skeleton className="h-8 w-8 rounded-md hidden lg:block" />
                <Skeleton className="h-8 w-8 rounded-md" />
                <Skeleton className="h-8 w-8 rounded-md" />
                <Skeleton className="h-8 w-8 rounded-md hidden lg:block" />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <DataTablePagination table={table} staff={true} />
      )}
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
                  <TableCell className="w-12 text-center px-2 py-1">
                    <Skeleton className="h-4 w-4" />
                  </TableCell>
                  <TableCell className="px-2 py-1">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <Skeleton className="h-4 w-48" />
                    </div>
                  </TableCell>
                  <TableCell className="text-center px-2 py-1">
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell className="text-center px-2 py-1">
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell className="text-center px-2 py-1">
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell className="text-center px-2 py-1">
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell className="text-center px-2 py-1">
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell className="text-center px-2 py-1">
                    <Skeleton className="h-4 w-28" />
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
