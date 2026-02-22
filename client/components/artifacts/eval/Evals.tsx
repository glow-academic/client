/**
 * Evals.tsx
 * Evals list component with card-based layout and server-side filtering
 * @AshokSaravanan222
 * 01/26/2025
 */
"use client";

import { Edit, Eye, Trash2, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type {
  DeleteEvalIn,
  DeleteEvalOut,
  EvalsListOut,
} from "@/app/(main)/system/evals/page";
import { DataTableFacetedFilter } from "@/components/common/table/DataTableFacetedFilter";
import { DataTablePagination } from "@/components/common/table/DataTablePagination";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { GenerateRegenerateModal } from "@/components/common/forms/GenerateRegenerateModal";
import { useSocket } from "@/contexts/socket-context";
import { useArtifactAi } from "@/hooks/use-artifact-ai";
import { useGenerationModal } from "@/hooks/use-generation-modal";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

export interface EvalsProps {
  listData: EvalsListOut;
  deleteEvalAction?: (input: DeleteEvalIn) => Promise<DeleteEvalOut>;
  // Server-side pagination
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  // Server-side filter search terms
  departmentSearch: string;
}

export default function Evals({
  listData: serverListData,
  deleteEvalAction,
  pageIndex,
  pageSize,
  totalCount,
  departmentSearch,
}: EvalsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { socket } = useSocket();

  // Generation via useArtifactAi hook
  type EvalResourceType = "names" | "descriptions" | "flags" | "departments" | "agents" | "run_positions" | "group_positions" | "run_rubrics" | "group_rubrics";

  const { generate } = useArtifactAi({
    artifactType: "eval",
    groupId: null,
    validResourceTypes: ["names", "descriptions", "flags", "departments", "agents", "run_positions", "group_positions", "run_rubrics", "group_rubrics"],
  });

  const { handleOpenStepCardModal, modalProps } = useGenerationModal<EvalResourceType>({
    stepResources: {
      all: ["names", "descriptions", "flags", "departments", "agents", "run_positions", "group_positions", "run_rubrics", "group_rubrics"],
    },
    resourceLabels: {
      names: "Name",
      descriptions: "Description",
      flags: "Configuration",
      departments: "Departments",
      agents: "Agents",
      run_positions: "Run Positions",
      group_positions: "Group Positions",
      run_rubrics: "Run Rubrics",
      group_rubrics: "Group Rubrics",
    },
    canRegenerate: () => true,
    onGenerate: (selectedResources, instructions) => {
      generate(selectedResources, {
        user_instructions: instructions?.trim() ? [instructions.trim()] : null,
        save: true,
      });
    },
    isGenerating: () => false,
  });

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Local search state for debouncing
  const [searchTerm, setSearchTerm] = useState(
    searchParams?.get("search") ?? ""
  );
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Table state
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(() => {
    const filters: ColumnFiltersState = [];
    const deptIds = searchParams?.getAll("departmentIds") ?? [];
    if (deptIds.length > 0) filters.push({ id: "departments", value: deptIds });
    return filters;
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: "updated_at", desc: true },
  ]);

  // Use server-provided data directly
  const evalsData = serverListData;

  // Extract data from response - ensure it's always an array
  const [evalsList, setEvalsList] = useState<
    NonNullable<EvalsListOut["evals"]>
  >(Array.isArray(evalsData?.evals) ? evalsData.evals : []);

  useEffect(() => {
    const evalsArray = Array.isArray(evalsData?.evals) ? evalsData.evals : [];
    setEvalsList(evalsArray);
  }, [evalsData?.evals]);

  // Filter options from server-provided ListFilterSection
  const departmentOptions = useMemo(
    () =>
      (evalsData?.department_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? undefined,
        }))
        .filter((opt) => opt.value && opt.label),
    [evalsData?.department_filter]
  );

  // WebSocket integration for real-time updates
  useEffect(() => {
    if (!socket) return;

    const handleEvalCompleted = (data: {
      eval_id: string;
      message: string;
    }) => {
      if (data.eval_id) {
        router.refresh();
      }
    };

    socket.on("eval_completed", handleEvalCompleted);

    return () => {
      socket.off("eval_completed", handleEvalCompleted);
    };
  }, [socket, router]);

  // Helper to update URL search params
  const updateEvalsParams = useCallback(
    (updates: {
      page?: number;
      pageSize?: number;
      search?: string;
      departmentIds?: string[];
      departmentSearch?: string;
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

      if (updates.departmentSearch !== undefined) {
        if (updates.departmentSearch === "") params.delete("departmentSearch");
        else params.set("departmentSearch", updates.departmentSearch);
      }

      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  // Commit search to URL
  const commitSearch = useCallback(
    (value: string) => {
      updateEvalsParams({ page: 0, search: value.trim() || "" });
    },
    [updateEvalsParams]
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
  const [localDepartmentSearch, setLocalDepartmentSearch] = useState(departmentSearch);

  const handleDepartmentSearchChange = useCallback(
    (value: string) => {
      setLocalDepartmentSearch(value);
      if (departmentSearchTimeoutRef.current) clearTimeout(departmentSearchTimeoutRef.current);
      departmentSearchTimeoutRef.current = setTimeout(() => {
        updateEvalsParams({ departmentSearch: value });
      }, 300);
    },
    [updateEvalsParams]
  );

  // Sync column filters to URL when they change
  const handleColumnFiltersChange = useCallback(
    (updater: ColumnFiltersState | ((prev: ColumnFiltersState) => ColumnFiltersState)) => {
      const newFilters = typeof updater === "function" ? updater(columnFilters) : updater;
      setColumnFilters(newFilters);

      const departmentFilter = newFilters.find((f) => f.id === "departments");

      updateEvalsParams({
        page: 0,
        departmentIds: (departmentFilter?.value as string[]) || [],
      });
    },
    [columnFilters, updateEvalsParams]
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
      updateEvalsParams({
        page: newPagination.pageIndex,
        pageSize: newPagination.pageSize,
      });
    },
    [pageIndex, pageSize, updateEvalsParams]
  );

  // Compute page count from total
  const pageCount = Math.ceil(totalCount / pageSize);

  const handleDelete = async () => {
    if (!deleteItem || !deleteEvalAction) return;

    try {
      await deleteEvalAction({
        body: {
          eval_id: deleteItem.id,
        },
      });
      toast.success(`Eval "${deleteItem.name}" deleted successfully`);
      setShowDeleteDialog(false);
      setDeleteItem(null);
      router.refresh();
    } catch (error) {
      toast.error(`Failed to delete eval: ${error}`);
    }
  };

  // Ensure evalsList is always an array for type safety
  const evalsListArray = Array.isArray(evalsList) ? evalsList : [];

  // Define table columns inline
  const columns: ColumnDef<(typeof evalsListArray)[number]>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Name",
      },
      // Hidden column for sorting by updated_at
      {
        id: "updated_at",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: true,
        accessorFn: (row: (typeof evalsListArray)[number]) => {
          return row.updated_at ?? null;
        },
      },
      // Hidden faceting column for Departments
      {
        id: "departments",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: () => [] as string[],
        filterFn: () => true,
      },
    ],
    []
  );

  // Create table instance with manual pagination and filtering
  const table = useReactTable({
    data: evalsListArray,
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
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    manualFiltering: true,
    pageCount,
  });

  // Memoize table rows
  const sortingKey = JSON.stringify(sorting);
  const tableRows = useMemo(() => {
    return table.getRowModel().rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortingKey, evalsListArray.length, pageIndex, pageSize]);

  const renderEvalCard = (evalItem: (typeof evalsListArray)[number]) => {
    const evalId = evalItem.eval_id ?? "";
    const evalName = evalItem.name ?? "";

    if (!evalId) return null;

    return (
      <Card
        key={evalId}
        className="relative flex flex-col h-full hover:shadow-md transition-shadow"
        data-testid="eval-card"
        data-eval-id={evalId}
        role="gridcell"
        aria-label={`eval card ${evalName}`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg line-clamp-2">{evalName}</CardTitle>
              <div className="mt-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">
                    {evalItem.num_runs ?? 0}{" "}
                    {(evalItem.num_runs ?? 0) === 1 ? "run" : "runs"}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {evalItem.can_edit && evalId ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/system/evals/${evalId}`)}
                  aria-label={`Edit ${evalName}`}
                  data-testid={`btn-edit-eval-${evalId}`}
                  title={`Edit ${evalName}`}
                  className="h-9 px-3"
                >
                  <Edit className="h-4 w-4 md:mr-0 mr-2" />
                  <span className="md:hidden">Edit</span>
                </Button>
              ) : evalId ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/system/evals/${evalId}`)}
                  aria-label={`View ${evalName}`}
                  data-testid={`btn-view-eval-${evalId}`}
                  title={`View ${evalName}`}
                  className="h-9 px-3"
                >
                  <Eye className="h-4 w-4 md:mr-0 mr-2" />
                  <span className="md:hidden">View</span>
                </Button>
              ) : null}
              {evalItem.can_delete && deleteEvalAction && evalId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    const evalName = evalItem.name ?? "";
                    setDeleteItem({ id: evalId, name: evalName });
                    setShowDeleteDialog(true);
                  }}
                  aria-label={`Delete ${evalName}`}
                  data-testid={`btn-delete-eval-${evalId}`}
                  title={`Delete ${evalName}`}
                  className="h-9 px-3"
                >
                  <Trash2 className="h-4 w-4 md:mr-0 mr-2" />
                  <span className="md:hidden">Delete</span>
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 flex-1 flex flex-col">
          <p className="text-sm text-muted-foreground line-clamp-2">
            {evalItem.description || "No description"}
          </p>
        </CardContent>
      </Card>
    );
  };

  // Get column references for toolbar
  const departmentsColumn = table.getColumn("departments");
  const isFiltered =
    table.getState().columnFilters.length > 0 ||
    searchTerm.length > 0;

  return (
    <div className="space-y-6" data-page="evals-index">
      <div className="space-y-4">
        {/* Toolbar */}
        <div
          className="flex flex-col md:flex-row md:items-center md:justify-between gap-2"
          data-testid="evals-toolbar"
        >
          <div className="flex flex-col md:flex-row md:flex-1 md:items-center md:space-x-2 gap-2 md:gap-0">
            <div className="w-full md:w-auto">
              <Input
                data-testid="evals-search"
                placeholder="Search evals..."
                value={searchTerm}
                onChange={(event) => handleSearchChange(event.target.value)}
                onBlur={handleSearchBlur}
                onKeyDown={handleSearchKeyDown}
                className="h-8 w-full md:w-[150px] lg:w-[250px]"
                aria-label="Search evals by name"
                aria-controls="evals-grid"
              />
            </div>

            <div className="flex items-center space-x-2 flex-wrap">
              <DataTableFacetedFilter
                column={departmentsColumn}
                title="Department"
                options={departmentOptions}
                isServerDriven={true}
                onSearchChange={handleDepartmentSearchChange}
                searchValue={localDepartmentSearch}
              />

              {isFiltered && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSearchTerm("");
                    setLocalDepartmentSearch("");
                    table.resetColumnFilters();
                    updateEvalsParams({
                      page: 0,
                      search: "",
                      departmentIds: [],
                      departmentSearch: "",
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

        {/* Cards Grid */}
        <div
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
          role="grid"
          aria-label="evals grid"
          data-testid="evals-grid"
        >
          {tableRows.length ? (
            tableRows.map((row) => renderEvalCard(row.original))
          ) : (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              No evals match the current filters.
            </div>
          )}
        </div>

        {/* Pagination */}
        <DataTablePagination table={table} card={true} />
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Eval</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteItem?.name}"? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <GenerateRegenerateModal {...modalProps} />
    </div>
  );
}
