/**
 * Settings.tsx
 * Used to display the settings list page.
 * List-only component following Personas.tsx pattern
 */
"use client";
import { Edit, Eye, Settings as SettingsIcon, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

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

import type { SettingsListOut } from "@/app/(main)/settings/page";
import { DataTableFacetedFilter } from "@/components/common/table/DataTableFacetedFilter";
import { DataTablePagination } from "@/components/common/table/DataTablePagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useProfile } from "@/contexts/profile-context";

export interface SettingsProps {
  // Server-provided data (for server-side rendering)
  listData: SettingsListOut;
}

export default function Settings({ listData: serverListData }: SettingsProps) {
  const { departmentIds } = useProfile();
  const router = useRouter();

  // Table state
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "created_at", desc: true },
  ]);

  // Use server-provided data directly
  const settingsData = serverListData;

  // Extract data from response
  const settings = settingsData?.settings || [];

  // Derive department options from settings (extract unique department IDs)
  const departmentOptions = useMemo(() => {
    const deptSet = new Set<string>();
    settings.forEach((setting) => {
      (setting.department_ids || []).forEach((deptId) => {
        if (deptId) deptSet.add(deptId);
      });
    });
    // Note: We'd need department names from a separate API call or include them in list response
    // For now, just use IDs
    return Array.from(deptSet).map((deptId) => ({
      value: deptId,
      label: deptId, // Would be better to have department names
    }));
  }, [settings]);

  // Define table columns
  const columns: ColumnDef<(typeof settings)[number]>[] = useMemo(() => {
    return [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => {
          const setting = row.original;
          return (
            <div className="font-medium">
              {setting.name || "Unnamed Setting"}
            </div>
          );
        },
      },
      {
        accessorKey: "description",
        header: "Description",
        cell: ({ row }) => {
          const setting = row.original;
          return (
            <div className="text-sm text-muted-foreground">
              {setting.description || "No description available"}
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
        accessorFn: (row: (typeof settings)[number]) =>
          row.department_ids ?? [],
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("departments") as string[]) ?? [];
          if (value.length === 0) return true;
          if (rowIds.length === 0) return true; // Show cross-department items when no filter
          return value.some((v) => rowIds.includes(v));
        },
      },
      {
        accessorKey: "active",
        header: "Status",
        cell: ({ row }) => {
          const setting = row.original;
          return (
            <div className="text-sm">
              {setting.active ? (
                <Badge variant="default">Active</Badge>
              ) : (
                <Badge variant="secondary">Inactive</Badge>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "created_at",
        header: "Created",
        cell: ({ row }) => {
          const createdAt = row.original.created_at;
          if (!createdAt) {
            return <div className="text-sm text-muted-foreground">—</div>;
          }
          const date = new Date(createdAt);
          return (
            <div className="text-sm text-muted-foreground">
              {date.toLocaleDateString()}
            </div>
          );
        },
      },
    ];
  }, []);

  // Create table instance
  const table = useReactTable({
    data: settings,
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

  // Memoize table rows to avoid calling getRowModel() multiple times
  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  const sortingKey = JSON.stringify(sorting);
  const columnFiltersKey = JSON.stringify(columnFilters);
  const tableRows = useMemo(() => {
    return table.getRowModel().rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortingKey, columnFiltersKey, settings.length, pageIndex, pageSize]);

  const handleEdit = (id: string) => {
    router.push(`/settings/${id}`);
  };

  const handleView = (id: string) => {
    router.push(`/settings/${id}`);
  };

  const renderSettingCard = (setting: (typeof settings)[0]) => {
    return (
      <Card
        key={setting.settings_id}
        className="hover:shadow-md transition-shadow"
        data-testid="setting-card"
        data-setting-id={setting.settings_id}
        role="gridcell"
        aria-label={`setting card ${setting.name || "Unnamed Setting"}`}
      >
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="space-y-2 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg shadow-lg flex-shrink-0 bg-primary/10">
                  <SettingsIcon className="h-4 w-4 text-primary" />
                </div>
                <CardTitle className="text-lg truncate">
                  {setting.name || "Unnamed Setting"}
                </CardTitle>
              </div>
              <div className="mt-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  {setting.active ? (
                    <Badge variant="default">Active</Badge>
                  ) : (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                  {setting.department_ids && setting.department_ids.length > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {setting.department_ids.length} department
                      {setting.department_ids.length !== 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (setting.settings_id) {
                    handleEdit(setting.settings_id);
                  }
                }}
                aria-label={`Edit setting ${setting.name || "Unnamed"}`}
                data-testid="btn-edit-setting"
                title={`Edit setting ${setting.name || "Unnamed"}`}
                className="h-9 px-3"
              >
                <Edit className="h-4 w-4 md:mr-0 mr-2" />
                <span className="md:hidden">Edit</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (setting.settings_id) {
                    handleView(setting.settings_id);
                  }
                }}
                aria-label={`View setting ${setting.name || "Unnamed"}`}
                data-testid="btn-view-setting"
                title={`View setting ${setting.name || "Unnamed"}`}
                className="h-9 px-3"
              >
                <Eye className="h-4 w-4 md:mr-0 mr-2" />
                <span className="md:hidden">View</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 flex-grow flex flex-col">
          <p className="text-sm text-muted-foreground line-clamp-2 flex-grow">
            {setting.description || "No description available"}
          </p>
        </CardContent>
      </Card>
    );
  };

  // Get column references for toolbar
  const nameColumn = table.getColumn("name");
  const departmentsColumn = table.getColumn("departments");
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="space-y-8" data-page="settings-index">
      <div className="space-y-4">
        {/* Toolbar */}
        <div
          className="flex flex-col md:flex-row md:items-center md:justify-between gap-2"
          data-testid="settings-toolbar"
        >
          <div className="flex flex-col md:flex-row md:flex-1 md:items-center md:space-x-2 gap-2 md:gap-0">
            <div className="w-full md:w-auto">
              <Input
                data-testid="settings-search"
                placeholder="Search settings..."
                value={(nameColumn?.getFilterValue() as string) ?? ""}
                onChange={(event) =>
                  nameColumn?.setFilterValue(event.target.value)
                }
                className="h-8 w-full md:w-[150px] lg:w-[250px]"
                aria-label="Search settings by name"
                aria-controls="settings-grid"
              />
            </div>

            <div className="flex items-center space-x-2 flex-wrap">
              {/* Department Filter */}
              {departmentsColumn &&
                departmentOptions.length > 0 &&
                departmentIds.length > 1 && (
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
          aria-label="settings grid"
          data-testid="settings-grid"
        >
          {tableRows.length ? (
            tableRows.map((row) => renderSettingCard(row.original))
          ) : (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              No settings match the current filters.
            </div>
          )}
        </div>

        {/* Pagination */}
        <div aria-label="pagination controls">
          <DataTablePagination table={table} card={true} />
        </div>
      </div>
    </div>
  );
}
