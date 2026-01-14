/**
 * Tools.tsx
 * Used to display the tools page.
 */
"use client";
import { Copy, Edit, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
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
} from "@/app/(main)/engine/tools/page";
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
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

  // Define table columns
  const columns: ColumnDef<(typeof tools)[number]>[] = useMemo(() => {
    return [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => {
          const tool = row.original;
          return (
            <div className="font-medium">{tool.name || "Unnamed Tool"}</div>
          );
        },
      },
      {
        accessorKey: "description",
        header: "Description",
        cell: ({ row }) => {
          const tool = row.original;
          return (
            <div className="text-sm text-muted-foreground max-w-md truncate">
              {tool.description || "No description available"}
            </div>
          );
        },
      },
      {
        accessorKey: "num_schemas",
        header: "Schemas",
        cell: ({ row }) => {
          const tool = row.original;
          return <Badge variant="secondary">{tool.num_schemas || 0}</Badge>;
        },
      },
      {
        accessorKey: "num_templates",
        header: "Templates",
        cell: ({ row }) => {
          const tool = row.original;
          return <Badge variant="secondary">{tool.num_templates || 0}</Badge>;
        },
      },
      {
        accessorKey: "active",
        header: "Status",
        cell: ({ row }) => {
          const tool = row.original;
          return (
            <Badge variant={tool.active ? "default" : "secondary"}>
              {tool.active ? "Active" : "Inactive"}
            </Badge>
          );
        },
      },
      {
        accessorKey: "updated_at",
        header: "Updated",
        cell: ({ row }) => {
          const updatedAt = row.original.updated_at;
          if (!updatedAt) {
            return <div className="text-sm text-muted-foreground">—</div>;
          }
          const date = new Date(updatedAt);
          return (
            <div className="text-sm text-muted-foreground">
              {date.toLocaleDateString()}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const tool = row.original;
          const toolId = tool.tool_id;
          if (!toolId) return null;

          return (
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/engine/tools/t/${toolId}`);
                      }}
                      disabled={!tool.can_edit}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit tool</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {tool.can_duplicate && duplicateToolAction && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (isDuplicating === toolId) return;
                          setIsDuplicating(toolId);
                          try {
                            if (!duplicateToolAction) return;
                            const result = await duplicateToolAction({
                              body: { tool_id: toolId },
                            });
                            if (result.new_tool_id) {
                              toast.success(
                                `Tool '${result.original_name || tool.name}' duplicated successfully`
                              );
                              router.push(
                                `/engine/tools/t/${result.new_tool_id}`
                              );
                            }
                          } catch (error) {
                            toast.error(
                              `Failed to duplicate tool: ${
                                error instanceof Error
                                  ? error.message
                                  : "Unknown error"
                              }`
                            );
                          } finally {
                            setIsDuplicating(null);
                          }
                        }}
                        disabled={isDuplicating === toolId}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Duplicate tool</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              {tool.can_delete && deleteToolAction && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteItem({
                            id: toolId,
                            name: tool.name || "Unknown",
                          });
                          setShowDeleteDialog(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete tool</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          );
        },
      },
    ];
  }, [router, isDuplicating, duplicateToolAction, deleteToolAction]);

  // Create table instance
  const table = useReactTable({
    data: tools,
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
        pageSize: 10,
      },
    },
  });

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tools</h1>
          <p className="text-muted-foreground">
            Manage tools for teaching assistant training platform.
          </p>
        </div>
        <Button onClick={() => router.push("/engine/tools/new")}>
          <Plus className="mr-2 h-4 w-4" />
          Create Tool
        </Button>
      </div>

      {tools.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <p className="text-muted-foreground mb-4">No tools found.</p>
            <Button onClick={() => router.push("/engine/tools/new")}>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Tool
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search tools..."
              value={
                (table.getColumn("name")?.getFilterValue() as string) ?? ""
              }
              onChange={(event) =>
                table.getColumn("name")?.setFilterValue(event.target.value)
              }
              className="max-w-sm"
            />
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder ? null : header.column.getCanSort() ? (
                          <button
                            className="flex items-center gap-2 hover:underline"
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                          </button>
                        ) : (
                          flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )
                        )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                      className="cursor-pointer"
                      onClick={() => {
                        const toolId = row.original.tool_id;
                        if (toolId) {
                          router.push(`/engine/tools/t/${toolId}`);
                        }
                      }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center"
                    >
                      No results.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <DataTablePagination table={table} />
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
