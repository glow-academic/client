/**
 * Evals.tsx
 * Evals list component with card-based layout and faceted filters
 * @AshokSaravanan222
 * 01/26/2025
 */
"use client";

import { Edit, Eye, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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
import { useProfile } from "@/contexts/profile-context";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

export interface EvalsProps {
  listData: EvalsListOut;
  deleteEvalAction?: (input: DeleteEvalIn) => Promise<DeleteEvalOut>;
}

export default function Evals({
  listData: serverListData,
  deleteEvalAction,
}: EvalsProps) {
  const router = useRouter();
  const { socket } = useProfile();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Table state
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
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

  // Build agent options from evals data (unique agents across all evals)
  const agentOptions = useMemo(() => {
    const agentMap = new Map<string, string>();
    (evalsData?.evals || []).forEach((evalItem) => {
      (evalItem.agent_ids || []).forEach((id) => {
        if (id && !agentMap.has(id)) {
          agentMap.set(id, id);
        }
      });
    });
    return Array.from(agentMap.entries()).map(([value]) => ({
      value,
      label: value,
    }));
  }, [evalsData?.evals]);

  // WebSocket integration for real-time updates
  useEffect(() => {
    if (!socket) return;

    const handleEvalCompleted = (data: {
      eval_id: string;
      message: string;
    }) => {
      // Refresh the page to get updated eval data
      if (data.eval_id) {
        router.refresh();
      }
    };

    socket.on("eval_completed", handleEvalCompleted);

    return () => {
      socket.off("eval_completed", handleEvalCompleted);
    };
  }, [socket, router]);

  const handleDelete = async () => {
    if (!deleteItem || !deleteEvalAction) return;

    try {
      await deleteEvalAction({
        body: {
          eval_id: deleteItem.id, // Convert camelCase to snake_case
        },
      });
      // profileId comes from X-Profile-Id header automatically
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
      // Hidden faceting column for Agent (single ID)
      {
        id: "agent_id",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof evalsListArray)[number]) => {
          const agentIds = row.agent_ids;
          return Array.isArray(agentIds) && agentIds.length > 0
            ? (agentIds[0] ?? "")
            : "";
        },
        filterFn: (row, _id, value: string[]) => {
          const rowId = row.getValue("agent_id") as string;
          if (value.length === 0) return true;
          if (!rowId) return false;
          return value.includes(rowId);
        },
      },
    ],
    []
  );

  // Create table instance
  const table = useReactTable({
    data: evalsListArray,
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
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    initialState: {
      pagination: {
        pageSize: 12,
      },
    },
  });

  // Memoize table rows
  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  const sortingKey = JSON.stringify(sorting);
  const columnFiltersKey = JSON.stringify(columnFilters);
  const tableRows = useMemo(() => {
    return table.getRowModel().rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    sortingKey,
    columnFiltersKey,
    evalsListArray.length,
    pageIndex,
    pageSize,
  ]);

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
  const nameColumn = table.getColumn("name");
  const agentColumn = table.getColumn("agent_id");
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="space-y-6" data-page="evals-index">
      {evalsListArray.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">No evals found</p>
        </div>
      ) : (
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
                  value={(nameColumn?.getFilterValue() as string) ?? ""}
                  onChange={(event) =>
                    nameColumn?.setFilterValue(event.target.value)
                  }
                  className="h-8 w-full md:w-[150px] lg:w-[250px]"
                  aria-label="Search evals by name"
                  aria-controls="evals-grid"
                />
              </div>

              <div className="flex items-center space-x-2 flex-wrap">
                {/* Agent Filter */}
                {agentColumn && agentOptions.length > 0 && (
                  <DataTableFacetedFilter
                    column={agentColumn}
                    title="Agent"
                    options={agentOptions}
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
      )}

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
    </div>
  );
}
