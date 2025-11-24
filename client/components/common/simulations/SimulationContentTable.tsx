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

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { RubricPicker } from "@/components/common/forms/RubricPicker";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ArrowDown, ArrowUp, Trash2, Video, FileText, Lightbulb, Target, Shield, ShieldCheck, Image } from "lucide-react";

export interface ContentItem {
  type: "scenario" | "video";
  id: string;
  title: string;
  description: string;
  active: boolean;
  position: number;
  usage_count: number;
  success_rate: number;
  last_used: string | null;
  can_remove: boolean;
  isNew?: boolean; // For staged items
  // Scenario-specific
  length_seconds?: number; // Video-specific
  // Switch fields (scenarios only, except objectives_enabled which applies to both)
  hints_enabled?: boolean;
  objectives_enabled?: boolean;
  input_guardrail_enabled?: boolean;
  output_guardrail_enabled?: boolean;
  image_input_enabled?: boolean;
  rubric_id?: string | null;
  time_limit_seconds?: number | null; // Per-scenario time limit in seconds
}

export interface SimulationContentTableProps {
  data: ContentItem[];
  selectedContentIds: string[];
  onContentSelect: (contentId: string, checked: boolean) => void;
  onSelectAll: (checked: boolean, visibleRowIds?: string[]) => void;
  onActiveToggle: (contentId: string, active: boolean) => void;
  onMoveUp: (contentId: string) => void;
  onMoveDown: (contentId: string) => void;
  onRemove: (contentId: string) => void;
  onBulkEdit: () => void;
  onBulkDelete: () => void;
  // Switch toggle handlers
  onHintsToggle?: (contentId: string, enabled: boolean) => void;
  onObjectivesToggle?: (contentId: string, enabled: boolean) => void;
  onInputGuardrailToggle?: (contentId: string, enabled: boolean) => void;
  onOutputGuardrailToggle?: (contentId: string, enabled: boolean) => void;
  onImageInputToggle?: (contentId: string, enabled: boolean) => void;
  onRubricChange?: (contentId: string, rubricId: string | null) => void;
  onTimeLimitChange?: (contentId: string, timeLimitMinutes: number | null) => void;
  // Rubric picker props
  rubricMapping?: Record<string, { name: string; description?: string }>;
  validRubricIds?: string[];
  readonly?: boolean;
}

