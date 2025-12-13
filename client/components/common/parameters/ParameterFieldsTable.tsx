"use client";

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
import * as React from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Power, Trash2, FileText } from "lucide-react";

export interface FieldConnectionItem {
  field_id: string;
  name: string;
  description: string;
  default: boolean;
  active: boolean;
  usage_count?: number;
  isConnected: boolean; // Whether this field is connected to the parameter
}

export interface ParameterFieldsTableProps {
  data: FieldConnectionItem[]; // All available fields with connection status
  fieldMapping: Record<string, { name: string; description?: string; usage_count?: number; department_ids?: string[] | null }>;
  validFieldIds: string[];
  selectedFieldIds: string[]; // Currently connected field IDs
  onFieldSelect?: (ids: string[]) => void;
  onDefaultToggle?: (fieldId: string, isDefault: boolean) => void;
  onActiveToggle?: (fieldId: string, isActive: boolean) => void;
  onRemoveConnection?: (fieldId: string) => void;
  readonly?: boolean;
}

export function ParameterFieldsTable({
  data,
  fieldMapping,
  validFieldIds,
  selectedFieldIds,
  onFieldSelect,
  onDefaultToggle,
  onActiveToggle,
  onRemoveConnection,
  readonly = false,
}: ParameterFieldsTableProps) {
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "name", desc: false },
  ]);

  // Columns definition
  const columns: ColumnDef<FieldConnectionItem>[] = React.useMemo(
    () => [
      {
        accessorKey: "name",
        size: 200,
        header: () => (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex flex-col items-center gap-1 cursor-help">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs">Name</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Field name</p>
            </TooltipContent>
          </Tooltip>
        ),
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="flex flex-col w-[200px]">
              <span
                className="font-medium text-sm leading-tight whitespace-normal inline-flex items-center gap-1.5"
                style={{ wordBreak: "break-word", overflowWrap: "break-word" }}
              >
                <FileText className="h-4 w-4 text-blue-600 flex-shrink-0" />
                {item.name}
                {!item.isConnected && (
                  <Badge
                    variant="outline"
                    className="bg-gray-50 text-gray-600 text-xs px-1 py-0 flex-shrink-0"
                  >
                    Not Connected
                  </Badge>
                )}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "description",
        size: 300,
        header: () => (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex flex-col items-center gap-1 cursor-help">
                <span className="text-xs">Description</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Field description</p>
            </TooltipContent>
          </Tooltip>
        ),
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="w-[300px]">
              <span className="text-sm text-muted-foreground whitespace-normal">
                {item.description}
              </span>
            </div>
          );
        },
      },
      {
        id: "default",
        header: () => (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex flex-col items-center gap-1 cursor-help">
                <Power className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs">Default</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Mark as default field (only one can be default)</p>
            </TooltipContent>
          </Tooltip>
        ),
        cell: ({ row }) => {
          const item = row.original;
          if (!item.isConnected) {
            return (
              <div className="flex items-center justify-center">
                <span className="text-xs text-muted-foreground">-</span>
              </div>
            );
          }
          return (
            <div className="flex items-center justify-center">
              <Switch
                checked={item.default}
                onCheckedChange={(checked) => {
                  if (onDefaultToggle) {
                    onDefaultToggle(item.field_id, checked);
                  }
                }}
                disabled={readonly || !onDefaultToggle}
              />
            </div>
          );
        },
      },
      {
        id: "active",
        header: () => (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex flex-col items-center gap-1 cursor-help">
                <Power className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs">Active</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Enable or disable this field connection</p>
            </TooltipContent>
          </Tooltip>
        ),
        cell: ({ row }) => {
          const item = row.original;
          if (!item.isConnected) {
            return (
              <div className="flex items-center justify-center">
                <span className="text-xs text-muted-foreground">-</span>
              </div>
            );
          }
          return (
            <div className="flex items-center justify-center">
              <Switch
                checked={item.active}
                onCheckedChange={(checked) => {
                  if (onActiveToggle) {
                    onActiveToggle(item.field_id, checked);
                  }
                }}
                disabled={readonly || !onActiveToggle}
              />
            </div>
          );
        },
      },
      {
        id: "actions",
        header: () => (
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs">Actions</span>
          </div>
        ),
        cell: ({ row }) => {
          const item = row.original;
          if (!item.isConnected) {
            return (
              <div className="flex items-center justify-center">
                <span className="text-xs text-muted-foreground">-</span>
              </div>
            );
          }
          return (
            <div className="flex items-center justify-center">
              {onRemoveConnection && !readonly && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveConnection(item.field_id)}
                      className="h-8 w-8 p-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Remove field connection</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          );
        },
      },
    ],
    [readonly, onDefaultToggle, onActiveToggle, onRemoveConnection],
  );

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  const tableRows = React.useMemo(() => {
    return table.getRowModel().rows;
  }, [table]);

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header with picker */}
        <div className="flex justify-between items-center">
          <div>
            <Label>Fields</Label>
            <p className="text-sm text-muted-foreground">
              Manage field connections to this parameter
            </p>
          </div>
          {!readonly && onFieldSelect && (
            <div className="w-[200px]">
              <GenericPicker
                items={fieldMapping}
                itemIds={validFieldIds}
                selectedIds={selectedFieldIds}
                onSelect={onFieldSelect}
                getId={(item) => (item as unknown as { id: string }).id}
                getLabel={(item) => item.name || ""}
                getSearchText={(item) => `${item.name} ${item.description || ""}`}
                placeholder="Add fields..."
                multiSelect={true}
                hideSelectedChips={true}
                buttonClassName="h-9 w-full"
                groupHeading="Fields"
              />
            </div>
          )}
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="text-center whitespace-normal"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {tableRows?.length ? (
                tableRows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className="border-r px-3 py-2 text-center min-h-[60px]"
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center px-6"
                  >
                    No fields found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </TooltipProvider>
  );
}

