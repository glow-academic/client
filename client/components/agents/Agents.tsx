/**
 * Agents.tsx
 * Used to display the agents page.
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */
"use client";
import { Brain, Copy, Edit, Thermometer, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";

import type {
  AgentsListOut,
  DeleteAgentIn,
  DeleteAgentOut,
  DuplicateAgentIn,
  DuplicateAgentOut,
} from "@/app/(main)/management/agents/page";
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
import { useMemo, useState } from "react";
import { toast } from "sonner";

export interface AgentsProps {
  // Server-provided data (for server-side rendering)
  listData: AgentsListOut;
  // Server actions (replaces useMutation)
  duplicateAgentAction?: (
    input: DuplicateAgentIn
  ) => Promise<DuplicateAgentOut>;
  deleteAgentAction?: (input: DeleteAgentIn) => Promise<DeleteAgentOut>;
}

export default function Agents({
  listData: serverListData,
  duplicateAgentAction,
  deleteAgentAction,
}: AgentsProps) {
  const router = useRouter();

  // Delete dialog state
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
    { id: "updated_at", desc: true },
  ]);

  // Use server-provided data directly
  const agentsData = serverListData;

  // Extract data from response
  const agents = useMemo(() => agentsData?.agents || [], [agentsData?.agents]);
  const modelMapping = useMemo(
    () =>
      (agentsData?.model_mapping as Record<
        string,
        { name: string; description: string }
      >) || {},
    [agentsData?.model_mapping]
  );

  // Filter options (inline)
  const modelOptions = useMemo(
    () =>
      Object.entries(modelMapping).map(([id, name]) => ({
        value: id,
        label: name.name,
      })),
    [modelMapping]
  );

  // Build role options from unique agent roles
  const roleOptions = useMemo(() => {
    const roles = agents.map((a) => a.role).filter(Boolean);
    const uniqueRoles = [...new Set(roles)].sort();
    return uniqueRoles.map((role) => ({
      value: role,
      label: role,
    }));
  }, [agents]);

  // Build department options from mapping
  const departmentMapping = useMemo(
    () =>
      (agentsData?.department_mapping as Record<
        string,
        { name: string; description: string }
      >) || {},
    [agentsData?.department_mapping]
  );

  const departmentOptions = useMemo(() => {
    return Object.entries(departmentMapping).map(([id, obj]) => ({
      value: id,
      label: obj?.name || id,
    }));
  }, [departmentMapping]);

  // Define table columns inline
  const columns: ColumnDef<(typeof agents)[number]>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Name",
      },
      {
        accessorKey: "model_id",
        header: "Model",
        cell: ({ row }) => {
          const modelId = row.getValue("model_id") as string;
          return modelMapping[modelId]?.name || modelId;
        },
      },
      // Hidden faceting column for Role
      {
        id: "role",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof agents)[number]) => row.role || "",
        filterFn: (row, _id, value: string[]) => {
          const role = String(row.getValue("role"));
          return value.includes(role);
        },
      },
      // Hidden faceting column for Departments (array of IDs)
      {
        id: "departments",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof agents)[number]) => row.department_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("departments") as string[]) ?? [];
          if (value.length === 0) return true;
          if (rowIds.length === 0) return true;
          return value.some((v) => rowIds.includes(v));
        },
      },
    ],
    [modelMapping]
  );

  // Create table instance
  const table = useReactTable({
    data: agents,
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
  const tableRows = useMemo(() => {
    return table.getRowModel().rows;
  }, [
    // Use JSON.stringify for arrays to ensure stable comparison (arrays are compared by reference)
    JSON.stringify(sorting),
    JSON.stringify(columnFilters),
    agents.length,
    // Use pagination primitives directly (not object references)
    pageIndex,
    pageSize,
  ]);

  const handleEdit = (id: string) => {
    router.push(`/management/agents/a/${id}`);
  };

  const handleDuplicate = async (id: string) => {
    if (!duplicateAgentAction) return;

    try {
      await duplicateAgentAction({ body: { agentId: id } });
      toast.success("Agent duplicated successfully");
      router.refresh();
    } catch {
      toast.error("Failed to duplicate agent");
    }
  };

  const handleDelete = async () => {
    if (!deleteItem || !deleteAgentAction) return;

    setIsDeleting(true);
    try {
      await deleteAgentAction({ body: { agentId: deleteItem.id } });
      toast.success("Agent deleted successfully");
      router.refresh();
    } catch {
      toast.error("Failed to delete agent");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setDeleteItem(null);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteItem({ id, name });
    setShowDeleteDialog(true);
  };

  const formatTemperature = (temp: number) => {
    return temp.toFixed(2);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const renderAgentCard = (agent: (typeof agents)[0]) => (
    <Card
      key={agent.agent_id}
      className="hover:shadow-md transition-shadow"
      data-testid="agent-card"
      data-agent-id={agent.agent_id}
      role="gridcell"
      aria-label={`agent card ${agent.name || "Unnamed Agent"}`}
    >
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="space-y-2 flex-1 min-w-0">
            <CardTitle className="text-base truncate">
              {agent.name || "Unnamed Agent"}
            </CardTitle>
            <div className="mt-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                {agent.reasoning && (
                  <Badge variant="outline" className="text-xs">
                    <Brain className="h-3 w-3 mr-1" />
                    {agent.reasoning}
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs">
                  <Thermometer className="h-3 w-3 mr-1" />
                  {formatTemperature(agent.temperature)}
                </Badge>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {agent.description || "No description available"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {agent.can_duplicate && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDuplicate(agent.agent_id)}
                disabled={false} // No loading state for server action
                aria-label={`Duplicate agent ${agent.name}`}
                data-testid="btn-duplicate-agent"
                title={`Duplicate agent ${agent.name}`}
                className="h-9 px-3"
              >
                <Copy className="h-4 w-4 md:mr-0 mr-2" />
                <span className="md:hidden">Duplicate</span>
              </Button>
            )}
            {agent.can_edit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleEdit(agent.agent_id)}
                aria-label={`Edit agent ${agent.name}`}
                data-testid="btn-edit-agent"
                title={`Edit agent ${agent.name}`}
                className="h-9 px-3"
              >
                <Edit className="h-4 w-4 md:mr-0 mr-2" />
                <span className="md:hidden">Edit</span>
              </Button>
            )}
            {agent.can_delete && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  handleDeleteClick(
                    agent.agent_id,
                    agent.name || "Unnamed Agent"
                  )
                }
                aria-label={`Delete agent ${agent.name}`}
                data-testid="btn-delete-agent"
                title={`Delete agent ${agent.name}`}
                className="h-9 px-3"
              >
                <Trash2 className="h-4 w-4 md:mr-0 mr-2" />
                <span className="md:hidden">Delete</span>
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-sm">
          <span className="text-muted-foreground">Updated:</span>
          <span className="font-medium ml-2">
            {formatDate(agent.updated_at)}
          </span>
        </div>
      </CardContent>
    </Card>
  );

  // Get column references for toolbar
  const nameColumn = table.getColumn("name");
  const modelColumn = table.getColumn("model_id");
  const roleColumn = table.getColumn("role");
  const departmentsColumn = table.getColumn("departments");
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        {/* Toolbar */}
        <div
          className="flex items-center justify-between"
          data-testid="agents-toolbar"
        >
          <div className="flex flex-1 items-center space-x-2 flex-wrap">
            <div className="w-full md:w-auto mb-2 md:mb-0">
              <Input
                data-testid="agents-search"
                placeholder="Search system agents..."
                value={(nameColumn?.getFilterValue() as string) ?? ""}
                onChange={(event) =>
                  nameColumn?.setFilterValue(event.target.value)
                }
                className="h-8 w-full md:w-[150px] lg:w-[250px]"
                aria-label="Search agents by name"
                aria-controls="agents-grid"
              />
            </div>

            <div className="flex items-center space-x-2 flex-wrap mb-2">
              {/* Model Filter */}
              {modelColumn && modelOptions.length > 0 && (
                <DataTableFacetedFilter
                  column={modelColumn}
                  title="Model"
                  options={modelOptions}
                />
              )}

              {/* Role Filter */}
              {roleColumn && roleOptions.length > 0 && (
                <DataTableFacetedFilter
                  column={roleColumn}
                  title="Role"
                  options={roleOptions}
                />
              )}

              {/* Department Filter */}
              {departmentsColumn && departmentOptions.length > 0 && (
                <DataTableFacetedFilter
                  column={departmentsColumn}
                  title="Department"
                  options={departmentOptions}
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
          aria-label="agents grid"
          data-testid="agents-grid"
        >
          {tableRows.length ? (
            tableRows.map((row) => renderAgentCard(row.original))
          ) : (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              No system agents match the current filters.
            </div>
          )}
        </div>

        {/* Pagination */}
        <div aria-label="pagination controls">
          <DataTablePagination table={table} card={true} />
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent
          aria-labelledby="delete-agent-title"
          data-testid="dialog-delete-agent"
        >
          <AlertDialogHeader>
            <AlertDialogTitle id="delete-agent-title">
              Delete Agent
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the agent "{deleteItem?.name}
              "? This action cannot be undone.
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