export function SimulationContentTable({
  data,
  selectedContentIds,
  onContentSelect,
  onSelectAll,
  onActiveToggle,
  onMoveUp,
  onMoveDown,
  onRemove,
  onBulkEdit,
  onBulkDelete,
  onHintsToggle,
  onObjectivesToggle,
  onInputGuardrailToggle,
  onOutputGuardrailToggle,
  onImageInputToggle,
  onRubricChange,
  onTimeLimitChange,
  rubricMapping = {},
  validRubricIds = [],
  readonly = false,
}: SimulationContentTableProps) {
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "position", desc: false }, // Default sort by position ascending
  ]);

  const selectedCount = selectedContentIds.length;

  // Format usage count display
  const formatUsage = (count: number) => {
    if (count === 0) return "0";
    if (count < 1000) return count.toString();
    return `${(count / 1000).toFixed(1)}k`;
  };

  // Format success rate
  const formatSuccessRate = (rate: number) => {
    return `${rate}%`;
  };

  // Columns definition
  const columns: ColumnDef<ContentItem>[] = React.useMemo(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <div className="pr-2">
            <Checkbox
              checked={
                table.getIsAllPageRowsSelected() ||
                (table.getIsSomePageRowsSelected() && "indeterminate")
              }
              onCheckedChange={(value) => {
                table.toggleAllPageRowsSelected(!!value);
                const visibleRowIds = table
                  .getFilteredRowModel()
                  .rows.map((row) => `${row.original.type}:${row.original.id}`);
                onSelectAll(!!value, visibleRowIds);
              }}
              aria-label="Select all"
              className="translate-y-[2px]"
              disabled={readonly}
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="pr-2">
            <Checkbox
              checked={selectedContentIds.includes(
                `${row.original.type}:${row.original.id}`
              )}
              onCheckedChange={(value) =>
                onContentSelect(
                  `${row.original.type}:${row.original.id}`,
                  !!value
                )
              }
              aria-label="Select row"
              className="translate-y-[2px]"
              disabled={readonly}
            />
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="flex items-center gap-2">
              {item.type === "scenario" ? (
                <FileText className="h-4 w-4 text-blue-600" />
              ) : (
                <Video className="h-4 w-4 text-purple-600" />
              )}
              <Badge variant={item.type === "scenario" ? "default" : "secondary"}>
                {item.type === "scenario" ? "Scenario" : "Video"}
              </Badge>
              {item.isNew && (
                <Badge variant="outline" className="bg-green-50 text-green-700">
                  NEW
                </Badge>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "title",
        header: "Name",
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="flex flex-col">
              <span className="font-medium">{item.title}</span>
              {item.type === "video" && item.length_seconds && (
                <span className="text-xs text-muted-foreground">
                  {Math.floor(item.length_seconds / 60)}:
                  {(item.length_seconds % 60).toString().padStart(2, "0")}
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "description",
        header: "Description",
        cell: ({ row }) => {
          const description = row.original.description || "No description";
          return (
            <div className="max-w-[300px]">
              <p className="text-sm text-muted-foreground line-clamp-2">
                {description}
              </p>
            </div>
          );
        },
      },
      {
        accessorKey: "usage_count",
        header: "Usage",
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="flex flex-col items-center">
              <span className="text-sm font-medium">
                {formatUsage(item.usage_count)}
              </span>
              {item.success_rate > 0 && (
                <span className="text-xs text-muted-foreground">
                  {formatSuccessRate(item.success_rate)} success
                </span>
              )}
            </div>
          );
        },
        enableSorting: true,
      },
      {
        accessorKey: "active",
        header: "Active",
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="flex items-center justify-center">
              <Switch
                checked={item.active}
                onCheckedChange={(checked) =>
                  onActiveToggle(`${item.type}:${item.id}`, checked)
                }
                disabled={readonly}
              />
            </div>
          );
        },
      },
      {
        id: "hints_enabled",
        header: () => (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 cursor-help">
                <Lightbulb className="h-4 w-4 text-muted-foreground" />
                <span>Hints</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Provide hints to help students progress through the scenario</p>
            </TooltipContent>
          </Tooltip>
        ),
        cell: ({ row }) => {
          const item = row.original;
          if (item.type === "video") {
            return (
              <Badge variant="outline" className="text-muted-foreground">
                N/A
              </Badge>
            );
          }
          return (
            <div className="flex items-center justify-center">
              <Switch
                checked={item.hints_enabled ?? false}
                onCheckedChange={(checked) =>
                  onHintsToggle?.(`${item.type}:${item.id}`, checked)
                }
                disabled={readonly || !onHintsToggle}
              />
            </div>
          );
        },
      },
      {
        id: "objectives_enabled",
        header: () => (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 cursor-help">
                <Target className="h-4 w-4 text-muted-foreground" />
                <span>Objectives</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Display learning objectives to students during the scenario</p>
            </TooltipContent>
          </Tooltip>
        ),
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="flex items-center justify-center">
              <Switch
                checked={item.objectives_enabled ?? false}
                onCheckedChange={(checked) =>
                  onObjectivesToggle?.(`${item.type}:${item.id}`, checked)
                }
                disabled={readonly || !onObjectivesToggle}
              />
            </div>
          );
        },
      },
      {
        id: "input_guardrail_enabled",
        header: () => (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 cursor-help">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span>Input Guardrail</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Monitor and filter inappropriate input from students</p>
            </TooltipContent>
          </Tooltip>
        ),
        cell: ({ row }) => {
          const item = row.original;
          if (item.type === "video") {
            return (
              <Badge variant="outline" className="text-muted-foreground">
                N/A
              </Badge>
            );
          }
          return (
            <div className="flex items-center justify-center">
              <Switch
                checked={item.input_guardrail_enabled ?? false}
                onCheckedChange={(checked) =>
                  onInputGuardrailToggle?.(`${item.type}:${item.id}`, checked)
                }
                disabled={readonly || !onInputGuardrailToggle}
              />
            </div>
          );
        },
      },
      {
        id: "output_guardrail_enabled",
        header: () => (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 cursor-help">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                <span>Output Guardrail</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Monitor and filter inappropriate output from the persona</p>
            </TooltipContent>
          </Tooltip>
        ),
        cell: ({ row }) => {
          const item = row.original;
          if (item.type === "video") {
            return (
              <Badge variant="outline" className="text-muted-foreground">
                N/A
              </Badge>
            );
          }
          return (
            <div className="flex items-center justify-center">
              <Switch
                checked={item.output_guardrail_enabled ?? false}
                onCheckedChange={(checked) =>
                  onOutputGuardrailToggle?.(`${item.type}:${item.id}`, checked)
                }
                disabled={readonly || !onOutputGuardrailToggle}
              />
            </div>
          );
        },
      },
      {
        id: "image_input_enabled",
        header: () => (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 cursor-help">
                <Image className="h-4 w-4 text-muted-foreground" />
                <span>Image Input</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Enable AI vision to analyze visual content in documents</p>
            </TooltipContent>
          </Tooltip>
        ),
        cell: ({ row }) => {
          const item = row.original;
          if (item.type === "video") {
            return (
              <Badge variant="outline" className="text-muted-foreground">
                N/A
              </Badge>
            );
          }
          return (
            <div className="flex items-center justify-center">
              <Switch
                checked={item.image_input_enabled ?? false}
                onCheckedChange={(checked) =>
                  onImageInputToggle?.(`${item.type}:${item.id}`, checked)
                }
                disabled={readonly || !onImageInputToggle}
              />
            </div>
          );
        },
      },
      {
        id: "rubric_id",
        header: () => (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 cursor-help">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span>Rubric</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Rubric for grading this scenario</p>
            </TooltipContent>
          </Tooltip>
        ),
        cell: ({ row }) => {
          const item = row.original;
          if (item.type === "video") {
            return (
              <Badge variant="outline" className="text-muted-foreground">
                N/A
              </Badge>
            );
          }
          const contentId = `${item.type}:${item.id}`;
          return (
            <div className="flex items-center justify-center min-w-[200px]">
              {readonly ? (
                <span className="text-xs text-muted-foreground">
                  {item.rubric_id && rubricMapping[item.rubric_id]
                    ? rubricMapping[item.rubric_id].name
                    : "None"}
                </span>
              ) : (
                <RubricPicker
                  mapping={rubricMapping}
                  validIds={validRubricIds}
                  selectedIds={item.rubric_id ? [item.rubric_id] : []}
                  onSelect={(ids) =>
                    onRubricChange?.(contentId, ids[0] || null)
                  }
                  placeholder="Select rubric..."
                  hideSelectedChips={true}
                />
              )}
            </div>
          );
        },
      },
      {
        id: "time_limit",
        header: () => (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 cursor-help">
                <span>Time Limit</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Time limit in minutes for this scenario</p>
            </TooltipContent>
          </Tooltip>
        ),
        cell: ({ row }) => {
          const item = row.original;
          if (item.type === "video") {
            return (
              <Badge variant="outline" className="text-muted-foreground">
                N/A
              </Badge>
            );
          }
          const contentId = `${item.type}:${item.id}`;
          // Convert seconds to minutes for display
          const timeLimitMinutes = item.time_limit_seconds
            ? Math.round(item.time_limit_seconds / 60)
            : null;
          return (
            <div className="flex items-center justify-center">
              {readonly ? (
                <span className="text-xs text-muted-foreground">
                  {timeLimitMinutes ? `${timeLimitMinutes} min` : "No limit"}
                </span>
              ) : (
                <Input
                  type="number"
                  min="1"
                  max="120"
                  value={timeLimitMinutes || ""}
                  onChange={(e) => {
                    const value = e.target.value
                      ? parseInt(e.target.value)
                      : null;
                    onTimeLimitChange?.(contentId, value);
                  }}
                  placeholder="No limit"
                  className="w-24 h-8 text-sm"
                  disabled={readonly}
                />
              )}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const item = row.original;
          const contentId = `${item.type}:${item.id}`;
          const index = data.findIndex(
            (d) => `${d.type}:${d.id}` === contentId
          );
          const canMoveUp = index > 0;
          const canMoveDown = index < data.length - 1;

          return (
            <div className="flex items-center justify-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => onMoveUp(contentId)}
                    disabled={!canMoveUp || readonly}
                  >
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Move Up</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => onMoveDown(contentId)}
                    disabled={!canMoveDown || readonly}
                  >
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Move Down</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => onRemove(contentId)}
                    disabled={readonly}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Remove</p>
                </TooltipContent>
              </Tooltip>
            </div>
          );
        },
        enableSorting: false,
      },
    ],
    [data, selectedContentIds, readonly, onContentSelect, onSelectAll, onActiveToggle, onMoveUp, onMoveDown, onRemove, onHintsToggle, onObjectivesToggle, onInputGuardrailToggle, onOutputGuardrailToggle, onImageInputToggle, onRubricChange, onTimeLimitChange, rubricMapping, validRubricIds]
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
  }, [table, data.length, sorting, columnFilters]);

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {selectedCount > 0 && !readonly && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onBulkEdit}
                  disabled={selectedCount === 0}
                >
                  Bulk Edit ({selectedCount})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onBulkDelete}
                  disabled={selectedCount === 0}
                >
                  Bulk Delete ({selectedCount})
                </Button>
              </>
            )}
          </div>
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
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
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
                    data-state={row.getIsSelected() && "selected"}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    {row
                      .getVisibleCells()
                      .map((cell) => (
                        <TableCell
                          key={cell.id}
                          className="border-r px-3 py-2 text-center"
                        >
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
                    className="h-24 text-center px-6"
                  >
                    No content items found.
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

