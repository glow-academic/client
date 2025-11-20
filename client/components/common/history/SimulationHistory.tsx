/**
 * SimulationHistory.tsx
 * Used to display the simulation history page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */

import type {
  BulkArchiveAttemptsIn,
  BulkArchiveAttemptsOut,
} from "@/app/(main)/analytics/dashboard/page";
import { DataTableColumnHeader } from "@/components/common/table/DataTableColumnHeader";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Column, ColumnDef, Row } from "@tanstack/react-table";
import { Infinity as InfinityIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { DataTable } from "./DataTable";
import { DataTableRowActions } from "./DataTableRowActions";

// New data structure for history items
export interface HistoryDataItem {
  attemptId: string;
  date: Date;
  profileId: string;
  profileName: string;
  simulationName: string;
  numScenarios: number | null; // nullable for infinite mode
  numScenariosCompleted: number;
  infiniteMode: boolean;
  timeLimit: number | null; // simulation time limit in seconds (from server)
  personaNames: string[];
  personaColors: string[];
  score: number | null; // nullable
  simulation_id: string;
  department_id: string;
  scenario_ids: string[];
  scenario_titles: string[] | undefined;
  isArchived: boolean;
  showView: boolean;
  showContinue: boolean;
  practiceSimulation?: boolean; // Needed for routing to /practice/ vs /home/
  passPct: number; // Pass percentage threshold for this simulation
  cohortNames: string[];
  practiceScenarioId?: string; // first scenario_id from attempt (for practice retry)
}

export interface SimulationHistoryProps {
  // Required: Array of history data items
  data: HistoryDataItem[];

  // Required: Total count for pagination (when using server-driven pagination)
  totalCount: number;

  // Required: Current page index (0-based)
  pageIndex: number;

  // Required: Current page size
  pageSize: number;

  // Required: Whether to show export functionality
  showExport: boolean;

  // Required: Whether to show archive functionality
  showArchive: boolean;

  // Optional: Whether to hide Name column when all attempts have the same profile
  singleProfile?: boolean;

  // Optional: Whether to show loading state
  isLoading?: boolean;

  // Optional: Server action for bulk archiving attempts (only needed when showArchive is true)
  bulkArchiveAttemptsAction?: (
    input: BulkArchiveAttemptsIn
  ) => Promise<BulkArchiveAttemptsOut>;

  // Optional: Server action for revalidating attempts (for redirect after retry/continue)
  revalidateAttemptAction?: (attemptId: string) => Promise<void>;

  // Optional: Initial filters for history (for filter options only)
  initialFilters?: {
    startDate: string;
    endDate: string;
    cohortIds: string[];
    departmentIds: string[];
    roles: string[];
  };

  // Required: Filter options (from server - all available options, not just current page)
  profileOptions: Array<{ value: string; label: string; count?: number }>;
  simulationOptions: Array<{ value: string; label: string; count?: number }>;
  scenarioOptions: Array<{ value: string; label: string; count?: number }>;
}

export default function SimulationHistory({
  data,
  totalCount,
  pageIndex,
  pageSize,
  showExport,
  showArchive,
  singleProfile = false,
  isLoading = false,
  bulkArchiveAttemptsAction,
  revalidateAttemptAction,
  initialFilters: _initialFilters,
  profileOptions,
  simulationOptions,
  scenarioOptions,
}: SimulationHistoryProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initialize state from URL search params
  const [searchTerm, setSearchTerm] = React.useState(
    searchParams?.get("historySearch") || ""
  );

  // Use deferred value for search to reduce re-renders
  const deferredSearchTerm = React.useDeferredValue(searchTerm);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = React.useState(
    searchParams?.get("historySearch") || ""
  );

  // Debounce search term (300ms delay) - use deferred value
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(deferredSearchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [deferredSearchTerm]);

  // Initialize column filters from URL search params
  const [columnFilters, setColumnFilters] = React.useState<
    Array<{ id: string; value: unknown }>
  >(() => {
    const filters: Array<{ id: string; value: unknown }> = [];
    const profileIds = searchParams?.get("historyProfileIds");
    if (profileIds) {
      filters.push({
        id: "profileId",
        value: profileIds.split(",").filter(Boolean),
      });
    }
    const simulationIds = searchParams?.get("historySimulationIds");
    if (simulationIds) {
      filters.push({
        id: "simulationId",
        value: simulationIds.split(",").filter(Boolean),
      });
    }
    const scenarioIds = searchParams?.get("historyScenarioIds");
    if (scenarioIds) {
      filters.push({
        id: "scenarios",
        value: scenarioIds.split(",").filter(Boolean),
      });
    }
    const infiniteMode = searchParams?.get("historyInfiniteMode");
    if (infiniteMode) {
      filters.push({
        id: "infiniteMode",
        value: infiniteMode === "true" ? ["infinite"] : ["standard"],
      });
    }
    return filters;
  });

  // Initialize sorting from URL search params
  const [sorting, setSorting] = React.useState<
    Array<{ id: string; desc: boolean }>
  >(() => {
    const sortBy = searchParams?.get("historySortBy") || "date";
    const sortOrder = searchParams?.get("historySortOrder") || "desc";
    return [
      {
        id: sortBy,
        desc: sortOrder === "desc",
      },
    ];
  });

  // Helper function to update URL search params (preserves analytics filters)
  const updateHistoryParams = React.useCallback(
    (updates: {
      page?: number;
      pageSize?: number;
      search?: string;
      profileIds?: string[];
      simulationIds?: string[];
      scenarioIds?: string[];
      infiniteMode?: boolean | undefined;
      sortBy?: string;
      sortOrder?: string;
    }) => {
      const params = new URLSearchParams(searchParams?.toString() || "");

      // Update pagination
      if (updates.page !== undefined) {
        if (updates.page === 0) {
          params.delete("historyPage");
        } else {
          params.set("historyPage", updates.page.toString());
        }
      }
      if (updates.pageSize !== undefined) {
        if (updates.pageSize === 10) {
          params.delete("historyPageSize");
        } else {
          params.set("historyPageSize", updates.pageSize.toString());
        }
      }

      // Update search
      if (updates.search !== undefined) {
        if (!updates.search) {
          params.delete("historySearch");
        } else {
          params.set("historySearch", updates.search);
        }
      }

      // Update filters
      if (updates.profileIds !== undefined) {
        if (!updates.profileIds.length) {
          params.delete("historyProfileIds");
        } else {
          params.set("historyProfileIds", updates.profileIds.join(","));
        }
      }
      if (updates.simulationIds !== undefined) {
        if (!updates.simulationIds.length) {
          params.delete("historySimulationIds");
        } else {
          params.set("historySimulationIds", updates.simulationIds.join(","));
        }
      }
      if (updates.scenarioIds !== undefined) {
        if (!updates.scenarioIds.length) {
          params.delete("historyScenarioIds");
        } else {
          params.set("historyScenarioIds", updates.scenarioIds.join(","));
        }
      }
      if (updates.infiniteMode !== undefined) {
        params.set(
          "historyInfiniteMode",
          updates.infiniteMode ? "true" : "false"
        );
      } else {
        // If infiniteMode is explicitly undefined, don't change the param
      }

      // Update sorting
      if (updates.sortBy !== undefined && updates.sortOrder !== undefined) {
        if (updates.sortBy === "date" && updates.sortOrder === "desc") {
          params.delete("historySortBy");
          params.delete("historySortOrder");
        } else {
          params.set("historySortBy", updates.sortBy);
          params.set("historySortOrder", updates.sortOrder);
        }
      }

      const newUrl = `${pathname}${params.toString() ? `?${params.toString()}` : ""}`;
      router.replace(newUrl, { scroll: false });
    },
    [searchParams, pathname, router]
  );

  // Update URL when debounced search term changes (keeps historySearch in sync)
  React.useEffect(() => {
    // Reset to page 0 when search changes, then update URL with new search term
    updateHistoryParams({ page: 0, search: debouncedSearchTerm });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchTerm]);

  // Check if all attempts have the same profileId (only when singleProfile is true)
  const allSameProfile = React.useMemo(() => {
    if (!singleProfile || data.length === 0) {
      return false;
    }

    const firstProfileId = data[0]?.profileId;
    if (!firstProfileId) {
      return false;
    }

    return data.every((item) => item.profileId === firstProfileId);
  }, [data, singleProfile]);

  // Filter profile options if all attempts have the same profile (hide Name filter when singleProfile is true)
  const filteredProfileOptions = React.useMemo(() => {
    if (allSameProfile) return [];
    return profileOptions;
  }, [allSameProfile, profileOptions]);

  // Create mode options (infinite, standard)
  const infiniteModeOptions = React.useMemo(() => {
    const hasInfinite = data.some((item) => item.infiniteMode);
    const hasStandard = data.some((item) => !item.infiniteMode);
    const options: { value: string; label: string }[] = [];
    if (hasInfinite)
      options.push({ value: "infinite", label: "Infinite Mode" });
    if (hasStandard)
      options.push({ value: "standard", label: "Standard Mode" });
    return options;
  }, [data]);

  // Create column definitions that work with the new data structure
  const columns = React.useMemo(() => {
    const attemptColumns: ColumnDef<HistoryDataItem>[] = [
      // Search column (hidden, used for global search)
      {
        id: "search",
        enableHiding: true,
        enableSorting: false,
        filterFn: (row, _id, value) => {
          if (!value) return true;
          const searchValue = value.toLowerCase();
          const item = row.original;

          // Search in profile name
          if (item.profileName.toLowerCase().includes(searchValue)) {
            return true;
          }

          // Search in simulation name
          if (item.simulationName.toLowerCase().includes(searchValue)) {
            return true;
          }

          // Search in persona names
          if (
            item.personaNames.some((name) =>
              name.toLowerCase().includes(searchValue)
            )
          ) {
            return true;
          }

          return false;
        },
      },
      // Hidden faceting column for Name (IDs)
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
          // Additive filtering: keep row if profileId is in selected values
          return value.includes(profileId);
        },
      },
      // Hidden faceting column for Simulation (IDs)
      {
        accessorKey: "simulation_id",
        id: "simulationId",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        filterFn: (row, _id, value) => {
          if (!value || !Array.isArray(value) || value.length === 0)
            return true;
          const simulationId = row.original.simulation_id;
          // Additive filtering: keep row if simulationId is in selected values
          return value.includes(simulationId);
        },
      },
      // Hidden faceting column for Scenarios (IDs)
      {
        id: "scenarios",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        // Return the array of scenario IDs for this row
        accessorFn: (row: HistoryDataItem) => row.scenario_ids ?? [],
        // Let filtering check membership
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("scenarios") as string[]) ?? [];
          // keep row if it contains ANY selected scenario
          return value.some((v) => rowIds.includes(v));
        },
      },
      // Hidden faceting column for Mode (infinite, standard)
      {
        id: "infiniteMode",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: HistoryDataItem) => {
          return row.infiniteMode ? "infinite" : "standard";
        },
        filterFn: (row, _id, value: string[]) => {
          if (!value || value.length === 0) return true;
          const mode = row.original.infiniteMode ? "infinite" : "standard";
          // Additive filtering: keep row if mode is in selected values
          return value.includes(mode);
        },
      },
      // Date column
      {
        accessorKey: "date",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Date" />
        ),
        cell: ({ row }) => {
          const raw = row.getValue("date") as string; // <-- it's a string
          const date = new Date(raw); // <-- parse it

          if (Number.isNaN(date.getTime())) {
            return (
              <div className="text-sm text-muted-foreground">Invalid Date</div>
            );
          }

          const day = String(date.getDate()).padStart(2, "0");
          const month = String(date.getMonth() + 1).padStart(2, "0");
          const year = String(date.getFullYear()).slice(-2);
          const time = date.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });

          const isArchived = row.original.isArchived;

          return (
            <div className="flex items-center justify-between">
              <div className="font-medium text-sm">
                <div>
                  {month}-{day}-{year}
                </div>
                <div className="text-xs text-muted-foreground">{time}</div>
              </div>
              {isArchived && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="w-2 h-2 rounded-full bg-red-500 ml-2" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Archived</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          );
        },
        enableSorting: true,
        sortDescFirst: true,
      },
      // User Name column - only show if not all attempts have the same profile
      ...(!allSameProfile
        ? [
            {
              accessorKey: "profileName",
              id: "profileName",
              header: ({
                column,
              }: {
                column: Column<HistoryDataItem, unknown>;
              }) => <DataTableColumnHeader column={column} title="Name" />,
              cell: ({ row }: { row: Row<HistoryDataItem> }) => {
                const profileName = row.original.profileName;
                return (
                  <div className="flex items-center min-w-0 max-w-[125px]">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="truncate">{profileName}</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{profileName}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                );
              },
              filterFn: (
                row: Row<HistoryDataItem>,
                _id: string,
                value: string[]
              ) => {
                return value.includes(row.original.profileId);
              },
              enableSorting: true,
            },
          ]
        : []),
      // Simulation column
      {
        accessorKey: "simulationName",
        id: "simulationName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Simulation" />
        ),
        cell: ({ row }) => {
          const simulationName = row.original.simulationName;
          const isInfinite = row.original.infiniteMode;

          return (
            <div className="flex items-center space-x-1 min-w-0 max-w-[160px]">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="truncate font-medium">{simulationName}</span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{simulationName}</p>
                </TooltipContent>
              </Tooltip>
              {isInfinite && (
                <InfinityIcon className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              )}
            </div>
          );
        },
        enableHiding: true,
        filterFn: (row, _id, value) => {
          if (!value || !Array.isArray(value) || value.length === 0)
            return true;

          const simulationId = row.original.simulation_id; // <-- use original
          return value.includes(simulationId);
        },
      },
      // Scenarios completion column
      {
        accessorKey: "numScenariosCompleted",
        id: "numScenariosCompleted",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Scenarios" />
        ),
        cell: ({ row }) => {
          // Use original for display so we don't show a ratio:
          const completedCount = row.original.numScenariosCompleted;
          const totalCount = row.original.numScenarios;
          const isInfinite = row.original.infiniteMode;

          return (
            <div className="text-center">
              <span className="font-medium inline-flex items-center gap-1">
                {completedCount}
                <span>/</span>
                {isInfinite ? (
                  <InfinityIcon className="h-3 w-3 text-muted-foreground" />
                ) : (
                  <span>{totalCount}</span>
                )}
              </span>
              <div className="text-xs text-muted-foreground">completed</div>
            </div>
          );
        },
        enableSorting: true,
        // Keep accessorFn solely to provide a sortable value (ratio)
        accessorFn: (row: HistoryDataItem) => {
          const total = row.numScenarios;
          if (total === null || total === 0) return 0;
          return row.numScenariosCompleted / total;
        },
        // scenario filtering should read from original
        filterFn: (row, _id, value) => {
          if (!value || value.length === 0) return true;
          const scenarioIds = row.original.scenario_ids || [];
          return value.some((scenarioId: string) =>
            scenarioIds.includes(scenarioId)
          );
        },
      },
      // Personas tested column
      {
        accessorKey: "personaNames",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Personas" />
        ),
        cell: ({ row }) => {
          const personaNames = row.getValue("personaNames") as string[];
          const personaColors = row.original.personaColors;

          if (
            !personaNames ||
            !Array.isArray(personaNames) ||
            personaNames.length === 0
          ) {
            return <span className="text-muted-foreground">None</span>;
          }

          return (
            <div className="flex flex-nowrap gap-1 overflow-x-auto max-w-[175px] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {personaNames.map((personaName, index) => {
                const baseHex = personaColors?.[index] || "#9CA3AF"; // gray-400 fallback

                // Simple color utility (you might want to use the more complex one from the original)
                const getBadgeColors = (hex: string) => {
                  // Simplified color logic - you can enhance this
                  return {
                    bg: `${hex}20`,
                    border: hex,
                    text: hex,
                  };
                };

                const { bg, border, text } = getBadgeColors(baseHex);

                return (
                  <Badge
                    key={index}
                    variant="outline"
                    className="text-xs"
                    style={{
                      backgroundColor: bg,
                      borderColor: border,
                      color: text,
                    }}
                  >
                    {personaName}
                  </Badge>
                );
              })}
            </div>
          );
        },
        filterFn: (row, id, value) => {
          const personaNames = row.getValue(id) as string[];
          if (!value || !Array.isArray(value) || value.length === 0)
            return true;
          return value.some((filterPersona: string) =>
            personaNames?.includes(filterPersona)
          );
        },
      },
      // Score column
      {
        accessorKey: "score",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Score" />
        ),
        // keep value as-is; do NOT coalesce to 0
        accessorFn: (row: HistoryDataItem) => row.score, // <-- no `|| 0`
        cell: ({ row }) => {
          const score = row.original.score; // <-- read original for display
          if (score === null) {
            return (
              <div className="text-muted-foreground text-center min-w-0 max-w-[100px]">
                Not graded
              </div>
            );
          }
          return (
            <div className="text-center min-w-0 max-w-[100px]">
              <Badge
                variant="outline"
                className={`text-xs font-semibold ${
                  score >= 80
                    ? "bg-green-100 text-green-800 border-green-300 hover:bg-green-200"
                    : score >= 70
                      ? "bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200"
                      : "bg-red-100 text-red-800 border-red-300 hover:bg-red-200"
                }`}
              >
                {score}%
              </Badge>
            </div>
          );
        },
        enableSorting: true,
        // Use original for filter buckets too so null stays null
        filterFn: (row, _, value) => {
          const score = (row.original as HistoryDataItem).score;
          if (score === null) return value.includes("not-graded");
          if (score >= 80) return value.includes("excellent");
          if (score >= 70) return value.includes("good");
          return value.includes("needs-improvement");
        },
      },
      // Actions column
      {
        id: "actions",
        cell: ({ row }) => {
          const item = row.original;

          return (
            <DataTableRowActions
              id={item.attemptId}
              profileId={item.profileId}
              simulationId={item.simulation_id}
              departmentId={item.department_id}
              scenarios={[]} // No need to pass scenarios anymore
              interactionIds={item.scenario_ids}
              isPractice={item.practiceSimulation || false}
              infiniteMode={item.infiniteMode}
              timeLimit={item.timeLimit ?? null}
              attemptCreatedAt={(() => {
                try {
                  const date = new Date(item.date);
                  return isNaN(date.getTime())
                    ? new Date().toISOString()
                    : date.toISOString();
                } catch {
                  return new Date().toISOString();
                }
              })()}
              canView={item.showView}
              canContinue={item.showContinue}
              archived={item.isArchived}
              showArchive={showArchive}
              {...(item.practiceScenarioId && {
                practiceScenarioId: item.practiceScenarioId,
              })}
              practiceSimulation={item.practiceSimulation ?? false}
              {...(revalidateAttemptAction && { revalidateAttemptAction })}
            />
          );
        },
      },
    ];

    return attemptColumns;
  }, [allSameProfile, showArchive, revalidateAttemptAction]);

  // Create a key based on the data to force re-render when data changes
  const tableKey = React.useMemo(() => {
    if (!data || data.length === 0) return "empty";
    return data.map((item) => item.attemptId).join("-");
  }, [data]);

  if (isLoading) {
    return <HistorySkeleton rows={10} />;
  }

  return (
    <DataTable
      key={tableKey}
      data={data}
      columns={columns as never}
      profileOptions={filteredProfileOptions}
      simulationOptions={simulationOptions}
      scenarioOptions={scenarioOptions}
      infiniteModeOptions={infiniteModeOptions}
      showExport={showExport}
      showArchive={showArchive}
      showAll={true} // Always show all since filtering is handled upstream
      isServerDriven={true}
      pageCount={Math.ceil(totalCount / pageSize)}
      paginationState={{ pageIndex, pageSize }}
      columnFiltersState={columnFilters}
      sortingState={sorting}
      onPaginationChange={(updater) => {
        const newPagination =
          typeof updater === "function"
            ? updater({ pageIndex, pageSize })
            : updater;
        updateHistoryParams({
          page: newPagination.pageIndex,
          pageSize: newPagination.pageSize,
        });
      }}
      onColumnFiltersChange={(updater) => {
        const newFilters =
          typeof updater === "function" ? updater(columnFilters) : updater;
        setColumnFilters(newFilters);

        // Extract filter values and update URL
        const profileIds = newFilters.find((f) => f.id === "profileId")
          ?.value as string[] | undefined;
        const simulationIds = newFilters.find((f) => f.id === "simulationId")
          ?.value as string[] | undefined;
        const scenarioIds = newFilters.find((f) => f.id === "scenarios")
          ?.value as string[] | undefined;
        const infiniteModeFilter = newFilters.find(
          (f) => f.id === "infiniteMode"
        )?.value as string[] | undefined;
        const infiniteMode: boolean | undefined =
          infiniteModeFilter && infiniteModeFilter.length > 0
            ? infiniteModeFilter.includes("infinite")
            : undefined;

        updateHistoryParams({
          profileIds: profileIds || [],
          simulationIds: simulationIds || [],
          scenarioIds: scenarioIds || [],
          ...(infiniteMode !== undefined && { infiniteMode }),
        });
      }}
      onSortingChange={(updater) => {
        const newSorting =
          typeof updater === "function" ? updater(sorting) : updater;
        setSorting(newSorting);

        const sortBy = newSorting[0]?.id || "date";
        const sortOrder = newSorting[0]?.desc ? "desc" : "asc";
        updateHistoryParams({ sortBy, sortOrder });
      }}
      onSearchChange={(value) => {
        setSearchTerm(value);
        // Debounce is handled by useEffect, but we need to update URL when debounced value changes
        // This will be handled by a separate effect that watches debouncedSearchTerm
      }}
      searchValue={searchTerm}
      {...(showArchive && bulkArchiveAttemptsAction
        ? { bulkArchiveAttemptsAction }
        : {})}
    />
  );
}

