/**
 * Tools.tsx
 * Used to display the tools page.
 */
"use client";
import { Copy, Edit, Eye, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import type {
  DeleteToolIn,
  DeleteToolOut,
  DuplicateToolIn,
  DuplicateToolOut,
  ToolsListOut,
} from "@/app/(main)/intelligence/tools/page";
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

export interface ToolsProps {
  // Server-provided data (for server-side rendering)
  listData: ToolsListOut;
  // Server actions (replaces useMutation)
  duplicateToolAction?: (input: DuplicateToolIn) => Promise<DuplicateToolOut>;
  deleteToolAction?: (input: DeleteToolIn) => Promise<DeleteToolOut>;
}

export default function Tools({
  listData: serverListData,
  duplicateToolAction,
  deleteToolAction,
}: ToolsProps) {
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);

  // Table state
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "updated_at", desc: true },
  ]);

  // Use server-provided data directly
  const toolsData = serverListData;

  // Extract data from response
  const tools = toolsData?.tools || [];
  const toolsArray = Array.isArray(tools) ? tools : [];

  // Define table columns for filtering/sorting
  const columns: ColumnDef<(typeof toolsArray)[number]>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Name",
      },
      {
        id: "updated_at",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: true,
        accessorFn: (row: (typeof toolsArray)[number]) => {
          return row.updated_at ?? null;
        },
      },
    ],
    []
  );

  // Create table instance
  const table = useReactTable({
    data: toolsArray,
    columns,
    state: {
      sorting,
      columnVisibility,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
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
  }, [sortingKey, columnFiltersKey, toolsArray.length, pageIndex, pageSize]);

  const handleDuplicate = async (toolId: string) => {
    if (isDuplicating === toolId || !duplicateToolAction) return;
    setIsDuplicating(toolId);
    try {
      const result = await duplicateToolAction({
        body: { tool_id: toolId },
      });
      if (result.new_tool_id) {
        const tool = toolsArray.find((t) => t.tool_id === toolId);
        toast.success(
          `Tool '${result.original_name || tool?.name || "Unknown"}' duplicated successfully`
        );
        router.push(`/intelligence/tools/t/${result.new_tool_id}`);
      }
    } catch (error) {
      toast.error(
        `Failed to duplicate tool: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsDuplicating(null);
    }
  };

  const renderToolCard = (tool: (typeof toolsArray)[number]) => {
    const toolId = tool.tool_id ?? "";
    const toolName = tool.name ?? "";

    if (!toolId) return null;

    return (
      <Card
        key={toolId}
        className="relative flex flex-col h-full hover:shadow-md transition-shadow"
        data-testid="tool-card"
        data-tool-id={toolId}
        role="gridcell"
        aria-label={`tool card ${toolName}`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg line-clamp-2">{toolName}</CardTitle>
              <div className="mt-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">
                    {tool.num_schemas || 0}{" "}
                    {(tool.num_schemas || 0) === 1 ? "schema" : "schemas"}
                  </Badge>
                  <Badge variant="outline">
                    {tool.num_templates || 0}{" "}
                    {(tool.num_templates || 0) === 1 ? "template" : "templates"}
                  </Badge>
                  <Badge
                    variant={tool.active ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {tool.active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {tool.can_edit && toolId ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/intelligence/tools/t/${toolId}`)}
                  aria-label={`Edit ${toolName}`}
                  data-testid={`btn-edit-tool-${toolId}`}
                  title={`Edit ${toolName}`}
                  className="h-9 px-3"
                >
                  <Edit className="h-4 w-4 md:mr-0 mr-2" />
                  <span className="md:hidden">Edit</span>
                </Button>
              ) : toolId ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/intelligence/tools/t/${toolId}`)}
                  aria-label={`View ${toolName}`}
                  data-testid={`btn-view-tool-${toolId}`}
                  title={`View ${toolName}`}
                  className="h-9 px-3"
                >
                  <Eye className="h-4 w-4 md:mr-0 mr-2" />
                  <span className="md:hidden">View</span>
                </Button>
              ) : null}
              {tool.can_duplicate && duplicateToolAction && toolId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDuplicate(toolId);
                  }}
                  disabled={isDuplicating === toolId}
                  aria-label={`Duplicate ${toolName}`}
                  data-testid={`btn-duplicate-tool-${toolId}`}
                  title={`Duplicate ${toolName}`}
                  className="h-9 px-3"
                >
                  {isDuplicating === toolId ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <>
                      <Copy className="h-4 w-4 md:mr-0 mr-2" />
                      <span className="md:hidden">Duplicate</span>
                    </>
                  )}
                </Button>
              )}
              {tool.can_delete && deleteToolAction && toolId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteItem({ id: toolId, name: toolName });
                    setShowDeleteDialog(true);
                  }}
                  aria-label={`Delete ${toolName}`}
                  data-testid={`btn-delete-tool-${toolId}`}
                  title={`Delete ${toolName}`}
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
            {tool.description || "No description"}
          </p>
        </CardContent>
      </Card>
    );
  };

  const handleDelete = async () => {
    if (!deleteItem || !deleteToolAction) return;
    setIsDeleting(true);
    try {
      const result = await deleteToolAction({
        body: { tool_id: deleteItem.id },
      });
      if (result.deleted) {
        toast.success(
          `Tool '${result.name || deleteItem.name}' deleted successfully`
        );
        setShowDeleteDialog(false);
        setDeleteItem(null);
        router.refresh();
      } else {
        toast.error(
          result.usage_count && result.usage_count > 0
            ? `Cannot delete tool: Tool is in use (${result.usage_count} usage(s))`
            : `Failed to delete tool: ${result.name || deleteItem.name}`
        );
      }
    } catch (error) {
      toast.error(
        `Failed to delete tool: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsDeleting(false);
    }
  };

  // Get column references for toolbar
  const nameColumn = table.getColumn("name");
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="space-y-6" data-page="tools-index">
      {toolsArray.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">No tools found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Toolbar */}
          <div
            className="flex flex-col md:flex-row md:items-center md:justify-between gap-2"
            data-testid="tools-toolbar"
          >
            <div className="flex flex-col md:flex-row md:flex-1 md:items-center md:space-x-2 gap-2 md:gap-0">
              <div className="w-full md:w-auto">
                <Input
                  data-testid="tools-search"
                  placeholder="Search tools..."
                  value={(nameColumn?.getFilterValue() as string) ?? ""}
                  onChange={(event) =>
                    nameColumn?.setFilterValue(event.target.value)
                  }
                  className="h-8 w-full md:w-[150px] lg:w-[250px]"
                  aria-label="Search tools by name"
                  aria-controls="tools-grid"
                />
              </div>

              <div className="flex items-center space-x-2 flex-wrap">
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
            aria-label="tools grid"
            data-testid="tools-grid"
          >
            {tableRows.length ? (
              tableRows.map((row) => renderToolCard(row.original))
            ) : (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                No tools match the current filters.
              </div>
            )}
          </div>

          {/* Pagination */}
          <DataTablePagination table={table} card={true} />
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tool</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteItem?.name}"? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
