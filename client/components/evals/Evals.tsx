/**
 * Evals.tsx
 * Evals list component with card-based layout and faceted filters
 * @AshokSaravanan222
 * 01/26/2025
 */
"use client";

import { AlertCircle, CheckCircle2, Clock, Eye, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import type {
  DeleteEvalIn,
  DeleteEvalOut,
  EvalsListOut,
} from "@/app/(main)/engine/evals/page";
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
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
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

  // Extract data from response
  const evalsList = useMemo(() => evalsData?.evals || [], [evalsData?.evals]);

  // Build agent options from mapping
  const agentOptions = useMemo(
    () =>
      (evalsData?.agent_options || [])
        .map((opt) => ({
          value: opt["value"] as string,
          label: opt["label"] as string,
        }))
        .filter((opt) => opt.value && opt.label),
    [evalsData?.agent_options],
  );

  // WebSocket integration for real-time status updates
  // Note: WebSocket handlers currently don't update UI as evals state was unused
  // TODO: Fix WebSocket integration to update evalsList or use state properly
  useEffect(() => {
    if (!socket) return;

    const handleEvalProgress = (data: {
      eval_id: string;
      model_run_id?: string;
      status: string;
      message: string;
    }) => {
      // WebSocket handler - state updates removed as evals state was unused
      // eslint-disable-next-line no-console
      console.log("Eval progress:", data);
    };

    const handleEvalCompleted = (data: {
      eval_id: string;
      message: string;
    }) => {
      // WebSocket handler - state updates removed as evals state was unused
      // eslint-disable-next-line no-console
      console.log("Eval completed:", data);
    };

    const handleEvalStopped = (data: {
      eval_id: string;
      success: boolean;
      stopped_count: number;
    }) => {
      // WebSocket handler - state updates removed as evals state was unused
      // eslint-disable-next-line no-console
      console.log("Eval stopped:", data);
    };

    socket.on("eval_progress", handleEvalProgress);
    socket.on("eval_completed", handleEvalCompleted);
    socket.on("eval_stopped", handleEvalStopped);

    return () => {
      socket.off("eval_progress", handleEvalProgress);
      socket.off("eval_completed", handleEvalCompleted);
      socket.off("eval_stopped", handleEvalStopped);
    };
  }, [socket]);

  const handleDelete = async () => {
    if (!deleteItem || !deleteEvalAction) return;

    try {
      await deleteEvalAction({
        body: {
          evalId: deleteItem.id,
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

  // Define table columns inline
  const columns: ColumnDef<(typeof evalsList)[number]>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Name",
      },
      // Hidden faceting column for Agent (single ID)
      {
        id: "agent_id",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof evalsList)[number]) => row.agent_id || "",
        filterFn: (row, _id, value: string[]) => {
          const rowId = row.getValue("agent_id") as string;
          if (value.length === 0) return true;
          if (!rowId) return false;
          return value.includes(rowId);
        },
      },
    ],
    [],
  );

  // Create table instance
  const table = useReactTable({
    data: evalsList,
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
  }, [sortingKey, columnFiltersKey, evalsList.length, pageIndex, pageSize]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "running":
        return (
          <Badge variant="default" className="bg-blue-500">
            <Clock className="h-3 w-3 mr-1" />
            Running
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case "pending":
      default:
        return (
          <Badge variant="secondary">
            <AlertCircle className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  const renderEvalCard = (evalItem: (typeof evalsList)[number]) => (
    <Card
      key={evalItem.eval_id}
      className="hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => router.push(`/engine/evals/e/${evalItem.eval_id}`)}
      data-testid="eval-card"
      data-eval-id={evalItem.eval_id}
    >
      <CardHeader className="pb-3">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg truncate">{evalItem.name}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {evalItem.description}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {getStatusBadge(evalItem.status)}
              <Badge variant="outline">
                {evalItem.total_runs}{" "}
                {evalItem.total_runs === 1 ? "run" : "runs"}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {evalItem.rubric_name}
              </Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/engine/evals/e/${evalItem.eval_id}`);
              }}
            >
              <Eye className="h-4 w-4 mr-2" />
              View
            </Button>
            {evalItem.can_delete && deleteEvalAction && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteItem({ id: evalItem.eval_id, name: evalItem.name });
                  setShowDeleteDialog(true);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
    </Card>
  );

  // Get column references for toolbar
  const nameColumn = table.getColumn("name");
  const agentColumn = table.getColumn("agent_id");
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="space-y-6" data-page="evals-index">
      {evalsList.length === 0 ? (
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
