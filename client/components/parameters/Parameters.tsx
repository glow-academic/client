/**
 * Parameters.tsx
 * Parameters component showing overview of parameter items
 * @AshokSaravanan222 & @siladiea
 * 07/21/2025
 */
"use client";
import {
  Book,
  Calendar,
  Clock,
  Copy,
  Edit,
  Eye,
  Hash,
  List,
  MapPin,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

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

import { useProfile } from "@/contexts/profile-context";
import { api } from "@/lib/api/client";
import { keys } from "@/lib/query/keys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DataTablePagination } from "@/components/common/history/DataTablePagination";
import { DataTableFacetedFilter } from "@/components/common/history/DataTableFacetedFilter";
import { Input } from "@/components/ui/input";

export default function Parameters() {
  const router = useRouter();
  const { effectiveProfile } = useProfile();
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);
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

  const queryClient = useQueryClient();

  // V3 API: Single fetch with pre-calculated counts and permissions
  const filters = useMemo(
    () => ({
      profileId: effectiveProfile?.id || "",
    }),
    [effectiveProfile?.id]
  );

  const { data: parametersData, isLoading } = useQuery({
    queryKey: keys.parameters.list(filters),
    queryFn: () => api.post("/parameters/list", { body: filters }),
    enabled: !!effectiveProfile?.id,
  });

  // Mutations with V3 API
  const duplicateParameterMutation = useMutation({
    mutationFn: (req: { parameterId: string }) =>
      api.post("/parameters/duplicate", { body: req }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.parameters.all });
    },
  });

  const deleteParameterMutation = useMutation({
    mutationFn: (req: { parameterId: string }) =>
      api.post("/parameters/delete", { body: req }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.parameters.all });
    },
  });
  const parameters = useMemo(
    () => parametersData?.parameters || [],
    [parametersData]
  );

  // Build department options from mapping
  const departmentOptions = useMemo(() => {
    const mapping = parametersData?.department_mapping || {};
    return Object.entries(mapping).map(([id, obj]) => ({
      value: id,
      label: obj.name,
    }));
  }, [parametersData?.department_mapping]);

  // Column definitions for TanStack Table
  const columns = useMemo<ColumnDef<(typeof parameters)[number]>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => row.getValue("name"),
        filterFn: (row, id, value) => {
          const name = String(row.getValue(id)).toLowerCase();
          const desc = String(row.original.description).toLowerCase();
          const query = String(value).toLowerCase();
          return name.includes(query) || desc.includes(query);
        },
      },
      {
        accessorKey: "numerical",
        header: "Type",
        cell: ({ row }) => (row.getValue("numerical") ? "Numerical" : "Text"),
        filterFn: (row, id, value) => {
          return value.includes(String(row.getValue(id)));
        },
      },
      {
        accessorKey: "num_items",
        header: "Items",
        cell: ({ row }) => row.getValue("num_items"),
        filterFn: (row, id, value) => {
          const count = Number(row.getValue(id));
          return value.some((range: string) => {
            if (range === "0") return count === 0;
            if (range === "1-3") return count >= 1 && count <= 3;
            if (range === "4-6") return count >= 4 && count <= 6;
            if (range === "7+") return count >= 7;
            return false;
          });
        },
      },
      {
        accessorKey: "active",
        header: "Status",
        cell: ({ row }) => (row.getValue("active") ? "Active" : "Inactive"),
        filterFn: (row, id, value) => {
          return value.includes(String(row.getValue(id)));
        },
      },
      {
        accessorKey: "updated_at",
        header: "Updated",
        cell: ({ row }) => row.getValue("updated_at"),
      },
      // Hidden faceting column for Departments (array of IDs)
      {
        id: "departments",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof parameters)[number]) => row.department_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("departments") as string[]) ?? [];
          if (value.length === 0) return true;
          if (rowIds.length === 0) return true; // Show cross-department items when no filter
          return value.some((v) => rowIds.includes(v));
        },
      },
    ],
    []
  );

  // Create table instance
  const table = useReactTable({
    data: parameters,
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

  const handleDuplicate = async (parameter: (typeof parameters)[number]) => {
    if (!parameter.can_duplicate) {
      toast.error("This parameter cannot be duplicated");
      return;
    }

    setIsDuplicating(parameter.parameter_id);
    try {
      await duplicateParameterMutation.mutateAsync({
        parameterId: parameter.parameter_id,
      });
      toast.success(`Parameter "${parameter.name}" duplicated successfully`);
    } catch (error) {
      toast.error("Failed to duplicate parameter");
    } finally {
      setIsDuplicating(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;

    try {
      await deleteParameterMutation.mutateAsync({
        parameterId: deleteItem.id,
      });
      toast.success(`Parameter "${deleteItem.name}" deleted successfully`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete parameter"
      );
    } finally {
      setShowDeleteDialog(false);
      setDeleteItem(null);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteItem({ id, name });
    setShowDeleteDialog(true);
  };

  const getParameterIcon = (parameter: ParameterItem) => {
    // Return different icons based on parameter name or type
    const name = parameter.name.toLowerCase();
    if (name.includes("class") || name.includes("course"))
      return <Book className="h-5 w-5" />;
    if (name.includes("location") || name.includes("place"))
      return <MapPin className="h-5 w-5" />;
    if (name.includes("deadline") || name.includes("due"))
      return <Calendar className="h-5 w-5" />;
    if (name.includes("time") || name.includes("hour"))
      return <Clock className="h-5 w-5" />;
    if (parameter.numerical) return <Hash className="h-5 w-5" />;
    return <List className="h-5 w-5" />;
  };

  const renderPreview = (
    items: ParameterSampleItem[],
    numerical: boolean,
    totalCount: number
  ) => {
    if (numerical) {
      // Sort by numeric value
      const sortedItems = [...items].sort((a, b) => {
        const aVal = parseFloat(a.value) || 0;
        const bVal = parseFloat(b.value) || 0;
        return aVal - bVal;
      });

      return (
        <div className="space-y-2">
          {sortedItems.map((item) => (
            <div
              key={item.parameter_item_id}
              className="flex items-center justify-between p-2 bg-muted/50 rounded-md"
            >
              <div>
                <p className="text-sm font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  Value: {item.value}
                </p>
              </div>
            </div>
          ))}
          {totalCount > 3 && (
            <p className="text-xs text-muted-foreground">
              +{totalCount - 3} more
            </p>
          )}
        </div>
      );
    } else {
      // Non-numerical: show name + description
      return (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.parameter_item_id}
              className="flex items-center justify-between p-2 bg-muted/50 rounded-md"
            >
              <div>
                <p className="text-sm font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
          {totalCount > 3 && (
            <p className="text-xs text-muted-foreground">
              +{totalCount - 3} more
            </p>
          )}
        </div>
      );
    }
  };

  const renderParameterCard = (parameter: (typeof parameters)[number]) => {
    const count = parameter.num_items; // Pre-calculated from server

    return (
      <Card
        key={parameter.parameter_id}
        className="relative flex flex-col h-full"
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg flex items-center gap-2">
                {getParameterIcon(parameter)}
                {parameter.name}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline">
                  {count} {count === 1 ? "item" : "items"}
                </Badge>
                {parameter.department_ids?.length === 0 && (
                  <Badge variant="secondary" className="text-xs">
                    Default
                  </Badge>
                )}
                {parameter.numerical && (
                  <Badge variant="default" className="text-xs">
                    Numerical
                  </Badge>
                )}
                {!parameter.active && (
                  <Badge variant="secondary" className="text-xs">
                    Inactive
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {parameter.can_edit ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    router.push(
                      `/management/parameters/p/${parameter.parameter_id}`
                    )
                  }
                  aria-label={`Edit ${parameter.name}`}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    router.push(
                      `/management/parameters/p/${parameter.parameter_id}`
                    )
                  }
                  aria-label={`View ${parameter.name}`}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              )}
              {parameter.can_duplicate && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDuplicate(parameter)}
                  disabled={isDuplicating === parameter.parameter_id}
                  aria-label={`Duplicate ${parameter.name}`}
                >
                  {isDuplicating === parameter.parameter_id ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              )}
              {parameter.can_delete && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    handleDeleteClick(parameter.parameter_id, parameter.name)
                  }
                  aria-label={`Delete ${parameter.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 flex-grow flex flex-col">
          {parameter.sample_items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No items yet</p>
          ) : (
            renderPreview(
              parameter.sample_items,
              parameter.numerical,
              parameter.num_items
            )
          )}
        </CardContent>
      </Card>
    );
  };

  const renderEmptyState = () => (
    <div className="col-span-full">
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No parameters yet</h3>
          <p className="text-muted-foreground text-center mb-4">
            Create your first parameter to organize configuration options
          </p>
          <Button onClick={() => router.push("/management/parameters/new")}>
            <Plus className="h-4 w-4 mr-2" />
            Create Your First Parameter
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>

        {/* Parameters grid skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <Skeleton className="h-8 w-8 rounded" />
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4 mb-3" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3 w-3" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Get column references for toolbar
  const nameColumn = table.getColumn("name");
  const typeColumn = table.getColumn("numerical");
  const itemCountColumn = table.getColumn("num_items");
  const statusColumn = table.getColumn("active");
  const departmentsColumn = table.getColumn("departments");
  const isFiltered = table.getState().columnFilters.length > 0;

  const typeOptions = [
    { value: "true", label: "Numerical" },
    { value: "false", label: "Text" },
  ];

  const itemCountOptions = [
    { value: "0", label: "0 items" },
    { value: "1-3", label: "1-3 items" },
    { value: "4-6", label: "4-6 items" },
    { value: "7+", label: "7+ items" },
  ];

  const statusOptions = [
    { value: "true", label: "Active" },
    { value: "false", label: "Inactive" },
  ];

  return (
    <div className="space-y-6">
      {parameters.length === 0 ? (
        renderEmptyState()
      ) : (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between">
            <div className="flex flex-1 items-center space-x-2 flex-wrap">
              <div className="mb-2">
                <Input
                  placeholder="Search parameters..."
                  value={(nameColumn?.getFilterValue() as string) ?? ""}
                  onChange={(event) =>
                    nameColumn?.setFilterValue(event.target.value)
                  }
                  className="h-8 w-[150px] lg:w-[250px]"
                />
              </div>

              <div className="flex items-center space-x-2 flex-wrap mb-2">
                {typeColumn && (
                  <DataTableFacetedFilter
                    column={typeColumn}
                    title="Type"
                    options={typeOptions}
                  />
                )}

                {itemCountColumn && (
                  <DataTableFacetedFilter
                    column={itemCountColumn}
                    title="Items"
                    options={itemCountOptions}
                  />
                )}

                {statusColumn && (
                  <DataTableFacetedFilter
                    column={statusColumn}
                    title="Status"
                    options={statusOptions}
                  />
                )}

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
              table.getRowModel().rows.map((row) => renderParameterCard(row.original))
            ) : (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                No parameters match the current filters.
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
            <AlertDialogTitle>Delete Parameter</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteItem?.name}&quot;?
              This action cannot be undone.
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
