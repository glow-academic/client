/**
 * Prompts.tsx
 * Used to display the prompts page with table-based filtering and card layout.
 * @AshokSaravanan222
 * 01/22/2025
 */
"use client";
import {
  Copy,
  Edit,
  Eye,
  FileText,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import type {
  PromptsListOut,
  DeletePromptIn,
  DeletePromptOut,
} from "@/app/(main)/engine/prompts/page";
import { DataTableFacetedFilter } from "@/components/common/table/DataTableFacetedFilter";
import { DataTablePagination } from "@/components/common/table/DataTablePagination";
import { Input } from "@/components/ui/input";
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
import { Skeleton } from "@/components/ui/skeleton";

export interface PromptsProps {
  // Server-provided data (for server-side rendering)
  listData: PromptsListOut;
  // Server actions (replaces useMutation)
  deletePromptAction?: (input: DeletePromptIn) => Promise<DeletePromptOut>;
}

export default function Prompts({
  listData: serverListData,
  deletePromptAction,
}: PromptsProps) {
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Table state
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "updatedAt", desc: true },
  ]);

  // Use server-provided data directly
  const promptsData = serverListData;
  const isLoading = false; // No loading when using server data

  // Extract data from response
  const prompts = useMemo(
    () => promptsData?.prompts || [],
    [promptsData?.prompts]
  );

  // Use server-provided facet options directly (no client-side computation)
  const departmentOptions = useMemo(
    () =>
      (promptsData?.department_options || [])
        .map((opt) => ({
          value: opt["value"] as string,
          label: opt["label"] as string,
        }))
        .filter((opt) => opt.value && opt.label),
    [promptsData?.department_options]
  );
  const agentOptions = useMemo(
    () =>
      (promptsData?.agent_options || [])
        .map((opt) => ({
          value: opt["value"] as string,
          label: opt["label"] as string,
        }))
        .filter((opt) => opt.value && opt.label),
    [promptsData?.agent_options]
  );
  const personaOptions = useMemo(
    () =>
      (promptsData?.persona_options || [])
        .map((opt) => ({
          value: opt["value"] as string,
          label: opt["label"] as string,
        }))
        .filter((opt) => opt.value && opt.label),
    [promptsData?.persona_options]
  );

  // Define table columns inline
  const columns: ColumnDef<(typeof prompts)[number]>[] = useMemo(
    () => [
      {
        accessorKey: "system_prompt_preview",
        header: "Prompt",
        cell: ({ row }) => row.getValue("system_prompt_preview"),
        filterFn: (row, id, value) => {
          const preview = String(row.getValue(id)).toLowerCase();
          const fullPrompt = String(row.original.system_prompt).toLowerCase();
          const query = String(value).toLowerCase();
          return preview.includes(query) || fullPrompt.includes(query);
        },
      },
      {
        id: "departments",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof prompts)[number]) => {
          return row.department_ids || [];
        },
        filterFn: (row, _id, value: string[]) => {
          const rowIds = row.original.department_ids || [];
          return value.length === 0 || value.some((v) => rowIds.includes(v));
        },
      },
      {
        id: "agents",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof prompts)[number]) => {
          return row.agent_ids || [];
        },
        filterFn: (row, _id, value: string[]) => {
          const rowIds = row.original.agent_ids || [];
          return value.length === 0 || value.some((v) => rowIds.includes(v));
        },
      },
      {
        id: "personas",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof prompts)[number]) => {
          return row.persona_ids || [];
        },
        filterFn: (row, _id, value: string[]) => {
          const rowIds = row.original.persona_ids || [];
          return value.length === 0 || value.some((v) => rowIds.includes(v));
        },
      },
      {
        accessorKey: "updatedAt",
        header: "Updated",
        accessorFn: (row) => row.updated_at,
      },
    ],
    []
  );

  // Create table instance
  const table = useReactTable({
    data: prompts,
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

  // Memoize table rows to avoid calling getRowModel() multiple times and prevent re-render issues
  // Extract pagination primitives directly to avoid object reference issues
  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  // Stringify arrays for stable comparison (arrays are compared by reference)
  const sortingKey = JSON.stringify(sorting);
  const columnFiltersKey = JSON.stringify(columnFilters);
  const tableRows = useMemo(() => {
    return table.getRowModel().rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // Use JSON.stringify for arrays to ensure stable comparison (arrays are compared by reference)
    sortingKey,
    columnFiltersKey,
    prompts.length,
    // Use pagination primitives directly (not object references)
    pageIndex,
    pageSize,
  ]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>

        {/* Toolbar skeleton */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div className="flex flex-col md:flex-row md:flex-1 md:items-center md:space-x-2 gap-2 md:gap-0">
            <Skeleton className="h-8 w-full md:w-[150px] lg:w-[250px]" />
            <div className="flex items-center space-x-2">
              <Skeleton className="h-8 w-[100px]" />
              <Skeleton className="h-8 w-[120px]" />
              <Skeleton className="h-8 w-[110px]" />
            </div>
          </div>
        </div>

        {/* Prompts grid skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <div className="flex space-x-2">
                    <Skeleton className="h-8 w-8 rounded" />
                    <Skeleton className="h-8 w-8 rounded" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4 mb-3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const handleDelete = async () => {
    if (!deleteItem || !deletePromptAction) return;

    setIsDeleting(true);
    try {
      await deletePromptAction({ body: { promptId: deleteItem.id } });
      toast.success("Prompt deleted successfully");
      router.refresh();
    } catch {
      toast.error("Failed to delete prompt");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setDeleteItem(null);
    }
  };

  const handleDeleteClick = (id: string, preview: string) => {
    setDeleteItem({ id, name: preview.substring(0, 50) });
    setShowDeleteDialog(true);
  };

  const handleEdit = (id: string) => {
    router.push(`/engine/prompts/p/${id}`);
  };

  const handleView = (id: string) => {
    router.push(`/engine/prompts/p/${id}`);
  };

  const handleCreateNew = () => {
    router.push("/engine/prompts/new");
  };

  const renderPromptCard = (prompt: (typeof prompts)[number]) => {
    const departmentMapping = promptsData?.department_mapping || {};
    const agentMapping = promptsData?.agent_mapping || {};
    const personaMapping = promptsData?.persona_mapping || {};

    return (
      <Card
        key={prompt.prompt_id}
        aria-label={prompt.system_prompt_preview}
        data-testid="prompt-card"
        data-prompt-id={prompt.prompt_id}
        className="relative flex flex-col h-full"
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg line-clamp-2">
                {prompt.system_prompt_preview || "Untitled Prompt"}
              </CardTitle>
              <div className="mt-1 space-y-2">
                {prompt.department_ids && prompt.department_ids.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {prompt.department_ids.slice(0, 2).map((deptId) => (
                      <Badge key={deptId} variant="outline">
                        {departmentMapping[deptId]?.name || deptId}
                      </Badge>
                    ))}
                    {prompt.department_ids.length > 2 && (
                      <Badge variant="outline">
                        +{prompt.department_ids.length - 2} more
                      </Badge>
                    )}
                  </div>
                )}
                {(!prompt.department_ids || prompt.department_ids.length === 0) && (
                  <Badge variant="secondary">Default</Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {prompt.can_edit ? (
                <Button
                  variant="outline"
                  size="sm"
                  data-testid={`edit-${prompt.prompt_id}`}
                  onClick={() => handleEdit(prompt.prompt_id)}
                  aria-label={`Edit prompt`}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  data-testid={`view-${prompt.prompt_id}`}
                  onClick={() => handleView(prompt.prompt_id)}
                  aria-label={`View prompt`}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              )}
              {prompt.can_delete && (
                <Button
                  variant="outline"
                  size="sm"
                  data-testid={`delete-${prompt.prompt_id}`}
                  onClick={() =>
                    handleDeleteClick(
                      prompt.prompt_id,
                      prompt.system_prompt_preview
                    )
                  }
                  aria-label={`Delete prompt`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 flex-grow flex flex-col justify-end">
          <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
            {prompt.system_prompt_preview || "No preview available"}
          </p>
          {/* Compact info row: Agents • Personas */}
          <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground flex-wrap">
            {prompt.agent_ids && prompt.agent_ids.length > 0 && (
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {prompt.agent_ids.length}{" "}
                {prompt.agent_ids.length === 1 ? "agent" : "agents"}
              </span>
            )}
            {prompt.persona_ids && prompt.persona_ids.length > 0 && (
              <>
                {prompt.agent_ids && prompt.agent_ids.length > 0 && (
                  <span className="text-muted-foreground">•</span>
                )}
                <span className="flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  {prompt.persona_ids.length}{" "}
                  {prompt.persona_ids.length === 1 ? "persona" : "personas"}
                </span>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderEmptyState = () => (
    <div className="col-span-full">
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No prompts yet</h3>
          <p className="text-muted-foreground text-center mb-4">
            Create your first prompt to define system behavior for agents and
            personas
          </p>
          <Button onClick={handleCreateNew}>
            <Plus className="h-4 w-4 mr-2" />
            Create Your First Prompt
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  // Get column references for toolbar
  const nameColumn = table.getColumn("system_prompt_preview");
  const departmentColumn = table.getColumn("departments");
  const agentColumn = table.getColumn("agents");
  const personaColumn = table.getColumn("personas");
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="space-y-6">
      {prompts.length === 0 ? (
        renderEmptyState()
      ) : (
        <div className="space-y-4">
          {/* Toolbar */}
          <div
            className="flex flex-col md:flex-row md:items-center md:justify-between gap-2"
            data-testid="prompts-toolbar"
          >
            <div className="flex flex-col md:flex-row md:flex-1 md:items-center md:space-x-2 gap-2 md:gap-0">
              <div className="w-full md:w-auto">
                <Input
                  data-testid="prompts-search"
                  placeholder="Search prompts..."
                  value={(nameColumn?.getFilterValue() as string) ?? ""}
                  onChange={(event) =>
                    nameColumn?.setFilterValue(event.target.value)
                  }
                  className="h-8 w-full md:w-[150px] lg:w-[250px]"
                  aria-label="Search prompts by content"
                  aria-controls="prompts-grid"
                />
              </div>

              <div className="flex items-center space-x-2 flex-wrap">
                {/* Department Filter */}
                {departmentColumn && departmentOptions.length > 0 && (
                  <DataTableFacetedFilter
                    column={departmentColumn}
                    title="Department"
                    options={departmentOptions}
                  />
                )}

                {/* Agent Filter */}
                {agentColumn && agentOptions.length > 0 && (
                  <DataTableFacetedFilter
                    column={agentColumn}
                    title="Agent"
                    options={agentOptions}
                  />
                )}

                {/* Persona Filter */}
                {personaColumn && personaOptions.length > 0 && (
                  <DataTableFacetedFilter
                    column={personaColumn}
                    title="Persona"
                    options={personaOptions}
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
            aria-label="prompts grid"
            data-testid="prompts-grid"
          >
            {tableRows.length ? (
              tableRows.map((row) => renderPromptCard(row.original))
            ) : (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                No prompts match the current filters.
              </div>
            )}
          </div>

          {/* Pagination */}
          <DataTablePagination table={table} card={true} />
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent
          aria-labelledby="delete-prompt-title"
          data-testid="dialog-delete-prompt"
        >
          <AlertDialogHeader>
            <AlertDialogTitle id="delete-prompt-title">
              Delete Prompt
            </AlertDialogTitle>
            <AlertDialogDescription>
              <p>
                Are you sure you want to delete the prompt "{deleteItem?.name}"?
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
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="btn-confirm-delete"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

