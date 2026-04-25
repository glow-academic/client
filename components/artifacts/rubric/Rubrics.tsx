/**
 * Rubrics.tsx
 * Used to display the rubrics page with server-side filtering.
 * Hybrid approach: department/simulation filters are server-driven,
 * passPercentage remains client-side.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";
import { Copy, Edit, Eye, FileCheck, Pencil, Star, Trash2, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import type {
  DeleteRubricIn,
  DeleteRubricOut,
  DuplicateRubricIn,
  DuplicateRubricOut,
  RubricsListOut,
  UpdateRubricIn,
  UpdateRubricOut,
} from "@/app/(main)/system/rubrics/page";
import TableRubric from "@/components/artifacts/rubric/TableRubric";
import { ThreePickerFilters } from "@/components/common/table/ThreePickerFilters";
import { DataTablePagination } from "@/components/common/table/DataTablePagination";
import { BulkDeleteDialog } from "@/components/common/forms/BulkDeleteDialog";
import { BulkEditDialog } from "@/components/common/forms/BulkEditDialog";
import { BulkEditFlagField } from "@/components/common/forms/BulkEditFlagField";
import { useProfile } from "@/contexts/profile-context";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useRubricAi } from "@/hooks/use-rubric-ai";

export interface RubricsProps {
  // Server-provided data (for server-side rendering)
  listData: RubricsListOut;
  // Server actions (replaces useMutation)
  duplicateRubricAction?: (
    input: DuplicateRubricIn,
  ) => Promise<DuplicateRubricOut>;
  deleteRubricAction?: (input: DeleteRubricIn) => Promise<DeleteRubricOut>;
  updateRubricAction?: (input: UpdateRubricIn) => Promise<UpdateRubricOut>;
  // Server-side pagination
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  // Server-side filter search terms
  departmentSearch: string;
  simulationSearch: string;
}

export default function Rubrics({
  listData: serverListData,
  duplicateRubricAction,
  deleteRubricAction,
  updateRubricAction,
  pageIndex,
  pageSize,
  totalCount,
  departmentSearch,
  simulationSearch,
}: RubricsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { profile } = useProfile();

  useRubricAi({
    onComplete: () => router.refresh(),
  });

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);

  // Local search state for debouncing
  const [searchTerm, setSearchTerm] = useState(
    searchParams?.get("search") ?? ""
  );
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Table state
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    eval_ids: false,
    simulations: false,
    departments: false,
    passPercentage: false,
  });
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(() => {
    const filters: ColumnFiltersState = [];
    const deptIds = searchParams?.getAll("departmentIds") ?? [];
    const simIds = searchParams?.getAll("simulationIds") ?? [];
    const evalIds = searchParams?.getAll("evalIds") ?? [];
    if (deptIds.length > 0) filters.push({ id: "departments", value: deptIds });
    if (simIds.length > 0) filters.push({ id: "simulations", value: simIds });
    if (evalIds.length > 0) filters.push({ id: "eval_ids", value: evalIds });
    return filters;
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: "name", desc: false },
  ]);

  // Use server-provided data directly
  const rubricsData = serverListData;

  const rubrics = useMemo(() => rubricsData?.rubrics || [], [rubricsData]);
  const standardGroups = useMemo(
    () => rubricsData?.standard_groups || [],
    [rubricsData],
  );
  const standards = useMemo(
    () => rubricsData?.standards || [],
    [rubricsData],
  );

  // Flag catalog (e.g. rubric_active) — used to reconstruct flag_ids on bulk edit.
  const flagOptions = useMemo(() => {
    return (rubricsData?.flag_filter?.options || [])
      .filter((opt): opt is typeof opt & { id: string; name: string } => !!opt.id && !!opt.name)
      .map((opt) => ({ id: opt.id!, name: opt.name!, type: opt.type ?? null }));
  }, [rubricsData?.flag_filter]);

  // Selection state
  const [selectedRubricIds, setSelectedRubricIds] = useState<string[]>([]);
  const selectedCount = selectedRubricIds.length;
  const selectedRubrics = useMemo(() => {
    return rubrics.filter((r) => r.rubric_id && selectedRubricIds.includes(r.rubric_id));
  }, [rubrics, selectedRubricIds]);
  const deletableRubrics = useMemo(
    () => selectedRubrics.filter((r) => r.can_delete),
    [selectedRubrics],
  );
  const nonDeletableRubrics = useMemo(
    () => selectedRubrics.filter((r) => !r.can_delete),
    [selectedRubrics],
  );
  const editableRubrics = useMemo(
    () => selectedRubrics.filter((r) => r.can_edit ?? true),
    [selectedRubrics],
  );

  const toggleSelection = useCallback((rubricId: string) => {
    setSelectedRubricIds((prev) =>
      prev.includes(rubricId) ? prev.filter((id) => id !== rubricId) : [...prev, rubricId]
    );
  }, []);
  const clearBulkSelection = useCallback(() => setSelectedRubricIds([]), []);
  const selectAllOnPage = useCallback(() => {
    const pageIds = rubrics.filter((r) => r.rubric_id).map((r) => r.rubric_id!);
    setSelectedRubricIds((prev) => Array.from(new Set([...prev, ...pageIds])));
  }, [rubrics]);
  const allPageSelected = useMemo(() => {
    const pageIds = rubrics.filter((r) => r.rubric_id).map((r) => r.rubric_id!);
    return pageIds.length > 0 && pageIds.every((id) => selectedRubricIds.includes(id));
  }, [rubrics, selectedRubricIds]);

  // Bulk delete state
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Bulk edit state
  const [showBulkEditDialog, setShowBulkEditDialog] = useState(false);
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [bulkEditActiveStatus, setBulkEditActiveStatus] = useState<boolean | null>(null);

  // Filter options from server-provided ListFilterSection
  const departmentOptions = useMemo(
    () =>
      (rubricsData?.department_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? undefined,
        }))
        .filter((opt) => opt.value && opt.label),
    [rubricsData?.department_filter]
  );

  const simulationOptions = useMemo(
    () =>
      (rubricsData?.simulation_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? undefined,
        }))
        .filter((opt) => opt.value && opt.label),
    [rubricsData?.simulation_filter]
  );

  const evalOptions = useMemo(
    () =>
      (rubricsData?.eval_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? undefined,
        }))
        .filter((opt) => opt.value && opt.label),
    [rubricsData?.eval_filter]
  );

  // Helper to update URL search params
  const updateRubricsParams = useCallback(
    (updates: {
      page?: number;
      pageSize?: number;
      search?: string;
      departmentIds?: string[];
      simulationIds?: string[];
      evalIds?: string[];
      departmentSearch?: string;
      simulationSearch?: string;
    }) => {
      const params = new URLSearchParams(searchParams?.toString() || "");

      if (updates.page !== undefined) {
        if (updates.page === 0) params.delete("page");
        else params.set("page", updates.page.toString());
      }

      if (updates.pageSize !== undefined) {
        if (updates.pageSize === 12) params.delete("pageSize");
        else params.set("pageSize", updates.pageSize.toString());
      }

      if (updates.search !== undefined) {
        if (updates.search === "") params.delete("search");
        else params.set("search", updates.search);
      }

      if (updates.departmentIds !== undefined) {
        params.delete("departmentIds");
        updates.departmentIds.forEach((id) => params.append("departmentIds", id));
      }

      if (updates.simulationIds !== undefined) {
        params.delete("simulationIds");
        updates.simulationIds.forEach((id) => params.append("simulationIds", id));
      }

      if (updates.evalIds !== undefined) {
        params.delete("evalIds");
        updates.evalIds.forEach((id) => params.append("evalIds", id));
      }

      if (updates.departmentSearch !== undefined) {
        if (updates.departmentSearch === "") params.delete("departmentSearch");
        else params.set("departmentSearch", updates.departmentSearch);
      }

      if (updates.simulationSearch !== undefined) {
        if (updates.simulationSearch === "") params.delete("simulationSearch");
        else params.set("simulationSearch", updates.simulationSearch);
      }

      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  // Commit search to URL
  const commitSearch = useCallback(
    (value: string) => {
      updateRubricsParams({ page: 0, search: value.trim() || "" });
    },
    [updateRubricsParams]
  );

  // Handle search input change with debounce
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchTerm(value);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (value === "") { commitSearch(""); return; }
      searchTimeoutRef.current = setTimeout(() => { commitSearch(value); }, 500);
    },
    [commitSearch]
  );

  const handleSearchBlur = useCallback(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    commitSearch(searchTerm);
  }, [commitSearch, searchTerm]);

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        commitSearch(searchTerm);
      }
    },
    [commitSearch, searchTerm]
  );

  // Handle filter option search changes (debounced)
  const departmentSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const simulationSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [localDepartmentSearch, setLocalDepartmentSearch] = useState(departmentSearch);
  const [localSimulationSearch, setLocalSimulationSearch] = useState(simulationSearch);

  const handleDepartmentSearchChange = useCallback(
    (value: string) => {
      setLocalDepartmentSearch(value);
      if (departmentSearchTimeoutRef.current) clearTimeout(departmentSearchTimeoutRef.current);
      departmentSearchTimeoutRef.current = setTimeout(() => {
        updateRubricsParams({ departmentSearch: value });
      }, 300);
    },
    [updateRubricsParams]
  );

  const handleSimulationSearchChange = useCallback(
    (value: string) => {
      setLocalSimulationSearch(value);
      if (simulationSearchTimeoutRef.current) clearTimeout(simulationSearchTimeoutRef.current);
      simulationSearchTimeoutRef.current = setTimeout(() => {
        updateRubricsParams({ simulationSearch: value });
      }, 300);
    },
    [updateRubricsParams]
  );

  // Sync column filters to URL when they change (only server-driven ones)
  const handleColumnFiltersChange = useCallback(
    (updater: ColumnFiltersState | ((prev: ColumnFiltersState) => ColumnFiltersState)) => {
      const newFilters = typeof updater === "function" ? updater(columnFilters) : updater;
      setColumnFilters(newFilters);

      const departmentFilter = newFilters.find((f) => f.id === "departments");
      const simulationFilter = newFilters.find((f) => f.id === "simulations");
      const evalFilter = newFilters.find((f) => f.id === "eval_ids");

      // Check if any server-driven filter actually changed
      const oldDepartmentFilter = columnFilters.find((f) => f.id === "departments");
      const oldSimulationFilter = columnFilters.find((f) => f.id === "simulations");
      const oldEvalFilter = columnFilters.find((f) => f.id === "eval_ids");

      const serverChanged =
        JSON.stringify(departmentFilter?.value) !== JSON.stringify(oldDepartmentFilter?.value) ||
        JSON.stringify(simulationFilter?.value) !== JSON.stringify(oldSimulationFilter?.value);
      const evalChanged =
        JSON.stringify(evalFilter?.value) !== JSON.stringify(oldEvalFilter?.value);

      if (serverChanged || evalChanged) {
        // We push evalIds into the URL too so deep-links survive a refresh,
        // even though the eval slot is client-faceted (no `eval_search` in
        // SearchRubricApiRequest, so server cannot filter on it).
        updateRubricsParams({
          page: 0,
          departmentIds: (departmentFilter?.value as string[]) || [],
          simulationIds: (simulationFilter?.value as string[]) || [],
          evalIds: (evalFilter?.value as string[]) || [],
        });
      }
    },
    [columnFilters, updateRubricsParams]
  );

  // Handle pagination change
  const handlePaginationChange = useCallback(
    (
      updater:
        | { pageIndex: number; pageSize: number }
        | ((prev: { pageIndex: number; pageSize: number }) => {
            pageIndex: number;
            pageSize: number;
          })
    ) => {
      const newPagination =
        typeof updater === "function"
          ? updater({ pageIndex, pageSize })
          : updater;
      updateRubricsParams({
        page: newPagination.pageIndex,
        pageSize: newPagination.pageSize,
      });
    },
    [pageIndex, pageSize, updateRubricsParams]
  );

  // Compute page count from total
  const pageCount = Math.ceil(totalCount / pageSize);

  // Column definitions for TanStack Table
  const columns = useMemo<ColumnDef<(typeof rubrics)[number]>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => row.getValue("name"),
      },
      // Hidden faceting column for Pass Percentage (client-only)
      {
        id: "passPercentage",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof rubrics)[number]) => {
          const percentage = row.pass_percentage ?? 0;
          if (percentage >= 0 && percentage <= 25) return "0-25";
          if (percentage >= 26 && percentage <= 50) return "26-50";
          if (percentage >= 51 && percentage <= 75) return "51-75";
          if (percentage >= 76 && percentage <= 100) return "76-100";
          return null;
        },
        filterFn: (row, _id, value: string[]) => {
          const percentage = row.original.pass_percentage ?? 0;
          return value.some((range) => {
            const [min, max] = range.split("-").map(Number);
            return (
              min !== undefined &&
              max !== undefined &&
              percentage >= min &&
              percentage <= max
            );
          });
        },
      },
      // Hidden faceting column for Simulation (server-driven; client filterFn
      // is harmless second-pass since server-filtered rows already match).
      {
        id: "simulations",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        enableColumnFilter: true,
        accessorFn: (row: (typeof rubrics)[number]) => row.simulation_ids ?? [],
        filterFn: (row, id, filterValue: string[]) =>
          !filterValue?.length || filterValue.some((v) => ((row.getValue(id) as string[]) ?? []).includes(v)),
      },
      // Hidden faceting column for Departments (server-driven)
      {
        id: "departments",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        enableColumnFilter: true,
        accessorFn: (row: (typeof rubrics)[number]) => row.department_ids ?? [],
        filterFn: (row, id, filterValue: string[]) =>
          !filterValue?.length || filterValue.some((v) => ((row.getValue(id) as string[]) ?? []).includes(v)),
      },
      // Hidden faceting column for Evals (client-faceted; SearchRubricApiRequest
      // has no eval_search/filter_eval_ids, so we filter purely on the client).
      {
        id: "eval_ids",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        enableColumnFilter: true,
        accessorFn: (row: (typeof rubrics)[number]) => row.eval_ids ?? [],
        filterFn: (row, id, filterValue: string[]) =>
          !filterValue?.length || filterValue.some((v) => ((row.getValue(id) as string[]) ?? []).includes(v)),
      },
    ],
    [],
  );

  // Create table instance - hybrid: manual for server filters, client filtering for passPercentage
  const table = useReactTable({
    data: rubrics,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination: {
        pageIndex,
        pageSize,
      },
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: handleColumnFiltersChange,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: handlePaginationChange,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    manualFiltering: false, // Client-side filtering for passPercentage on server-provided page
    pageCount,
  });

  // Memoize table rows
  const sortingKey = JSON.stringify(sorting);
  const columnFiltersKey = JSON.stringify(columnFilters);
  const tableRows = useMemo(() => {
    return table.getRowModel().rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortingKey, columnFiltersKey, rubrics.length, pageIndex, pageSize]);

  const handleDelete = async () => {
    if (!deleteItem || !deleteRubricAction) return;

    if (!profile?.id) {
      toast.error("Profile not loaded. Please refresh the page.");
      return;
    }

    setIsDeleting(true);
    try {
      await deleteRubricAction({
        body: { rubric_ids: [deleteItem.id], accept: true },
      });
      toast.success("Rubric deleted successfully");
      router.refresh();
    } catch {
      toast.error("Failed to delete rubric");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setDeleteItem(null);
    }
  };

  const handleDuplicate = async (rubric: (typeof rubrics)[number]) => {
    if (!rubric.can_duplicate || !duplicateRubricAction) {
      toast.error("This rubric cannot be duplicated");
      return;
    }

    if (!profile?.id) {
      toast.error("Profile not loaded. Please refresh the page.");
      return;
    }

    setIsDuplicating(rubric.rubric_id ?? null);
    try {
      await duplicateRubricAction({
        body: { rubric_id: rubric.rubric_id ?? "", accept: true },
      });
      toast.success(`Rubric "${rubric.name}" duplicated successfully`);
      router.refresh();
    } catch {
      toast.error("Failed to duplicate rubric");
    } finally {
      setIsDuplicating(null);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteItem({ id, name });
    setShowDeleteDialog(true);
  };

  const handleEdit = (id: string) => {
    router.push(`/system/rubrics/${id}`);
  };

  const handleBulkDelete = async () => {
    if (!deleteRubricAction || deletableRubrics.length === 0) return;
    setIsBulkDeleting(true);
    try {
      const ids = deletableRubrics.map((r) => r.rubric_id!);
      await deleteRubricAction({ body: { rubric_ids: ids, accept: true } });
      toast.success(`${ids.length} rubric(s) deleted successfully`);
      clearBulkSelection();
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete rubrics";
      toast.error(msg.replace(/^\d{3}\s*/, "") || "Failed to delete rubrics");
    } finally {
      setIsBulkDeleting(false);
      setShowBulkDeleteDialog(false);
    }
  };

  const handleBulkEdit = async () => {
    if (!updateRubricAction || editableRubrics.length === 0) return;

    const hasActiveChange = bulkEditActiveStatus !== null;
    if (!hasActiveChange) {
      toast.error("No changes selected");
      return;
    }

    const activeFlagId = flagOptions.find((f) => f.type === "rubric_active")?.id;

    setIsBulkEditing(true);
    try {
      const items = editableRubrics.map((r) => {
        let flag_ids: string[] | undefined;
        if (hasActiveChange) {
          const isActive = bulkEditActiveStatus;
          flag_ids = isActive && activeFlagId ? [activeFlagId] : [];
        }
        return {
          id: r.rubric_id!,
          ...(hasActiveChange && { flag_ids }),
        };
      });

      await updateRubricAction({ body: { rubrics: items } } as UpdateRubricIn);
      toast.success(`${items.length} rubric(s) updated successfully`);
      clearBulkSelection();
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update rubrics";
      toast.error(msg.replace(/^\d{3}\s*/, "") || "Failed to update rubrics");
    } finally {
      setIsBulkEditing(false);
      setShowBulkEditDialog(false);
    }
  };

  const openBulkEditDialog = () => {
    setBulkEditActiveStatus(null);
    setShowBulkEditDialog(true);
  };

  const renderRubricCard = (rubric: (typeof rubrics)[number]) => {
    const groupIds = rubric.standard_group_ids || [];
    let totalPoints = 0;
    let totalPassPoints = 0;

    groupIds.forEach((groupId) => {
      const group = standardGroups.find((g) => g.standard_group_id === groupId);
      if (group) {
        totalPoints += group.points || 0;
        totalPassPoints += group.pass_points || 0;
      }
    });

    const passPercentage =
      totalPoints > 0
        ? Math.round((totalPassPoints / totalPoints) * 100)
        : (rubric.pass_percentage ?? 0);

    const isSelected = rubric.rubric_id ? selectedRubricIds.includes(rubric.rubric_id) : false;
    const handleCardClick = (e: React.MouseEvent) => {
      // Don't toggle selection if clicking action buttons
      if ((e.target as HTMLElement).closest("[data-action-button]")) return;
      if (rubric.rubric_id) {
        toggleSelection(rubric.rubric_id);
      }
    };
    return (
      <Card
        key={rubric.rubric_id}
        className={`group w-full hover:shadow-md transition-all cursor-pointer ${isSelected ? "ring-2 ring-primary" : ""}`}
        data-testid="rubric-card"
        data-rubric-id={rubric.rubric_id}
        role="gridcell"
        aria-label={`rubric card ${rubric.name || "Unnamed Rubric"}`}
        aria-selected={isSelected}
        onClick={handleCardClick}
      >
        {/* Header */}
        <CardHeader className="border-b">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <div
                  className={`transition-all overflow-hidden flex-shrink-0 ${
                    selectedCount > 0
                      ? "w-5 opacity-100"
                      : "w-0 opacity-0 group-hover:w-5 group-hover:opacity-100"
                  }`}
                  data-action-button
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => {
                      if (rubric.rubric_id) toggleSelection(rubric.rubric_id);
                    }}
                    className="rounded-full h-5 w-5"
                    aria-label={`Select rubric ${rubric.name || "Unnamed"}`}
                  />
                </div>
                <CardTitle className="text-2xl font-bold">
                  {rubric.name}
                </CardTitle>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4" />
                  {rubric.points} total points
                </div>
                <div className="flex items-center gap-2">
                  <FileCheck className="h-4 w-4" />
                  Pass: {rubric.pass_points ?? 0} pts ({passPercentage}%)
                </div>
              </div>
              {rubric.description && (
                <p className="text-sm text-muted-foreground max-w-2xl">
                  {rubric.description}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2" data-action-button>
              {rubric.can_edit ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    if (rubric.rubric_id) handleEdit(rubric.rubric_id);
                  }}
                  data-testid="btn-edit-rubric"
                  aria-label="Edit rubric"
                >
                  <Edit className="h-4 w-4 md:mr-0 md:ml-0 mr-2" />
                  <span className="md:hidden">Edit</span>
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => {
                    if (rubric.rubric_id) handleEdit(rubric.rubric_id);
                  }}
                  aria-label={`View ${rubric.name}`}
                  data-testid="btn-view-rubric"
                >
                  <Eye className="h-4 w-4 md:mr-0 md:ml-0 mr-2" />
                  <span className="md:hidden">View</span>
                </Button>
              )}
              {rubric.can_duplicate && (
                <Button
                  variant="outline"
                  onClick={() => handleDuplicate(rubric)}
                  disabled={isDuplicating === rubric.rubric_id}
                  data-testid="btn-duplicate-rubric"
                  aria-label="Duplicate rubric"
                >
                  {isDuplicating === rubric.rubric_id ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent md:mr-0 md:ml-0 mr-2" />
                      <span className="md:hidden">Duplicating...</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 md:mr-0 md:ml-0 mr-2" />
                      <span className="md:hidden">Duplicate</span>
                    </>
                  )}
                </Button>
              )}
              {rubric.can_delete && (
                <Button
                  variant="outline"
                  onClick={() => {
                    if (rubric.rubric_id) {
                      handleDeleteClick(rubric.rubric_id, rubric.name ?? "");
                    }
                  }}
                  data-testid="btn-delete-rubric"
                  aria-label="Delete rubric"
                >
                  <Trash2 className="h-4 w-4 md:mr-0 md:ml-0 mr-2" />
                  <span className="md:hidden">Delete</span>
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        {/* Rubric Table */}
        <CardContent className="p-6">
          <TableRubric
            standardGroups={(() => {
              const groupsDict: Record<string, string[]> = {};
              const groupIds = rubric.standard_group_ids || [];
              groupIds.forEach((groupId) => {
                const standardsInGroup = standards
                  .filter((s) => s.standard_group_id === groupId)
                  .map((s) => String(s.standard_id));
                if (standardsInGroup.length > 0) {
                  groupsDict[String(groupId)] = standardsInGroup;
                }
              });
              return groupsDict;
            })()}
            standardGroupsMapping={(() => {
              const mapping: Record<string, { name: string; description: string; points: number; passPoints: number }> = {};
              standardGroups.forEach((group) => {
                if (group.standard_group_id) {
                  mapping[String(group.standard_group_id)] = {
                    name: group.name || "",
                    description: group.description || "",
                    points: group.points || 0,
                    passPoints: group.pass_points || 0,
                  };
                }
              });
              return mapping;
            })()}
            standardsMapping={(() => {
              const mapping: Record<string, { name: string; description: string; points: number }> = {};
              standards.forEach((standard) => {
                if (standard.standard_id) {
                  mapping[String(standard.standard_id)] = {
                    name: standard.name || "",
                    description: standard.description || "",
                    points: standard.points || 0,
                  };
                }
              });
              return mapping;
            })()}
            showFullStandardsOnMobile={true}
          />
        </CardContent>
      </Card>
    );
  };

  // Get column references for toolbar
  const departmentsColumn = table.getColumn("departments");
  const simulationsColumn = table.getColumn("simulations");
  const evalsColumn = table.getColumn("eval_ids");
  const isFiltered =
    table.getState().columnFilters.length > 0 ||
    searchTerm.length > 0;

  return (
    <div className="space-y-6">
      <div className="space-y-4" data-testid="rubrics-data-table">
        {/* Toolbar — swaps between filter bar and selection action bar */}
        {selectedCount > 0 ? (
          <div
            className="flex items-center justify-between gap-2"
            data-testid="rubrics-toolbar"
          >
            <div className="flex items-center gap-2">
              {deleteRubricAction && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8"
                  onClick={() => setShowBulkDeleteDialog(true)}
                  disabled={deletableRubrics.length === 0}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete {deletableRubrics.length} of {selectedCount}
                </Button>
              )}
              {updateRubricAction && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={openBulkEditDialog}
                  disabled={editableRubrics.length === 0}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit {editableRubrics.length} of {selectedCount}
                </Button>
              )}
              {!allPageSelected && (
                <Button variant="ghost" size="sm" className="h-8" onClick={selectAllOnPage}>
                  Select All
                </Button>
              )}
              <Button variant="ghost" size="sm" className="h-8" onClick={clearBulkSelection}>
                Unselect All
              </Button>
            </div>
          </div>
        ) : (
        <div
          className="flex flex-col md:flex-row md:items-center md:justify-between gap-2"
          data-testid="rubrics-toolbar"
        >
          <div className="flex flex-col md:flex-row md:flex-1 md:items-center md:space-x-2 gap-2 md:gap-0">
            <div className="w-full md:w-auto">
              <Input
                placeholder="Search rubrics..."
                value={searchTerm}
                onChange={(event) => handleSearchChange(event.target.value)}
                onBlur={handleSearchBlur}
                onKeyDown={handleSearchKeyDown}
                className="h-8 w-full md:w-[150px] lg:w-[250px]"
                data-testid="rubrics-search"
              />
            </div>

            <div className="flex items-center space-x-2 flex-wrap">
              <ThreePickerFilters
                slots={[
                  {
                    column: evalsColumn,
                    title: "Eval",
                    options: evalOptions,
                  },
                  {
                    column: simulationsColumn,
                    title: "Simulation",
                    options: simulationOptions,
                    isServerDriven: true,
                    onSearchChange: handleSimulationSearchChange,
                    searchValue: localSimulationSearch,
                  },
                  {
                    column: departmentsColumn,
                    title: "Department",
                    options: departmentOptions,
                    isServerDriven: true,
                    onSearchChange: handleDepartmentSearchChange,
                    searchValue: localDepartmentSearch,
                  },
                ]}
              />

              {isFiltered && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSearchTerm("");
                    setLocalDepartmentSearch("");
                    setLocalSimulationSearch("");
                    table.resetColumnFilters();
                    updateRubricsParams({
                      page: 0,
                      search: "",
                      departmentIds: [],
                      simulationIds: [],
                      evalIds: [],
                      departmentSearch: "",
                      simulationSearch: "",
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
        </div>
        )}

        {/* Rubrics cards */}
        <div className="space-y-4" data-testid="rubrics-grid">
          {tableRows.length ? (
            tableRows.map((row) => renderRubricCard(row.original))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No rubrics match the current filters.
            </div>
          )}
        </div>

        {/* Pagination */}
        <DataTablePagination table={table} card={true} />
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent data-testid="dialog-delete-rubric">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rubric</AlertDialogTitle>
            <AlertDialogDescription>
              <p>
                Are you sure you want to delete the rubric "{deleteItem?.name}"?
                This action cannot be undone.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isDeleting}
              data-testid="btn-cancel-delete"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              variant="destructive"
              data-testid="btn-confirm-delete"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <BulkDeleteDialog
        open={showBulkDeleteDialog}
        onOpenChange={setShowBulkDeleteDialog}
        count={deletableRubrics.length}
        entityLabel="rubric"
        entityLabelPlural="rubrics"
        isDeleting={isBulkDeleting}
        onConfirm={handleBulkDelete}
        description={
          <>
            <p>This action cannot be undone.</p>
            {deletableRubrics.length > 0 && (
              <div>
                <p className="text-sm font-medium text-destructive mb-1">Will be deleted:</p>
                <ul className="text-sm space-y-0.5">
                  {deletableRubrics.map((r) => (
                    <li key={r.rubric_id} className="flex items-center gap-1.5">
                      <Trash2 className="h-3 w-3 text-destructive flex-shrink-0" />
                      {r.name || "Unnamed Rubric"}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {nonDeletableRubrics.length > 0 && (
              <div>
                <p className="text-sm font-medium text-yellow-600 dark:text-yellow-500 mb-1">
                  Cannot be deleted (in use):
                </p>
                <ul className="text-sm space-y-0.5">
                  {nonDeletableRubrics.map((r) => (
                    <li
                      key={r.rubric_id}
                      className="flex items-center gap-1.5 text-muted-foreground"
                    >
                      {r.name || "Unnamed Rubric"}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        }
      />

      {/* Bulk Edit Modal */}
      <BulkEditDialog
        open={showBulkEditDialog}
        onOpenChange={setShowBulkEditDialog}
        count={editableRubrics.length}
        entityLabelPlural="rubrics"
        isSaving={isBulkEditing}
        onSave={handleBulkEdit}
      >
        <BulkEditFlagField
          label="Active Status"
          value={bulkEditActiveStatus}
          onChange={setBulkEditActiveStatus}
        />
      </BulkEditDialog>

    </div>
  );
}
