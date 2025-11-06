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
import { DataTableFacetedFilter } from "@/components/common/history/DataTableFacetedFilter";
import { DataTablePagination } from "@/components/common/history/DataTablePagination";
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
  const reasoningOptions = useMemo(
    () => [
      { value: "cot", label: "Chain of Thought" },
      { value: "none", label: "None" },
      { value: "null", label: "Not Set" },
    ],
    []
  );

  const modelOptions = useMemo(
    () =>
      Object.entries(modelMapping).map(([id, name]) => ({
        value: id,
        label: name.name,
      })),
    [modelMapping]
  );

  const temperatureOptions = useMemo(() => {
    const temps = agents.map((a) => a.temperature);
    const uniqueTemps = [...new Set(temps)].sort((a, b) => a - b);
    return uniqueTemps.map((temp) => ({
      value: temp.toString(),
      label: temp.toFixed(2),
    }));
  }, [agents]);

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
      {
        accessorKey: "reasoning",
        header: "Reasoning",
      },
      {
        accessorKey: "temperature",
        header: "Temperature",
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
    <Card key={agent.agent_id} className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">
                {agent.name || "Unnamed Agent"}
              </CardTitle>
              <div className="flex gap-1">
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
          <div className="flex gap-2 items-center">
            {agent.can_duplicate && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDuplicate(agent.agent_id)}
                disabled={false} // No loading state for server action
              >
                <Copy className="h-4 w-4" />
              </Button>
            )}
            {agent.can_edit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleEdit(agent.agent_id)}
              >
                <Edit className="h-4 w-4" />
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
              >
                <Trash2 className="h-4 w-4" />
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
  const reasoningColumn = table.getColumn("reasoning");
  const modelColumn = table.getColumn("model_id");
  const temperatureColumn = table.getColumn("temperature");
  const roleColumn = table.getColumn("role");
  const departmentsColumn = table.getColumn("departments");
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <div className="flex flex-1 items-center space-x-2 flex-wrap">
            <div className="mb-2">
              <Input
                placeholder="Search system agents..."
                value={(nameColumn?.getFilterValue() as string) ?? ""}
                onChange={(event) =>
                  nameColumn?.setFilterValue(event.target.value)
                }
                className="h-8 w-[150px] lg:w-[250px]"
              />
            </div>

            <div className="flex items-center space-x-2 flex-wrap mb-2">
              {/* Reasoning Filter */}
              {reasoningColumn && reasoningOptions.length > 0 && (
                <DataTableFacetedFilter
                  column={reasoningColumn}
                  title="Reasoning"
                  options={reasoningOptions}
                />
              )}

              {/* Model Filter */}
              {modelColumn && modelOptions.length > 0 && (
                <DataTableFacetedFilter
                  column={modelColumn}
                  title="Model"
                  options={modelOptions}
                />
              )}

              {/* Temperature Filter */}
              {temperatureColumn && temperatureOptions.length > 0 && (
                <DataTableFacetedFilter
                  column={temperatureColumn}
                  title="Temperature"
                  options={temperatureOptions}
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
                  className="h-8 px-2 lg:px-3"
                >
                  Reset
                  <X className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Cards Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => renderAgentCard(row.original))
          ) : (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              No system agents match the current filters.
            </div>
          )}
        </div>

        {/* Pagination */}
        <DataTablePagination table={table} card={true} />
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agent</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the agent "{deleteItem?.name}
              "? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