export function HistorySkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      {/* Toolbar skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex flex-1 items-center space-x-2">
          <Skeleton className="h-8 w-[250px]" /> {/* search */}
          <Skeleton className="h-8 w-[120px]" /> {/* Name filter */}
          <Skeleton className="h-8 w-[140px]" /> {/* Simulation filter */}
          <Skeleton className="h-8 w-[160px]" /> {/* Scenarios filter */}
          <Skeleton className="h-8 w-[70px]" /> {/* Reset */}
        </div>
        <div className="flex items-center space-x-2">
          <Skeleton className="h-8 w-[150px]" /> {/* Export / View */}
          <Skeleton className="h-8 w-[90px]" />
        </div>
      </div>

      {/* Table skeleton */}
      <div className="rounded-md border">
        {/* header */}
        <div className="grid grid-cols-6 gap-0 px-6 py-3 border-b">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-40 col-span-2" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16 justify-self-end" />
        </div>
        {/* rows */}
        <div className="divide-y">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="grid grid-cols-6 gap-0 px-6 py-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-[90%] col-span-2" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-4 w-10" />
              </div>
              <div className="flex items-center justify-end gap-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-8" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pagination skeleton */}
      <div className="flex items-center justify-end px-2">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-[70px]" />
          </div>
          <Skeleton className="h-4 w-24" />
          <div className="flex items-center space-x-2">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
          </div>
        </div>
      </div>
    </div>
  );
}
