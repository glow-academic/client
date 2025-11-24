/**
 * Policies.tsx
 * Used to display the policies page with table-based filtering.
 * @AshokSaravanan222 & @siladiea
 * 12/24/2024
 */
"use client";
import {
  Edit,
  Plus,
  Trash2,
  X,
  FileText,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import type {
  PoliciesListOut,
  DeletePolicyIn,
  DeletePolicyOut,
} from "@/app/(main)/management/policies/page";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

export interface PoliciesProps {
  // Server-provided data (for server-side rendering)
  listData: PoliciesListOut;
  // Server actions (replaces useMutation)
  deletePolicyAction?: (input: DeletePolicyIn) => Promise<DeletePolicyOut>;
}

export default function Policies({
  listData: serverListData,
  deletePolicyAction,
}: PoliciesProps) {
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
    { id: "updated_at", desc: true },
  ]);

  // Use server-provided data directly
  const policiesData = serverListData;
  const isLoading = false; // No loading when using server data

  // Extract data from response
  const policies = useMemo(
    () => policiesData?.policies || [],
    [policiesData?.policies]
  );

  // Use server-provided facet options directly (no client-side computation)
  const departmentOptions = useMemo(
    () =>
      (policiesData?.department_options || [])
        .map((opt) => ({
          value: opt["value"] as string,
          label: opt["label"] as string,
        }))
        .filter((opt) => opt.value && opt.label),
    [policiesData?.department_options]
  );
  const videoOptions = useMemo(
    () =>
      (policiesData?.video_options || [])
        .map((opt) => ({
          value: opt["value"] as string,
          label: opt["label"] as string,
        }))
        .filter((opt) => opt.value && opt.label),
    [policiesData?.video_options]
  );
  const extensionOptions = useMemo(
    () =>
      (policiesData?.extension_options || [])
        .map((opt) => ({
          value: opt["value"] as string,
          label: opt["label"] as string,
        }))
        .filter((opt) => opt.value && opt.label),
    [policiesData?.extension_options]
  );

  // Define table columns inline
  const columns: ColumnDef<(typeof policies)[number]>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <div className="font-medium">{row.getValue("name")}</div>
        ),
      },
      {
        accessorKey: "description",
        header: "Description",
        cell: ({ row }) => (
          <div className="max-w-[300px] truncate text-sm text-muted-foreground">
            {row.getValue("description") || "No description"}
          </div>
        ),
      },
      {
        accessorKey: "video_count",
        header: "Videos",
        cell: ({ row }) => {
          const count = row.getValue("video_count") as number;
          return (
            <Badge variant="outline">
              {count} {count === 1 ? "video" : "videos"}
            </Badge>
          );
        },
      },
      {
        accessorKey: "department_ids",
        header: "Departments",
        cell: ({ row }) => {
          const deptIds = (row.getValue("department_ids") as string[]) || [];
          if (deptIds.length === 0) {
            return <Badge variant="secondary">All Departments</Badge>;
          }
          return (
            <div className="flex flex-wrap gap-1">
              {deptIds.slice(0, 2).map((deptId) => {
                const dept = policiesData?.department_mapping?.[deptId];
                return (
                  <Badge key={deptId} variant="outline">
                    {dept?.name || deptId}
                  </Badge>
                );
              })}
              {deptIds.length > 2 && (
                <Badge variant="outline">+{deptIds.length - 2}</Badge>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "extension",
        header: "Extension",
        cell: ({ row }) => {
          const ext = (row.getValue("extension") as string) || "";
          return ext ? (
            <Badge variant="secondary">{ext.toUpperCase()}</Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const policy = row.original;
          return (
            <div className="flex items-center gap-2">
              {policy.can_edit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(policy.policy_id)}
                  aria-label={`Edit ${policy.name}`}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              )}
              {policy.can_delete && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteClick(policy.policy_id, policy.name)}
                  aria-label={`Delete ${policy.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          );
        },
      },
      // Hidden faceting column for Departments (array of IDs)
      {
        id: "departments",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof policies)[number]) => row.department_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("departments") as string[]) ?? [];
          if (value.length === 0) return true;
          if (rowIds.length === 0) return true; // Show cross-department items when no filter
          return value.some((v) => rowIds.includes(v));
        },
      },
      // Hidden faceting column for Videos (array of IDs)
      {
        id: "videos",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof policies)[number]) => row.video_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("videos") as string[]) ?? [];
          if (value.length === 0) return true;
          if (rowIds.length === 0) return true; // Show policies with no videos when no filter
          return value.some((v) => rowIds.includes(v));
        },
      },
      // Hidden faceting column for Extension
      {
        id: "extension_filter",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof policies)[number]) => row.extension || "",
        filterFn: (row, _id, value: string[]) => {
          const rowExt = (row.getValue("extension_filter") as string) || "";
          if (value.length === 0) return true;
          if (!rowExt) return true; // Show policies with no extension when no filter
          return value.includes(rowExt);
        },
      },
    ],
    [policiesData?.department_mapping]
  );

  // Create table instance
  const table = useReactTable({
    data: policies,
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
        pageSize: 10,
      },
      columnVisibility: {
        departments: false,
        videos: false,
        extension_filter: false,
      },
    },
  });

  const handleDelete = async () => {
    if (!deleteItem || !deletePolicyAction) return;

    setIsDeleting(true);
    try {
      await deletePolicyAction({ body: { policyId: deleteItem.id } });
      toast.success("Policy deleted successfully");
      router.refresh();
    } catch {
      toast.error("Failed to delete policy");
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

  const handleEdit = (id: string) => {
    router.push(`/management/policies/p/${id}`);
  };

  const handleCreateNew = () => {
    router.push("/management/policies/p/new");
  };

  // Get column references for toolbar
  const nameColumn = table.getColumn("name");
  const departmentsColumn = table.getColumn("departments");
  const videosColumn = table.getColumn("videos");
  const extensionColumn = table.getColumn("extension_filter");
  const isFiltered = table.getState().columnFilters.length > 0;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-page="policies-index">
      {policies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 border border-dashed rounded-lg">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No policies yet</h3>
          <p className="text-muted-foreground text-center mb-4">
            Create your first policy to attach to videos
          </p>
          <Button onClick={handleCreateNew}>
            <Plus className="h-4 w-4 mr-2" />
            Create Your First Policy
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Toolbar */}
          <div
            className="flex flex-col md:flex-row md:items-center md:justify-between gap-2"
            data-testid="policies-toolbar"
          >
            <div className="flex flex-col md:flex-row md:flex-1 md:items-center md:space-x-2 gap-2 md:gap-0">
              <div className="w-full md:w-auto">
                <Input
                  data-testid="policies-search"
                  placeholder="Search policies..."
                  value={(nameColumn?.getFilterValue() as string) ?? ""}
                  onChange={(event) =>
                    nameColumn?.setFilterValue(event.target.value)
                  }
                  className="h-8 w-full md:w-[150px] lg:w-[250px]"
                  aria-label="Search policies by name"
                  aria-controls="policies-table"
                />
              </div>

              <div className="flex items-center space-x-2 flex-wrap">
                {/* Department Filter */}
                {departmentsColumn &&
                  departmentOptions.length > 0 &&
                  departmentOptions.length > 1 && (
                    <DataTableFacetedFilter
                      column={departmentsColumn}
                      title="Department"
                      options={departmentOptions}
                    />
                  )}

                {/* Videos Filter */}
                {videosColumn && videoOptions.length > 0 && (
                  <DataTableFacetedFilter
                    column={videosColumn}
                    title="Videos"
                    options={videoOptions}
                  />
                )}

                {/* Extension Filter */}
                {extensionColumn && extensionOptions.length > 0 && (
                  <DataTableFacetedFilter
                    column={extensionColumn}
                    title="Extension"
                    options={extensionOptions}
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

            <Button onClick={handleCreateNew} className="h-8">
              <Plus className="h-4 w-4 mr-2" />
              New Policy
            </Button>
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : header.column.columnDef.header}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {cell.column.columnDef.cell
                            ? cell.column.columnDef.cell(cell.getContext())
                            : null}
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
                      No policies match the current filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <DataTablePagination table={table} />
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent
          aria-labelledby="delete-policy-title"
          data-testid="dialog-delete-policy"
        >
          <AlertDialogHeader>
            <AlertDialogTitle id="delete-policy-title">
              Delete Policy
            </AlertDialogTitle>
            <AlertDialogDescription>
              <p>
                Are you sure you want to delete the policy "{deleteItem?.name}"?
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

