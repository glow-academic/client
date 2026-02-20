/**
 * SimulationHistory.tsx
 * Used to display the simulation history page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */

"use client";

import type {
  BulkArchiveAttemptsIn,
  BulkArchiveAttemptsOut,
} from "@/app/(main)/analytics/dashboard/page";
import { DataTableColumnHeader } from "@/components/common/table/DataTableColumnHeader";
import { DataTableFacetedFilter } from "@/components/common/table/DataTableFacetedFilter";
import { DataTablePagination } from "@/components/common/table/DataTablePagination";
import { DataTableViewOptions } from "@/components/common/table/DataTableViewOptions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useProfile } from "@/contexts/profile-context";
import { useSocket } from "@/contexts/socket-context";
import {
  Column,
  ColumnDef,
  ColumnFiltersState,
  Row,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  useReactTable,
} from "@tanstack/react-table";
import {
  Archive,
  ArrowRight,
  Infinity as InfinityIcon,
  RotateCcw,
  Unlock,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { SingleProfileCertificateButton } from "./SingleProfileCertificateButton";

// Use strong server types directly
import type { components } from "@/lib/api/schema";
export type HistoryDataItem = components["schemas"]["HistoryItem"];

// Inlined row actions component (from DataTableRowActions)
function HistoryRowActions({
  item,
  emitStartSimulation,
}: {
  item: HistoryDataItem;
  emitStartSimulation: (data: {
    simulation_id: string;
    profile_id?: string | null;
    scenario_id?: string | null;
    infinite?: boolean;
    infinite_time_limit?: number | null;
  }) => void;
}) {
  const { profile } = useProfile();
  const { isConnected } = useSocket();
  const router = useRouter();
  const [isRetrying, setIsRetrying] = React.useState(false);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const loadingToastIdRef = React.useRef<string | number | null>(null);

  const isCurrentUser = profile?.id === item.profile_id;

  // Infinite-mode window check (owner-only)
  // Parse date from string (server returns ISO string)
  const attemptCreatedAt = React.useMemo(() => {
    try {
      // Server always returns date as string (ISO format)
      const dateStr = item.date as string;
      const date = new Date(dateStr);
      return isNaN(date.getTime())
        ? new Date().toISOString()
        : date.toISOString();
    } catch {
      return new Date().toISOString();
    }
  }, [item.date]);

  const isInfiniteWindowOpen = React.useMemo(() => {
    if (!item.infinite_mode) return false;
    if (!item.time_limit || !attemptCreatedAt) return true; // no limit => open
    const started = new Date(attemptCreatedAt).getTime();
    if (Number.isNaN(started)) return false;
    const elapsedMin = (Date.now() - started) / 60000;
    const timeLimitMinutes = (item.time_limit ?? 0) / 60; // Convert from seconds to minutes
    return elapsedMin <= timeLimitMinutes;
  }, [item.infinite_mode, item.time_limit, attemptCreatedAt]);

  // Final decision:
  // - Continue only if server says it CAN continue,
  // - and it's the owner,
  // - and (if infinite mode) the time window is still open.
  const wantContinue =
    Boolean(item.show_continue) &&
    isCurrentUser &&
    (!item.infinite_mode || isInfiniteWindowOpen);

  const buttonText = wantContinue ? "Continue" : "View";
  const linkHref = `/attempt/${item.attempt_id}`;

  const isOwnAttempt = profile?.id === item.profile_id;
  const shouldShowRetry =
    isOwnAttempt &&
    (item.simulation_id ?? "") !== "" &&
    !item.show_continue;
  const shouldShowTry =
    !isOwnAttempt && (item.simulation_id ?? "") !== "";

  // Set up redirect listener for simulation started events
  React.useEffect(() => {
    const handleSimulationStarted = async (event: CustomEvent) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (loadingToastIdRef.current) {
        toast.dismiss(loadingToastIdRef.current);
        loadingToastIdRef.current = null;
      }
      setIsRetrying(false);
      const { attemptId } = event.detail;
      // Server-side Redis cache is already invalidated by the WebSocket handler
      router.refresh(); // Refresh current page data so it's updated when user returns
      router.push(`/attempt/${attemptId}`);
    };

    const handleSimulationError = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (loadingToastIdRef.current) {
        toast.dismiss(loadingToastIdRef.current);
        loadingToastIdRef.current = null;
      }
      setIsRetrying(false);
      toast.error("Failed to start simulation. Please try again.");
    };

    window.addEventListener(
      "simulationStarted",
      handleSimulationStarted as unknown as EventListener,
    );
    window.addEventListener("simulationError", handleSimulationError);

    return () => {
      window.removeEventListener(
        "simulationStarted",
        handleSimulationStarted as unknown as EventListener,
      );
      window.removeEventListener("simulationError", handleSimulationError);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [router, item.attempt_id]);

  const handleStartSimulation = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isConnected) return;
    setIsRetrying(true);

    // Show loading toast for redirect flow
    const toastId = toast.loading("Starting simulation...", {
      dismissible: true,
    });
    loadingToastIdRef.current = toastId;

    // Set timeout for simulation start
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      toast.dismiss(toastId);
      toast.error("Simulation start timed out. Please try again.");
      loadingToastIdRef.current = null;
      setIsRetrying(false);
    }, 30000);

    try {
      const profileIdForEmit = String(profile?.id || "");
      // practice_scenario_id only exists on practice endpoint
      const isPractice = "practice_simulation" in item && item.practice_simulation;
      const practiceScenarioId = "practice_scenario_id" in item ? item.practice_scenario_id : null;
      emitStartSimulation({
        simulation_id: String(item.simulation_id),
        profile_id: profileIdForEmit,
        scenario_id: isPractice && practiceScenarioId ? practiceScenarioId : null,
        ...(item.infinite_mode ? { infinite: true } : {}),
      });
    } catch {
      if (loadingToastIdRef.current) {
        toast.dismiss(loadingToastIdRef.current);
        loadingToastIdRef.current = null;
      }
      setIsRetrying(false);
      toast.error("Failed to start simulation. Please try again.");
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Link href={linkHref}>
        <Button
          variant="outline"
          size="sm"
          className={`h-8${wantContinue ? " min-w-[96px]" : ""}`}
        >
          {buttonText}
        </Button>
      </Link>

      {/* Retry: show when attempt belongs to current profile */}
      {shouldShowRetry && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Retry"
              className="h-8 w-8 inline-flex items-center justify-center border-input bg-background hover:bg-accent hover:text-accent-foreground"
              disabled={isRetrying}
              onClick={handleStartSimulation}
            >
              <RotateCcw
                className={`h-4 w-4 ${isRetrying ? "animate-spin" : ""}`}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Retry</p>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Start Simulation: show when attempt belongs to different profile and not emulating */}
      {shouldShowTry && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Start Simulation"
              className="h-8 w-8 inline-flex items-center justify-center border-input bg-background hover:bg-accent hover:text-accent-foreground"
              disabled={isRetrying}
              onClick={handleStartSimulation}
            >
              <ArrowRight
                className={`h-4 w-4 ${isRetrying ? "animate-spin" : ""}`}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Try Simulation</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

export interface SimulationHistoryProps {
  // Required: Array of history data items
  data: HistoryDataItem[];

  // Required: Total count for pagination (when using server-driven pagination)
  totalCount: number;

  // Required: Archived count for filtered set (from server)
  archivedCount: number;

  // Required: Unarchived count for filtered set (from server)
  unarchivedCount: number;

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

  // Optional: Whether to hide the Name column (defaults to false, meaning show by default)
  hideName?: boolean;

  // Optional: Whether to show loading state
  isLoading?: boolean;

  // Optional: Server action for bulk archiving attempts (only needed when showArchive is true)
  bulkArchiveAttemptsAction?: (
    input: BulkArchiveAttemptsIn,
  ) => Promise<BulkArchiveAttemptsOut>;

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

  // Optional: whether to show the infinite/standard mode filter
  showModeFilter?: boolean;

  // Optional: whether to show the customize button (for practice mode)
  showCustomize?: boolean;

  // Optional: Server-driven filter search terms (for faceted filter dropdowns)
  profileSearch?: string;
  simulationSearch?: string;
  scenarioSearch?: string;
}

export default function SimulationHistory({
  data,
  totalCount,
  archivedCount: serverArchivedCount,
  unarchivedCount: serverUnarchivedCount,
  pageIndex,
  pageSize,
  showExport,
  showArchive,
  singleProfile: _singleProfile = false,
  hideName = false,
  isLoading = false,
  bulkArchiveAttemptsAction,
  initialFilters: _initialFilters,
  profileOptions,
  simulationOptions,
  scenarioOptions,
  showModeFilter = true,
  showCustomize = false,
  profileSearch = "",
  simulationSearch = "",
  scenarioSearch = "",
}: SimulationHistoryProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { socket, isConnected } = useSocket();

  // Register socket listeners for simulation events
  React.useEffect(() => {
    if (!socket) return;

    const handleStarted = (data: {
      success: boolean;
      message: string;
      attempt_id?: string;
    }) => {
      if (data.success) {
        toast.success(data.message);
        window.dispatchEvent(
          new CustomEvent("simulationStarted", {
            detail: { attemptId: data.attempt_id },
          })
        );
      } else {
        toast.error(data.message);
      }
    };

    const handleStartError = (data: { message: string }) => {
      toast.error(data.message);
      window.dispatchEvent(new CustomEvent("simulationError"));
    };

    const handleError = (data: { message: string }) => {
      toast.error(data.message);
      window.dispatchEvent(new CustomEvent("simulationError"));
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = socket as any;
    s.on("simulation_started", handleStarted);
    s.on("simulation_start_error", handleStartError);
    s.on("simulation_error", handleError);

    return () => {
      s.off("simulation_started", handleStarted);
      s.off("simulation_start_error", handleStartError);
      s.off("simulation_error", handleError);
    };
  }, [socket]);

  const emitStartSimulation = React.useCallback(
    (data: {
      simulation_id: string;
      profile_id?: string | null;
      scenario_id?: string | null;
      infinite?: boolean;
      infinite_time_limit?: number | null;
    }) => {
      if (!socket || !isConnected) {
        toast.error("WebSocket not connected. Please refresh the page.");
        return;
      }
      const payload: Record<string, unknown> = {
        simulation_id: data.simulation_id,
        ...(data.scenario_id !== undefined && {
          scenario_id: data.scenario_id,
        }),
        ...(data.infinite !== undefined && { infinite: data.infinite }),
        ...(data.infinite_time_limit !== undefined && {
          infinite_time_limit: data.infinite_time_limit,
        }),
        ...(data.profile_id ? { profile_id: data.profile_id } : {}),
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (socket as any).emit("simulation_start", payload);
    },
    [socket, isConnected]
  );

  // Ref for the root search bar
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);

  // Local search state, initialized from URL
  const [searchTerm, setSearchTerm] = React.useState(
    searchParams?.get("historySearch") || "",
  );

  // Ref to track debounce timeout for search
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Local state for faceted filter searches (following Personas pattern)
  const [localProfileSearch, setLocalProfileSearch] = React.useState(profileSearch);
  const [localSimulationSearch, setLocalSimulationSearch] = React.useState(simulationSearch);
  const [localScenarioSearch, setLocalScenarioSearch] = React.useState(scenarioSearch);
  const profileSearchTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const simulationSearchTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const scenarioSearchTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep local state in sync if URL changes (back/forward, link, etc.)
  React.useEffect(() => {
    const urlSearch = searchParams?.get("historySearch") || "";
    setSearchTerm(urlSearch);
  }, [searchParams]);

  // Keep faceted filter search state in sync with URL changes
  React.useEffect(() => { setLocalProfileSearch(profileSearch); }, [profileSearch]);
  React.useEffect(() => { setLocalSimulationSearch(simulationSearch); }, [simulationSearch]);
  React.useEffect(() => { setLocalScenarioSearch(scenarioSearch); }, [scenarioSearch]);

  // Whenever we have a searchTerm, keep the input focused
  React.useEffect(() => {
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

  // Cleanup timeouts on unmount
  React.useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      if (profileSearchTimeoutRef.current) {
        clearTimeout(profileSearchTimeoutRef.current);
      }
      if (simulationSearchTimeoutRef.current) {
        clearTimeout(simulationSearchTimeoutRef.current);
      }
      if (scenarioSearchTimeoutRef.current) {
        clearTimeout(scenarioSearchTimeoutRef.current);
      }
    };
  }, []);

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

  // Table state
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({
      search: false,
      profileId: false,
      simulationId: false,
      scenarios: false,
      infiniteMode: false,
    });

  // State for archive dialog
  const [showArchiveDialog, setShowArchiveDialog] = React.useState(false);
  const [archiveAction, setArchiveAction] = React.useState<boolean | null>(
    null,
  );
  const [isArchiving, setIsArchiving] = React.useState(false);
  // State to track if "Select All Rows" is active (all filtered rows selected)
  const [isSelectAllActive, setIsSelectAllActive] = React.useState(false);

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
      profileSearchTerm?: string;
      simulationSearchTerm?: string;
      scenarioSearchTerm?: string;
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
          updates.infiniteMode ? "true" : "false",
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

      // Update filter search terms
      if (updates.profileSearchTerm !== undefined) {
        if (!updates.profileSearchTerm) {
          params.delete("historyProfileSearch");
        } else {
          params.set("historyProfileSearch", updates.profileSearchTerm);
        }
      }
      if (updates.simulationSearchTerm !== undefined) {
        if (!updates.simulationSearchTerm) {
          params.delete("historySimulationSearch");
        } else {
          params.set("historySimulationSearch", updates.simulationSearchTerm);
        }
      }
      if (updates.scenarioSearchTerm !== undefined) {
        if (!updates.scenarioSearchTerm) {
          params.delete("historyScenarioSearch");
        } else {
          params.set("historyScenarioSearch", updates.scenarioSearchTerm);
        }
      }

      const newUrl = `${pathname}${params.toString() ? `?${params.toString()}` : ""}`;
      router.replace(newUrl, { scroll: false });
    },
    [searchParams, pathname, router],
  );

  // Commit search to URL (called on Enter or blur, or after debounce)
  const commitSearch = React.useCallback(
    (value: string) => {
      updateHistoryParams({
        page: 0,
        search: value.trim() || "",
      });
    },
    [updateHistoryParams],
  );

  // Handle search input change with debounce
  const handleSearchChange = React.useCallback(
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

  // Debounced handlers for faceted filter searches (300ms, following Personas pattern)
  const handleProfileSearchChange = React.useCallback(
    (value: string) => {
      setLocalProfileSearch(value);
      if (profileSearchTimeoutRef.current) {
        clearTimeout(profileSearchTimeoutRef.current);
      }
      profileSearchTimeoutRef.current = setTimeout(() => {
        updateHistoryParams({ profileSearchTerm: value });
      }, 300);
    },
    [updateHistoryParams],
  );

  const handleSimulationSearchChange = React.useCallback(
    (value: string) => {
      setLocalSimulationSearch(value);
      if (simulationSearchTimeoutRef.current) {
        clearTimeout(simulationSearchTimeoutRef.current);
      }
      simulationSearchTimeoutRef.current = setTimeout(() => {
        updateHistoryParams({ simulationSearchTerm: value });
      }, 300);
    },
    [updateHistoryParams],
  );

  const handleScenarioSearchChange = React.useCallback(
    (value: string) => {
      setLocalScenarioSearch(value);
      if (scenarioSearchTimeoutRef.current) {
        clearTimeout(scenarioSearchTimeoutRef.current);
      }
      scenarioSearchTimeoutRef.current = setTimeout(() => {
        updateHistoryParams({ scenarioSearchTerm: value });
      }, 300);
    },
    [updateHistoryParams],
  );

  // Filter profile options - always return available options for filter visibility
  const filteredProfileOptions = React.useMemo(() => {
    return profileOptions;
  }, [profileOptions]);

  // Create mode options (infinite, standard)
  const infiniteModeOptions = React.useMemo(() => {
    const hasInfinite = data.some((item) => item.infinite_mode);
    const hasStandard = data.some((item) => !item.infinite_mode);
    const options: { value: string; label: string }[] = [];
    if (hasInfinite)
      options.push({ value: "infinite", label: "Infinite Mode" });
    if (hasStandard)
      options.push({ value: "standard", label: "Standard Mode" });
    return options;
  }, [data]);

  // Helper functions to normalize id and archived fields
  const getRowId = (item: unknown) => {
    const obj = item as Record<string, unknown>;
    return String(obj["id"] ?? obj["attemptId"] ?? "");
  };

  const getArchived = (item: unknown) => {
    const obj = item as Record<string, unknown>;
    return Boolean(obj["archived"] ?? obj["isArchived"] ?? false);
  };

  // Handle bulk archive
  const handleBulkArchive = React.useCallback(async (archive: boolean) => {
    setArchiveAction(archive);
    setShowArchiveDialog(true);
  }, []);

  // Handle column filters change
  const handleColumnFiltersChange = React.useCallback(
    (
      updater:
        | ColumnFiltersState
        | ((prev: ColumnFiltersState) => ColumnFiltersState),
    ) => {
      const newFilters =
        typeof updater === "function" ? updater(columnFilters) : updater;
      setColumnFilters(newFilters);

      // Extract filter values and update URL
      const profileIds = newFilters.find((f) => f.id === "profileId")?.value as
        | string[]
        | undefined;
      const simulationIds = newFilters.find((f) => f.id === "simulationId")
        ?.value as string[] | undefined;
      const scenarioIds = newFilters.find((f) => f.id === "scenarios")
        ?.value as string[] | undefined;
      const infiniteModeFilter = newFilters.find((f) => f.id === "infiniteMode")
        ?.value as string[] | undefined;
      const infiniteMode: boolean | undefined =
        infiniteModeFilter && infiniteModeFilter.length > 0
          ? infiniteModeFilter.includes("infinite")
          : undefined;

      updateHistoryParams({
        page: 0,
        profileIds: profileIds || [],
        simulationIds: simulationIds || [],
        scenarioIds: scenarioIds || [],
        ...(infiniteMode !== undefined && { infiniteMode }),
      });
    },
    [columnFilters, updateHistoryParams],
  );

  // Handle sorting change
  const handleSortingChange = React.useCallback(
    (updater: SortingState | ((prev: SortingState) => SortingState)) => {
      const newSorting =
        typeof updater === "function" ? updater(sorting) : updater;
      setSorting(newSorting);

      const sortBy = newSorting[0]?.id || "date";
      const sortOrder = newSorting[0]?.desc ? "desc" : "asc";

      // Reset to page 0 whenever sort changes
      updateHistoryParams({
        page: 0,
        sortBy,
        sortOrder,
      });
    },
    [sorting, updateHistoryParams],
  );

  // Handle pagination change
  const handlePaginationChange = React.useCallback(
    (
      updater:
        | { pageIndex: number; pageSize: number }
        | ((prev: { pageIndex: number; pageSize: number }) => {
            pageIndex: number;
            pageSize: number;
          }),
    ) => {
      const newPagination =
        typeof updater === "function"
          ? updater({ pageIndex, pageSize })
          : updater;
      updateHistoryParams({
        page: newPagination.pageIndex,
        pageSize: newPagination.pageSize,
      });
    },
    [pageIndex, pageSize, updateHistoryParams],
  );

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
          if (item.profile_name?.toLowerCase().includes(searchValue)) {
            return true;
          }

          // Search in simulation name
          if (item.simulation_name?.toLowerCase().includes(searchValue)) {
            return true;
          }

          // Search in persona names
          if (
            item.persona_names_junction?.some((name: string) =>
              name.toLowerCase().includes(searchValue),
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
          const profileId = row.original.profile_id;
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
          return row.infinite_mode ? "infinite" : "standard";
        },
        filterFn: (row, _id, value: string[]) => {
          if (!value || value.length === 0) return true;
          const mode = row.original.infinite_mode ? "infinite" : "standard";
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

          // is_archived only exists on dashboard/practice endpoints - defaults to false for home
          const isArchived = "is_archived" in row.original ? row.original.is_archived : false;

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
      // User Name column - only show if hideName is false
      ...(!hideName
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
                const profileName = row.original.profile_name || "";
                return (
                  <div className="flex items-center min-w-0 max-w-[200px]">
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
                value: string[],
              ) => {
                return value.includes(row.original.profile_id || "");
              },
              enableSorting: true,
            },
          ]
        : []),
      // Simulation column
      {
        accessorKey: "simulation_name",
        id: "simulationName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Simulation" />
        ),
        cell: ({ row }) => {
          const simulationName = row.original.simulation_name || "";
          const isInfinite = row.original.infinite_mode;

          return (
            <div className="flex items-center space-x-1 min-w-0 max-w-[280px]">
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
        accessorKey: "num_scenarios_completed",
        id: "numScenariosCompleted",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Scenarios" />
        ),
        cell: ({ row }) => {
          // Use original for display so we don't show a ratio:
          const completedCount = row.original.num_scenarios_completed || 0;
          const totalCount = row.original.num_scenarios || 0;
          const isInfinite = row.original.infinite_mode;
          const personaNames = row.original.persona_names_junction || [];
          const personaColors = row.original.persona_colors_junction || [];

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
              {/* Persona dots */}
              {personaNames &&
                Array.isArray(personaNames) &&
                personaNames.length > 0 && (
                  <div className="flex items-center justify-center gap-1 mt-1.5">
                    {personaNames.map((personaName, index) => {
                      const personaColor = personaColors?.[index] || "#9CA3AF"; // gray-400 fallback

                      return (
                        <Tooltip key={index}>
                          <TooltipTrigger asChild>
                            <div
                              className="w-2 h-2 rounded-full cursor-pointer"
                              style={{
                                backgroundColor: personaColor,
                              }}
                              aria-label={personaName}
                            />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{personaName}</p>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                )}
            </div>
          );
        },
        enableSorting: true,
        // Keep accessorFn solely to provide a sortable value (ratio)
        accessorFn: (row: HistoryDataItem) => {
          const total = row.num_scenarios ?? 0;
          if (total === 0) return 0;
          return (row.num_scenarios_completed ?? 0) / total;
        },
        // scenario filtering should read from original
        filterFn: (row, _id, value) => {
          if (!value || value.length === 0) return true;
          const scenarioIds = row.original.scenario_ids || [];
          return value.some((scenarioId: string) =>
            scenarioIds.includes(scenarioId),
          );
        },
      },
      // Hidden faceting column for Personas (for filtering)
      {
        id: "personaNames",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: HistoryDataItem) => row.persona_names_junction ?? [],
        filterFn: (row, id, value) => {
          const personaNames = row.getValue(id) as string[];
          if (!value || !Array.isArray(value) || value.length === 0)
            return true;
          return value.some((filterPersona: string) =>
            personaNames?.includes(filterPersona),
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
          const scoreStatus = row.original.score_status; // <-- read server-computed status
          if (score === null || score === undefined) {
            return (
              <div className="text-muted-foreground text-center min-w-0 max-w-[100px]">
                Not graded
              </div>
            );
          }
          // Use server-computed status for badge styling - map to shadcn color tokens
          const badgeClassName =
            scoreStatus === "high"
              ? "bg-success/10 text-success border-success/30 hover:bg-success/20"
              : scoreStatus === "medium"
                ? "bg-warning/10 text-warning border-warning/30 hover:bg-warning/20"
                : scoreStatus === "low"
                  ? "bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20"
                  : ""; // fallback to default badge styling if status is null
          return (
            <div className="text-center min-w-0 max-w-[100px]">
              <Badge
                variant="outline"
                className={`text-xs font-semibold ${badgeClassName}`}
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
          if (score === null || score === undefined)
            return value.includes("not-graded");
          if (score >= 80) return value.includes("excellent");
          if (score >= 70) return value.includes("good");
          return value.includes("needs-improvement");
        },
      },
      // Actions column - inlined from DataTableRowActions
      {
        id: "actions",
        cell: ({ row }) => {
          const item = row.original;
          return <HistoryRowActions item={item} emitStartSimulation={emitStartSimulation} />;
        },
      },
    ];

    return attemptColumns;
  }, [hideName, emitStartSimulation]);

  // Add checkbox column when showArchive is true
  const columnsWithCheckbox = React.useMemo(() => {
    if (!showArchive) return columns;

    const checkboxColumn: ColumnDef<HistoryDataItem> = {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => {
            if (value) {
              // select just the current page
              table.toggleAllPageRowsSelected(true);
            } else {
              // clear *all* selection, not only the page
              table.resetRowSelection();
            }
          }}
          aria-label="Select all"
          className="translate-y-[2px]"
        />
      ),
      cell: ({ row }) => {
        return (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(val) => row.toggleSelected(!!val)}
            aria-label="Select row"
            className="translate-y-[2px]"
          />
        );
      },
      enableSorting: false,
      enableHiding: false,
    };

    return [checkboxColumn, ...columns];
  }, [columns, showArchive]);

  const table = useReactTable({
    data,
    columns: columnsWithCheckbox,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination: { pageIndex, pageSize },
    },
    enableRowSelection: showArchive,
    onRowSelectionChange: setRowSelection,
    onSortingChange: handleSortingChange,
    onColumnFiltersChange: handleColumnFiltersChange,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: handlePaginationChange,
    manualPagination: true,
    manualFiltering: true,
    manualSorting: true,
    pageCount: Math.ceil(totalCount / pageSize),
    getCoreRowModel: getCoreRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getRowId: (row, index) => getRowId(row) || String(index),
    initialState: {
      columnVisibility: {
        search: false,
        profileId: false,
        simulationId: false,
        scenarios: false,
        infiniteMode: false,
      },
    },
  });

  // Handle comprehensive reset (filters, search, sorting, pagination)
  const handleResetAll = React.useCallback(() => {
    // Reset table state
    table.resetColumnFilters();
    table.resetSorting();

    // Reset local state
    setColumnFilters([]);
    setSearchTerm("");
    setSorting([{ id: "date", desc: true }]);
    setLocalProfileSearch("");
    setLocalSimulationSearch("");
    setLocalScenarioSearch("");

    // Update URL with all reset values (preserve pageSize)
    updateHistoryParams({
      page: 0,
      search: "",
      profileIds: [],
      simulationIds: [],
      scenarioIds: [],
      infiniteMode: undefined,
      sortBy: "date",
      sortOrder: "desc",
      profileSearchTerm: "",
      simulationSearchTerm: "",
      scenarioSearchTerm: "",
    });
  }, [table, updateHistoryParams]);

  // Get visible columns for skeleton rows (matches actual rendered columns)
  const visibleColumns = table.getVisibleLeafColumns();

  // Memoize table rows to avoid calling getRowModel() multiple times and prevent re-render issues
  // Extract pagination primitives directly to avoid object reference issues
  const tablePageIndex = table.getState().pagination.pageIndex;
  const tablePageSize = table.getState().pagination.pageSize;
  // Stringify arrays for stable comparison (arrays are compared by reference)
  const sortingKey = JSON.stringify(sorting);
  const columnFiltersKey = JSON.stringify(columnFilters);
  const tableRows = React.useMemo(() => {
    return table.getRowModel().rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // Use JSON.stringify for arrays to ensure stable comparison (arrays are compared by reference)
    sortingKey,
    columnFiltersKey,
    data.length,
    // Use pagination primitives directly (not object references)
    tablePageIndex,
    tablePageSize,
  ]);

  // Extract row selection state for dependency tracking
  const rowSelectionState = table.getState().rowSelection;

  // Derive selectedAttempts from table selection (single source of truth)
  const selectedAttempts = React.useMemo(() => {
    return table
      .getSelectedRowModel()
      .flatRows.map((r) => getRowId(r.original));
  }, [table, rowSelectionState]); // eslint-disable-line react-hooks/exhaustive-deps

  // Calculate archive/unarchive counts from selected rows
  // When "Select All" is active, use server-provided counts for all filtered rows
  // Otherwise, count from selected rows on current page
  const { archiveCount, unarchiveCount } = React.useMemo(() => {
    // When "Select All" is active, use server-provided counts
    if (isSelectAllActive) {
      return {
        archiveCount: serverUnarchivedCount, // Unarchived count = can be archived
        unarchiveCount: serverArchivedCount, // Archived count = can be unarchived
      };
    }

    // Otherwise, count from selected rows (current page only)
    const selectedRows = table.getSelectedRowModel().flatRows;
    let a = 0,
      u = 0;
    for (const r of selectedRows) {
      if (getArchived(r.original)) u++;
      else a++;
    }
    return { archiveCount: a, unarchiveCount: u };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    table,
    rowSelectionState, // Needed to recalculate when selection changes
    isSelectAllActive,
    serverArchivedCount,
    serverUnarchivedCount,
  ]);

  // Execute bulk archive
  const executeBulkArchive = React.useCallback(async () => {
    if (archiveAction === null || !bulkArchiveAttemptsAction) return;

    setIsArchiving(true);
    try {
      let result;
      let countMessage: string;

      if (isSelectAllActive && _initialFilters) {
        // Filter-based bulk archive: archive all attempts matching current filters
        // Extract filters from URL params and initialFilters
        const historySearch = searchParams?.get("historySearch") || undefined;
        const historyProfileIds = searchParams?.get("historyProfileIds")
          ? searchParams.get("historyProfileIds")?.split(",").filter(Boolean)
          : undefined;
        const historySimulationIds = searchParams?.get("historySimulationIds")
          ? searchParams.get("historySimulationIds")?.split(",").filter(Boolean)
          : undefined;
        const historyScenarioIds = searchParams?.get("historyScenarioIds")
          ? searchParams.get("historyScenarioIds")?.split(",").filter(Boolean)
          : undefined;
        const historyInfiniteMode =
          searchParams?.get("historyInfiniteMode") === "true"
            ? true
            : searchParams?.get("historyInfiniteMode") === "false"
              ? false
              : undefined;

        // Determine simulationFilters based on pathname
        // Dashboard shows all types, home/practice might be different
        const simulationFilters =
          pathname?.includes("/dashboard") ||
          pathname?.includes("/analytics/dashboard")
            ? ["general", "practice", "archived"]
            : ["general", "practice"];

        result = await bulkArchiveAttemptsAction({
          body: {
            archived: archiveAction,
            attempt_ids: [], // Empty array means filter mode
            start_date: _initialFilters.startDate,
            end_date: _initialFilters.endDate,
            cohort_ids: _initialFilters.cohortIds || [],
            department_ids: _initialFilters.departmentIds || [],
            roles: _initialFilters.roles || [],
            simulation_filters: simulationFilters,
            search: historySearch || null,
            profile_ids_filter: historyProfileIds || [],
            simulation_ids: historySimulationIds || [],
            scenario_ids: historyScenarioIds || [],
            infinite_mode: historyInfiniteMode ?? null,
          },
        });

        // Use server-provided count for "Select All" operations
        countMessage = `${result.updated_count || 0} simulation attempt(s) ${archiveAction ? "archived" : "unarchived"} successfully`;
      } else {
        // AttemptIds-based bulk archive: archive specific attempts (backward compatible)
        const selectedRows = table.getSelectedRowModel().flatRows;
        const attemptsToUpdate = selectedRows
          .map((r) => r.original)
          .filter((item) => {
            const isArchived = getArchived(item);
            return archiveAction ? !isArchived : isArchived;
          })
          .map((item) => getRowId(item));

        if (attemptsToUpdate.length === 0) {
          setIsArchiving(false);
          return;
        }

        result = await bulkArchiveAttemptsAction({
          body: {
            archived: archiveAction,
            attempt_ids: attemptsToUpdate,
            start_date: null,
            end_date: null,
            cohort_ids: [],
            department_ids: [],
            roles: [],
            simulation_filters: [],
            search: null,
            profile_ids_filter: [],
            simulation_ids: [],
            scenario_ids: [],
            infinite_mode: null,
          },
        });

        countMessage = `${attemptsToUpdate.length} simulation attempt(s) ${archiveAction ? "archived" : "unarchived"} successfully`;
      }

      toast.success(countMessage);

      // Clear selection after success
      table.resetRowSelection();
      setIsSelectAllActive(false);
      setShowArchiveDialog(false);
      setArchiveAction(null);

      // Update URL with _refresh param to trigger analytics filter update and Suspense boundary re-render
      // The dashboard page uses _refresh param in historyKey to force re-fetch after mutations
      const params = new URLSearchParams(searchParams?.toString() || "");
      params.set("_refresh", Date.now().toString());
      const newUrl = `${pathname}${params.toString() ? `?${params.toString()}` : ""}`;
      router.replace(newUrl, { scroll: false });

      // Refresh the page to refetch data with updated archive status
      // The server action already calls revalidatePath and revalidateTag,
      // and the server endpoint invalidates Redis cache tags,
      // so router.refresh() will fetch fresh data from the server
      await router.refresh();
    } catch {
      toast.error("Failed to update simulation archive status");
    } finally {
      setIsArchiving(false);
    }
  }, [
    archiveAction,
    bulkArchiveAttemptsAction,
    router,
    table,
    isSelectAllActive,
    _initialFilters,
    searchParams,
    pathname,
  ]);

  // Toolbar state - check if any history filters/search/sorting are active
  const currentSortBy = sorting[0]?.id || "date";
  const currentSortOrder = sorting[0]?.desc ? "desc" : "asc";
  const isFiltered =
    table.getState().columnFilters.length > 0 ||
    searchTerm !== "" ||
    localProfileSearch !== "" ||
    localSimulationSearch !== "" ||
    localScenarioSearch !== "" ||
    currentSortBy !== "date" ||
    currentSortOrder !== "desc";
  const profileIdColumn = true ? table.getColumn("profileId") : null; // showAll is always true
  const simulationIdColumn = table.getColumn("simulationId");
  const scenariosColumn = table.getColumn("scenarios");
  const infiniteModeColumn = table.getColumn("infiniteMode");

  // Show mode filter only when flag is set, options are available, and not all 3 other filters are visible
  const visibleMainFiltersCount = React.useMemo(() => {
    let count = 0;
    if (profileIdColumn && filteredProfileOptions.length > 0) count++;
    if (simulationIdColumn && simulationOptions.length > 0) count++;
    if (scenariosColumn && scenarioOptions.length > 0) count++;
    return count;
  }, [
    profileIdColumn,
    filteredProfileOptions.length,
    simulationIdColumn,
    simulationOptions.length,
    scenariosColumn,
    scenarioOptions.length,
  ]);

  const shouldShowModeFilter =
    showModeFilter &&
    infiniteModeColumn &&
    infiniteModeOptions.length > 0 &&
    visibleMainFiltersCount < 3;

  // Detect if this is page selection vs filtered selection
  const pageCount = table.getRowModel().rows.length;
  const selectedCount = selectedAttempts.length;

  const isPageSelection =
    selectedCount > 0 &&
    selectedCount ===
      table.getRowModel().rows.filter((r) => r.getIsSelected()).length;

  // Use totalCount when "Select All" is active to show full scope
  // Otherwise, use pageCount for page selection, totalCount for cross-page selection
  const ofLabel = isSelectAllActive
    ? totalCount // Show total filtered count when "Select All" is active
    : isPageSelection
      ? pageCount
      : selectedCount > 0
        ? totalCount
        : pageCount;

  // Handle select all visible rows (for the "Select All Rows" button)
  const handleSelectAllVisibleRows = React.useCallback(() => {
    // Select all rows on current page and set "Select All" mode
    const visible = table.getFilteredRowModel().rows;
    const next: Record<string, boolean> = {};
    visible.forEach((r) => {
      next[r.id] = true;
    });
    table.setRowSelection(next);
    setIsSelectAllActive(true);
  }, [table]);

  // Reset "Select All" mode when selection changes manually
  React.useEffect(() => {
    if (isSelectAllActive) {
      const selectedRows = table.getSelectedRowModel().flatRows;
      const allRowsSelected =
        selectedRows.length === table.getFilteredRowModel().rows.length;
      // If not all rows on current page are selected, reset "Select All" mode
      if (!allRowsSelected) {
        setIsSelectAllActive(false);
      }
    }
  }, [rowSelectionState, isSelectAllActive, table]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div className="flex flex-col md:flex-row md:flex-1 md:items-center md:space-x-2 gap-2 md:gap-0 min-w-0">
          {/* Mobile: If showExport, wrap search and certificate button in 50/50 flex */}
          {showExport ? (
            <div className="flex gap-2 w-full md:w-auto md:flex-initial">
              <Input
                ref={searchInputRef}
                placeholder="Search by name, simulation, or scenarios..."
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
                    (searchParams?.get("historySearch") || "")
                  ) {
                    commitSearch(event.currentTarget.value);
                  }
                }}
                className="h-8 flex-1 md:w-[150px] lg:w-[250px]"
              />
              <div className="flex-1 md:hidden">
                <SingleProfileCertificateButton
                  table={table}
                  profileOptions={filteredProfileOptions}
                />
              </div>
            </div>
          ) : (
            <Input
              ref={searchInputRef}
              placeholder="Search by name, simulation, or scenarios..."
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
                  (searchParams?.get("historySearch") || "")
                ) {
                  commitSearch(event.currentTarget.value);
                }
              }}
              className="h-8 w-full md:w-[150px] lg:w-[250px]"
            />
          )}
          {/* Filters - separate row on mobile to prevent flicker */}
          {isLoading ? (
            <div className="flex items-center space-x-2 overflow-x-auto flex-nowrap min-w-0 max-w-[600px] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {/* Skeleton filters - show typical filter layout */}
              <Skeleton className="h-8 w-[120px]" />
              <Skeleton className="h-8 w-[140px]" />
              <Skeleton className="h-8 w-[160px]" />
              <Skeleton className="h-8 w-[100px] hidden md:block" />
            </div>
          ) : (
            <div className="flex items-center space-x-2 overflow-x-auto flex-nowrap min-w-0 max-w-[600px] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {/* Name filter - only show if profileId column exists and has options */}
              {profileIdColumn && filteredProfileOptions.length > 0 && (
                <DataTableFacetedFilter
                  column={profileIdColumn}
                  title="Name"
                  options={filteredProfileOptions}
                  isServerDriven={true}
                  onSearchChange={handleProfileSearchChange}
                  searchValue={localProfileSearch}
                />
              )}

              {/* Simulation filter */}
              {simulationIdColumn && simulationOptions.length > 0 && (
                <DataTableFacetedFilter
                  column={simulationIdColumn}
                  title="Simulation"
                  options={simulationOptions}
                  isServerDriven={true}
                  onSearchChange={handleSimulationSearchChange}
                  searchValue={localSimulationSearch}
                />
              )}

              {/* Scenarios filter */}
              {scenariosColumn && scenarioOptions.length > 0 && (
                <DataTableFacetedFilter
                  column={scenariosColumn}
                  title="Scenarios"
                  options={scenarioOptions}
                  isServerDriven={true}
                  onSearchChange={handleScenarioSearchChange}
                  searchValue={localScenarioSearch}
                />
              )}

              {/* Mode filter - only show when not all 3 other filters are visible */}
              {shouldShowModeFilter && (
                <DataTableFacetedFilter
                  column={infiniteModeColumn}
                  title="Mode"
                  options={infiniteModeOptions}
                />
              )}

              {isFiltered && (
                <Button
                  variant="ghost"
                  onClick={handleResetAll}
                  className="h-8 px-2 lg:px-3 hidden md:flex"
                >
                  Reset
                  <X className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {/* Select All Rows button - only show when showArchive is true, some rows are selected, but not all filtered */}
          {showArchive &&
            selectedAttempts.length > 0 &&
            selectedAttempts.length < totalCount &&
            !isSelectAllActive && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAllVisibleRows}
                className="h-8"
              >
                Select All Rows
              </Button>
            )}

          {/* Bulk archive buttons - only show when showArchive is true and items are selected */}
          {/* When "Select All" is active, show buttons if server counts > 0, otherwise show if selected rows have archivable/unarchivable items */}
          {showArchive &&
            (isSelectAllActive
              ? serverArchivedCount > 0 || serverUnarchivedCount > 0
              : selectedAttempts.length > 0) && (
              <>
                {archiveCount > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleBulkArchive(true)}
                    className="h-8"
                  >
                    <Archive className="mr-2 h-4 w-4" />
                    Archive {archiveCount} of {ofLabel}
                  </Button>
                )}
                {unarchiveCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkArchive(false)}
                    className="h-8"
                  >
                    <Unlock className="mr-2 h-4 w-4" />
                    Unarchive {unarchiveCount} of {ofLabel}
                  </Button>
                )}
              </>
            )}

          {/* Certificate button - only show on desktop when showExport is true (mobile is handled above in search area) */}
          {showExport && (
            <div className="hidden md:flex">
              <SingleProfileCertificateButton
                table={table}
                profileOptions={filteredProfileOptions}
              />
            </div>
          )}
          {/* Legacy practice customize button removed; customization is per simulation card */}
          <DataTableViewOptions table={table} />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      className="pl-6"
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
                <TableRow key={`skeleton-${i}`}>
                  {visibleColumns.map((column) => {
                    const id = column.id;

                    if (id === "select") {
                      return (
                        <TableCell key={id} className="px-6">
                          <Skeleton className="h-4 w-4 rounded-sm" />
                        </TableCell>
                      );
                    }

                    if (id === "date") {
                      return (
                        <TableCell key={id} className="px-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <Skeleton className="h-4 w-20 mb-1" />
                              <Skeleton className="h-3 w-12" />
                            </div>
                            <Skeleton className="h-2 w-2 rounded-full" />
                          </div>
                        </TableCell>
                      );
                    }

                    if (id === "profileName") {
                      return (
                        <TableCell key={id} className="px-6">
                          <Skeleton className="h-4 w-28" />
                        </TableCell>
                      );
                    }

                    if (id === "simulationName") {
                      return (
                        <TableCell key={id} className="px-6">
                          <div className="flex items-center gap-2">
                            <Skeleton className="h-4 w-40" />
                            <Skeleton className="h-3 w-3 rounded-full" />
                          </div>
                        </TableCell>
                      );
                    }

                    if (id === "numScenariosCompleted") {
                      return (
                        <TableCell key={id} className="px-6">
                          <div className="flex flex-col items-center gap-1">
                            <Skeleton className="h-4 w-16" />
                            <Skeleton className="h-3 w-20" />
                          </div>
                        </TableCell>
                      );
                    }

                    if (id === "score") {
                      return (
                        <TableCell key={id} className="px-6">
                          <div className="flex justify-center">
                            <Skeleton className="h-6 w-16 rounded-full" />
                          </div>
                        </TableCell>
                      );
                    }

                    if (id === "actions") {
                      return (
                        <TableCell key={id} className="px-6">
                          <div className="flex justify-end gap-2">
                            <Skeleton className="h-8 w-20 rounded-md" />
                            <Skeleton className="h-8 w-8 rounded-md" />
                          </div>
                        </TableCell>
                      );
                    }

                    // Fallback for any other column
                    return (
                      <TableCell key={id} className="px-6">
                        <Skeleton className="h-4 w-[70%]" />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : tableRows?.length ? (
              // Real data
              tableRows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-6">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              // Empty state
              <TableRow>
                <TableCell
                  colSpan={columnsWithCheckbox.length}
                  className="h-24 text-center px-6"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {isLoading ? (
        <div className="flex items-center px-2">
          {/* Mobile skeleton layout */}
          <div className="flex items-center flex-1 md:hidden">
            <div className="flex items-center space-x-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-[70px]" />
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
                <Skeleton className="h-8 w-[70px]" />
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
        <DataTablePagination table={table} />
      )}

      {/* Bulk Archive Confirmation Dialog */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {archiveAction
                ? `Archive ${archiveCount} Simulation Attempt${archiveCount > 1 ? "s" : ""}`
                : `Unarchive ${unarchiveCount} Simulation Attempt${unarchiveCount > 1 ? "s" : ""}`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {archiveAction
                ? `Are you sure you want to archive ${archiveCount} simulation attempt${archiveCount > 1 ? "s" : ""}? They will be hidden from the main simulation list but can be accessed through archived filters.`
                : `Are you sure you want to unarchive ${unarchiveCount} simulation attempt${unarchiveCount > 1 ? "s" : ""}? They will be visible again in the main simulation list.`}
              <br />
              <br />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isArchiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeBulkArchive}
              disabled={isArchiving}
              className={isArchiving ? "opacity-50 cursor-not-allowed" : ""}
            >
              {isArchiving ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Processing...
                </div>
              ) : archiveAction ? (
                "Archive"
              ) : (
                "Unarchive"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
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
