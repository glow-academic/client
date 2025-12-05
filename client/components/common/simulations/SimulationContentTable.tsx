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
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  BookOpen,
  FileText,
  Pencil,
  Power,
  Trash2,
  Video,
  Eye,
} from "lucide-react";

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
  // Switch fields (scenarios only, except show fields which apply to both)
  hints_enabled?: boolean;
  objectives_enabled?: boolean;
  copy_paste_allowed?: boolean;
  audio_enabled?: boolean; // Scenarios only
  text_enabled?: boolean; // Scenarios only
  show_problem_statement?: boolean; // Scenarios and videos
  show_objectives?: boolean; // Scenarios and videos
  show_image?: boolean; // Scenarios and videos
  rubric_id?: string | null;
  time_limit_seconds?: number | null; // Per-scenario time limit in seconds
  // Agent IDs (scenarios only)
  hint_agent_id?: string | null;
  grade_agent_ids?: string[]; // Multi-select for grade agents
}

export interface SimulationContentTableProps {
  data: ContentItem[];
  onActiveToggle: (contentId: string, active: boolean) => void;
  onMoveUp: (contentId: string) => void;
  onMoveDown: (contentId: string) => void;
  onRemove: (contentId: string) => void;
  onEditScenario?: (scenarioId: string) => void;
  onShowProblemStatementToggle?: (contentId: string, enabled: boolean) => void;
  onShowObjectivesToggle?: (contentId: string, enabled: boolean) => void;
  onShowImageToggle?: (contentId: string, enabled: boolean) => void;
  readonly?: boolean;
}

export function SimulationContentTable({
  data,
  onActiveToggle,
  onMoveUp,
  onMoveDown,
  onRemove,
  onEditScenario,
  onShowProblemStatementToggle,
  onShowObjectivesToggle,
  onShowImageToggle,
  readonly = false,
}: SimulationContentTableProps) {
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "position", desc: false }, // Default sort by position ascending
  ]);

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

  // Columns definition - only shared attributes
  const columns: ColumnDef<ContentItem>[] = React.useMemo(
    () => [
      {
        accessorKey: "position",
        header: () => (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex flex-col items-center gap-1 cursor-help">
                <span className="text-xs">#</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Position in simulation</p>
            </TooltipContent>
          </Tooltip>
        ),
        cell: ({ row }) => {
          return (
            <div className="flex items-center justify-center">
              <span className="text-sm font-medium">{row.original.position}</span>
            </div>
          );
        },
        enableSorting: true,
      },
      {
        accessorKey: "title",
        size: 150,
        header: () => (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex flex-col items-center gap-1 cursor-help">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs">Name</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Content item name</p>
            </TooltipContent>
          </Tooltip>
        ),
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="flex flex-col w-[150px]">
              <span
                className="font-medium text-sm leading-tight whitespace-normal inline-flex items-center gap-1.5"
                style={{ wordBreak: "break-word", overflowWrap: "break-word" }}
              >
                {item.type === "scenario" ? (
                  <FileText className="h-4 w-4 text-blue-600 flex-shrink-0" />
                ) : (
                  <Video className="h-4 w-4 text-purple-600 flex-shrink-0" />
                )}
                {item.title}
                {item.isNew && (
                  <Badge
                    variant="outline"
                    className="bg-green-50 text-green-700 text-xs px-1 py-0 flex-shrink-0"
                  >
                    NEW
                  </Badge>
                )}
              </span>
              {item.type === "video" && item.length_seconds && (
                <span className="text-xs text-muted-foreground pl-5">
                  {Math.floor(item.length_seconds / 60)}:
                  {(item.length_seconds % 60).toString().padStart(2, "0")}
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "usage_count",
        header: () => (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex flex-col items-center gap-1 cursor-help">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs">Usage</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Number of times this content has been used</p>
            </TooltipContent>
          </Tooltip>
        ),
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
        header: () => (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex flex-col items-center gap-1 cursor-help">
                <Power className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs">Active</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Enable or disable this content item</p>
            </TooltipContent>
          </Tooltip>
        ),
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
        id: "show_fields",
        header: () => (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex flex-col items-center gap-1 cursor-help">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs">Show</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Control what information is displayed to students</p>
            </TooltipContent>
          </Tooltip>
        ),
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="flex flex-col items-center justify-center gap-2 py-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Problem</span>
                <Switch
                  checked={item.show_problem_statement ?? true}
                  onCheckedChange={(checked) =>
                    onShowProblemStatementToggle?.(`${item.type}:${item.id}`, checked)
                  }
                  disabled={readonly || !onShowProblemStatementToggle}
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Objectives</span>
                <Switch
                  checked={item.show_objectives ?? true}
                  onCheckedChange={(checked) =>
                    onShowObjectivesToggle?.(`${item.type}:${item.id}`, checked)
                  }
                  disabled={readonly || !onShowObjectivesToggle}
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Image</span>
                <Switch
                  checked={item.show_image ?? true}
                  onCheckedChange={(checked) =>
                    onShowImageToggle?.(`${item.type}:${item.id}`, checked)
                  }
                  disabled={readonly || !onShowImageToggle}
                />
              </div>
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
              {item.type === "scenario" && onEditScenario && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => onEditScenario(item.id)}
                      disabled={readonly}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Edit Scenario</p>
                  </TooltipContent>
                </Tooltip>
              )}
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
    [
      data,
      readonly,
      onActiveToggle,
      onMoveUp,
      onMoveDown,
      onRemove,
      onEditScenario,
      onShowProblemStatementToggle,
      onShowObjectivesToggle,
      onShowImageToggle,
    ]
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
                    className="hover:bg-muted/30 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className="border-r px-3 py-2 text-center min-h-[60px]"
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
