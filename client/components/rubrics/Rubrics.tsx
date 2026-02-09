/**
 * Rubrics.tsx
 * Used to display the rubrics page with table-based filtering and card layout.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";
import { Copy, Edit, Eye, FileCheck, Star, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

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

import type {
  DeleteRubricIn,
  DeleteRubricOut,
  DuplicateRubricIn,
  DuplicateRubricOut,
  RubricsListOut,
  SaveRubricIn,
  SaveRubricOut,
} from "@/app/(main)/system/rubrics/page";
import TableRubric from "@/components/common/rubric/TableRubric";
import { DataTableFacetedFilter } from "@/components/common/table/DataTableFacetedFilter";
import { DataTablePagination } from "@/components/common/table/DataTablePagination";
import { useProfile } from "@/contexts/profile-context";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export interface RubricsProps {
  // Server-provided data (for server-side rendering)
  listData: RubricsListOut;
  // Server actions (replaces useMutation)
  duplicateRubricAction?: (
    input: DuplicateRubricIn,
  ) => Promise<DuplicateRubricOut>;
  deleteRubricAction?: (input: DeleteRubricIn) => Promise<DeleteRubricOut>;
  saveRubricAction?: (input: SaveRubricIn) => Promise<SaveRubricOut>;
}

export default function Rubrics({
  listData: serverListData,
  duplicateRubricAction,
  deleteRubricAction,
}: RubricsProps) {
  const router = useRouter();
  const { profile } = useProfile();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);

  // Table state
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "name", desc: false },
  ]);

  // Use server-provided data directly
  const rubricsData = serverListData;

  const rubrics = useMemo(() => rubricsData?.rubrics || [], [rubricsData]);
  const standardGroups = useMemo(
    () => rubricsData?.standard_groups || [],
    [rubricsData],
  );
  const standards = useMemo(
    () => rubricsData?.standards || [],
    [rubricsData],
  );
  const departments = useMemo(
    () => rubricsData?.departments || [],
    [rubricsData],
  );

  // Build filter options - filter to only show options that have actual data
  const departmentOptions = useMemo(() => {
    const allDepartmentIds = new Set<string>();
    rubrics.forEach((rubric) => {
      if (rubric.department_ids) {
        rubric.department_ids.forEach((id) => allDepartmentIds.add(id));
      }
    });
    return departments
      .filter((dept) => dept.department_id && allDepartmentIds.has(String(dept.department_id)))
      .map((dept) => ({
        value: String(dept.department_id),
        label: dept.name || String(dept.department_id),
      }));
  }, [departments, rubrics]);

  // Use server-provided simulation options (SQL handles filtering and disambiguation)
  const simulationOptions = useMemo(() => {
    return (rubricsData?.simulation_options || []).map((opt) => ({
      value: String(opt.simulation_id),
      label: opt.name || String(opt.simulation_id),
    }));
  }, [rubricsData?.simulation_options]);

  // Filter pass percentage options to only show ranges that have actual data
  const passPercentageOptions = useMemo(() => {
    const allRanges = [
      { value: "0-25", label: "0-25%", min: 0, max: 25 },
      { value: "26-50", label: "26-50%", min: 26, max: 50 },
      { value: "51-75", label: "51-75%", min: 51, max: 75 },
      { value: "76-100", label: "76-100%", min: 76, max: 100 },
    ];

    // Check which ranges have rubrics
    const rangesWithData = allRanges.filter((range) => {
      return rubrics.some((rubric) => {
        const percentage = rubric.pass_percentage ?? 0;
        return percentage >= range.min && percentage <= range.max;
      });
    });

    return rangesWithData.map(({ value, label }) => ({ value, label }));
  }, [rubrics]);

  // Column definitions for TanStack Table
  const columns = useMemo<ColumnDef<(typeof rubrics)[number]>[]>(
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
      // Hidden faceting column for Pass Percentage (server-provided)
      {
        id: "passPercentage",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof rubrics)[number]) => {
          // Return the range string that this percentage falls into for faceting
          const percentage = row.pass_percentage ?? 0;
          if (percentage >= 0 && percentage <= 25) return "0-25";
          if (percentage >= 26 && percentage <= 50) return "26-50";
          if (percentage >= 51 && percentage <= 75) return "51-75";
          if (percentage >= 76 && percentage <= 100) return "76-100";
          return null;
        },
        filterFn: (row, _id, value: string[]) => {
          const percentage = row.original.pass_percentage ?? 0;
          return value.some((range) => {
            const [min, max] = range.split("-").map(Number);
            return (
              min !== undefined &&
              max !== undefined &&
              percentage >= min &&
              percentage <= max
            );
          });
        },
      },
      // Hidden faceting column for Simulation (array of IDs)
      {
        id: "simulations",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof rubrics)[number]) => row.simulation_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("simulations") as string[]) ?? [];
          if (value.length === 0) return true;
          if (rowIds.length === 0) return true; // Show rubrics with no simulations when no filter
          return value.some((v) => rowIds.includes(v));
        },
      },
      // Hidden faceting column for Departments (array of IDs)
      {
        id: "departments",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: (typeof rubrics)[number]) => row.department_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("departments") as string[]) ?? [];
          if (value.length === 0) return true;
          if (rowIds.length === 0) return true; // Show cross-department items when no filter
          return value.some((v) => rowIds.includes(v));
        },
      },
    ],
    [],
  );

  // Create table instance
  const table = useReactTable({
    data: rubrics,
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
    rubrics.length,
    // Use pagination primitives directly (not object references)
    pageIndex,
    pageSize,
  ]);

  const handleDelete = async () => {
    if (!deleteItem || !deleteRubricAction) return;

    // Ensure profileId exists - required for API calls
    if (!profile?.id) {
      toast.error("Profile not loaded. Please refresh the page.");
      return;
    }

    setIsDeleting(true);
    try {
      await deleteRubricAction({
        body: {
          rubric_id: deleteItem.id,
        },
      });
      toast.success("Rubric deleted successfully");
      router.refresh();
    } catch {
      toast.error("Failed to delete rubric");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setDeleteItem(null);
    }
  };

  const handleDuplicate = async (rubric: (typeof rubrics)[number]) => {
    if (!rubric.can_duplicate || !duplicateRubricAction) {
      toast.error("This rubric cannot be duplicated");
      return;
    }

    // Ensure profileId exists - required for API calls
    if (!profile?.id) {
      toast.error("Profile not loaded. Please refresh the page.");
      return;
    }

    setIsDuplicating(rubric.rubric_id);
    try {
      await duplicateRubricAction({
        body: {
          rubric_id: rubric.rubric_id ?? "",
        },
      });
      toast.success(`Rubric "${rubric.name}" duplicated successfully`);
      router.refresh();
    } catch {
      toast.error("Failed to duplicate rubric");
    } finally {
      setIsDuplicating(null);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteItem({ id, name });
    setShowDeleteDialog(true);
  };

  const handleEdit = (id: string) => {
    router.push(`/system/rubrics/r/${id}`);
  };

  const renderRubricCard = (rubric: (typeof rubrics)[number]) => {
    // Calculate pass percentage from standard groups (sum of passPoints / sum of points)
    // This matches how RubricDetails calculates it
    const groupIds = rubric.standard_group_ids || [];
    let totalPoints = 0;
    let totalPassPoints = 0;

    groupIds.forEach((groupId) => {
      const group = standardGroups.find((g) => g.standard_group_id === groupId);
      if (group) {
        totalPoints += group.points || 0;
        totalPassPoints += group.pass_points || 0;
      }
    });

    const passPercentage =
      totalPoints > 0
        ? Math.round((totalPassPoints / totalPoints) * 100)
        : (rubric.pass_percentage ?? 0); // Fallback to server value if no groups

    return (
      <Card
        key={rubric.rubric_id}
        className="w-full"
        data-testid="rubric-card"
        data-rubric-id={rubric.rubric_id}
      >
        {/* Header */}
        <CardHeader className="border-b">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-2 flex-1">
              <CardTitle className="text-2xl font-bold">
                {rubric.name}
              </CardTitle>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4" />
                  {rubric.points} total points
                </div>
                <div className="flex items-center gap-2">
                  <FileCheck className="h-4 w-4" />
                  Pass: {rubric.pass_points ?? 0} pts ({passPercentage}%)
                </div>
              </div>
              {rubric.description && (
                <p className="text-sm text-muted-foreground max-w-2xl">
                  {rubric.description}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {rubric.can_edit ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    if (rubric.rubric_id) handleEdit(rubric.rubric_id);
                  }}
                  data-testid="btn-edit-rubric"
                  aria-label="Edit rubric"
                >
                  <Edit className="h-4 w-4 md:mr-0 md:ml-0 mr-2" />
                  <span className="md:hidden">Edit</span>
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => {
                    if (rubric.rubric_id) handleEdit(rubric.rubric_id);
                  }}
                  aria-label={`View ${rubric.name}`}
                  data-testid="btn-view-rubric"
                >
                  <Eye className="h-4 w-4 md:mr-0 md:ml-0 mr-2" />
                  <span className="md:hidden">View</span>
                </Button>
              )}
              {rubric.can_duplicate && (
                <Button
                  variant="outline"
                  onClick={() => handleDuplicate(rubric)}
                  disabled={isDuplicating === rubric.rubric_id}
                  data-testid="btn-duplicate-rubric"
                  aria-label="Duplicate rubric"
                >
                  {isDuplicating === rubric.rubric_id ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent md:mr-0 md:ml-0 mr-2" />
                      <span className="md:hidden">Duplicating...</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 md:mr-0 md:ml-0 mr-2" />
                      <span className="md:hidden">Duplicate</span>
                    </>
                  )}
                </Button>
              )}
              {rubric.can_delete && (
                <Button
                  variant="outline"
                  onClick={() => {
                    if (rubric.rubric_id) {
                      handleDeleteClick(rubric.rubric_id, rubric.name ?? "");
                    }
                  }}
                  data-testid="btn-delete-rubric"
                  aria-label="Delete rubric"
                >
                  <Trash2 className="h-4 w-4 md:mr-0 md:ml-0 mr-2" />
                  <span className="md:hidden">Delete</span>
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        {/* Rubric Table */}
        <CardContent className="p-6">
          <TableRubric
            standardGroups={(() => {
              // Convert standard_group_ids array to dict format expected by TableRubric
              const groupsDict: Record<string, string[]> = {};
              const groupIds = rubric.standard_group_ids || [];
              groupIds.forEach((groupId) => {
                const group = standardGroups.find((g) => g.standard_group_id === groupId);
                if (group && "standard_ids" in group && group.standard_ids) {
                  groupsDict[String(groupId)] = (group.standard_ids as string[]).map(String);
                }
              });
              return groupsDict;
            })()}
            standardGroupsMapping={(() => {
              // Convert standard_groups array to dict format expected by TableRubric
              const mapping: Record<string, { name: string; description: string; points: number; passPoints: number }> = {};
              standardGroups.forEach((group) => {
                if (group.standard_group_id) {
                  mapping[String(group.standard_group_id)] = {
                    name: group.name || "",
                    description: group.description || "",
                    points: group.points || 0,
                    passPoints: group.pass_points || 0,
                  };
                }
              });
              return mapping;
            })()}
            standardsMapping={(() => {
              // Convert standards array to dict format expected by TableRubric
              const mapping: Record<string, { name: string; description: string; points: number }> = {};
              standards.forEach((standard) => {
                if (standard.standard_id) {
                  mapping[String(standard.standard_id)] = {
                    name: standard.name || "",
                    description: standard.description || "",
                    points: standard.points || 0,
                  };
                }
              });
              return mapping;
            })()}
            showFullStandardsOnMobile={true}
          />
        </CardContent>
      </Card>
    );
  };

  // Get column references for toolbar
  const nameColumn = table.getColumn("name");
  const passPercentageColumn = table.getColumn("passPercentage");
  const departmentsColumn = table.getColumn("departments");
  const simulationsColumn = table.getColumn("simulations");
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="space-y-6">
      <div className="space-y-4" data-testid="rubrics-data-table">
        {/* Toolbar */}
        <div
          className="flex flex-col md:flex-row md:items-center md:justify-between gap-2"
          data-testid="rubrics-toolbar"
        >
          <div className="flex flex-col md:flex-row md:flex-1 md:items-center md:space-x-2 gap-2 md:gap-0">
            <div className="w-full md:w-auto">
              <Input
                placeholder="Search rubrics..."
                value={(nameColumn?.getFilterValue() as string) ?? ""}
                onChange={(event) =>
                  nameColumn?.setFilterValue(event.target.value)
                }
                className="h-8 w-full md:w-[150px] lg:w-[250px]"
                data-testid="rubrics-search"
              />
            </div>

            <div className="flex items-center space-x-2 flex-wrap">
              {passPercentageColumn && passPercentageOptions.length > 0 && (
                <DataTableFacetedFilter
                  column={passPercentageColumn}
                  title="Pass %"
                  options={passPercentageOptions}
                />
              )}

              {departmentsColumn && departmentOptions.length > 0 && (
                <DataTableFacetedFilter
                  column={departmentsColumn}
                  title="Department"
                  options={departmentOptions}
                />
              )}

              {simulationsColumn && simulationOptions.length > 0 && (
                <DataTableFacetedFilter
                  column={simulationsColumn}
                  title="Simulation"
                  options={simulationOptions}
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

        {/* Rubrics cards */}
        <div className="space-y-4" data-testid="rubrics-grid">
          {tableRows.length ? (
            tableRows.map((row) => renderRubricCard(row.original))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No rubrics match the current filters.
            </div>
          )}
        </div>

        {/* Pagination */}
        <DataTablePagination table={table} card={true} />
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent data-testid="dialog-delete-rubric">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rubric</AlertDialogTitle>
            <AlertDialogDescription>
              <p>
                Are you sure you want to delete the rubric "{deleteItem?.name}"?
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
              variant="destructive"
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
