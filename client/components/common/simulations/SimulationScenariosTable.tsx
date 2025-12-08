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

import { AgentPicker } from "@/components/common/forms/AgentPicker";
import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { ScenarioPicker } from "@/components/common/forms/ScenarioPicker";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Clock,
  Copy,
  FileText,
  Layers,
  Lightbulb,
  Mic,
  Target,
  Text,
} from "lucide-react";
import type { ContentItem } from "./SimulationContentTable";

export interface SimulationScenariosTableProps {
  data: ContentItem[]; // Only scenario items
  // Switch toggle handlers
  onHintsToggle?: (contentId: string, enabled: boolean) => void;
  onCopyPasteToggle?: (contentId: string, enabled: boolean) => void;
  onAudioToggle?: (contentId: string, enabled: boolean) => void;
  onTextToggle?: (contentId: string, enabled: boolean) => void;
  onRubricChange?: (contentId: string, rubricId: string | null) => void;
  onTimeLimitChange?: (
    contentId: string,
    timeLimitMinutes: number | null
  ) => void;
  // Agent change handlers
  onHintAgentChange?: (contentId: string, agentId: string | null) => void;
  onGradeAgentsChange?: (contentId: string, agentIds: string[]) => void;
  // Rubric picker props
  rubricMapping?: Record<string, { name: string; description?: string }>;
  validRubricIds?: string[];
  // Agent picker props
  agentMapping?: Record<string, { name: string; roles?: string[] }>;
  validAgentIds?: string[];
  // Scenario picker props
  scenarioMapping?: Record<string, any>;
  validScenarioIds?: string[];
  selectedScenarioIds?: string[];
  onScenarioSelect?: (ids: string[]) => void;
  readonly?: boolean;
}

export function SimulationScenariosTable({
  data,
  onHintsToggle,
  onCopyPasteToggle,
  onAudioToggle,
  onTextToggle,
  onRubricChange,
  onTimeLimitChange,
  onHintAgentChange,
  onGradeAgentsChange,
  rubricMapping = {},
  validRubricIds = [],
  agentMapping = {},
  validAgentIds = [],
  scenarioMapping = {},
  validScenarioIds = [],
  selectedScenarioIds = [],
  onScenarioSelect,
  readonly = false,
}: SimulationScenariosTableProps) {
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "position", desc: false },
  ]);

  // Filter to only scenarios
  const scenarioItems = React.useMemo(
    () => data.filter((item) => item.type === "scenario"),
    [data]
  );

  // Compute available agents per role (for conditional column visibility)
  const hintAgentIds = React.useMemo(() => {
    return validAgentIds.filter((id) => {
      const agent = agentMapping[id];
      if (!agent) return false;
      const roles = agent.roles || agent["roles"] || [];
      return Array.isArray(roles) && roles.includes("hint");
    });
  }, [validAgentIds, agentMapping]);

  const gradeAgentIds = React.useMemo(() => {
    return validAgentIds.filter((id) => {
      const agent = agentMapping[id];
      if (!agent) return false;
      const roles = agent.roles || agent["roles"] || [];
      return Array.isArray(roles) && roles.includes("grade");
    });
  }, [validAgentIds, agentMapping]);

  // Track if auto-selection has been done for each scenario
  const autoSelectedRef = React.useRef<Set<string>>(new Set());

  // Auto-select first agent if only one option and not already set
  React.useEffect(() => {
    if (
      readonly ||
      !onHintAgentChange ||
      !onGradeAgentsChange ||
      scenarioItems.length === 0
    ) {
      return;
    }

    scenarioItems.forEach((item) => {
      const contentId = `${item.type}:${item.id}`;
      const autoSelectKey = `${contentId}-auto-selected`;

      // Skip if already auto-selected for this item
      if (autoSelectedRef.current.has(autoSelectKey)) {
        return;
      }

      // Auto-select hint agent
      if (!item.hint_agent_id && hintAgentIds.length === 1) {
        onHintAgentChange(contentId, hintAgentIds[0]!);
      }

      // Auto-select grade agents (if only one)
      if (
        (!item.grade_agent_ids || item.grade_agent_ids.length === 0) &&
        gradeAgentIds.length === 1
      ) {
        onGradeAgentsChange(contentId, [gradeAgentIds[0]!]);
      }

      // Mark as auto-selected
      autoSelectedRef.current.add(autoSelectKey);
    });
  }, [
    scenarioItems,
    hintAgentIds,
    gradeAgentIds,
    readonly,
    onHintAgentChange,
    onGradeAgentsChange,
  ]);

  // Columns definition
  const columns: ColumnDef<ContentItem>[] = React.useMemo(
    () => [
      {
        accessorKey: "title",
        size: 150,
        header: () => (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex flex-col items-center gap-1 cursor-help">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs">Name</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Scenario name</p>
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
                <FileText className="h-4 w-4 text-blue-600 flex-shrink-0" />
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
            </div>
          );
        },
      },
      {
        id: "hints_enabled",
        header: () => (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex flex-col items-center gap-1 cursor-help">
                <Lightbulb className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs">Hints</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                Provide hints to help students progress through the scenario
              </p>
            </TooltipContent>
          </Tooltip>
        ),
        cell: ({ row }) => {
          const item = row.original;
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
      // Only show hint agent column if more than one option
      ...(hintAgentIds.length > 1
        ? [
            {
              id: "hint_agent",
              header: () => (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex flex-col items-center gap-1 cursor-help">
                      <Lightbulb className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs">Hint Agent</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Agent to use for generating hints</p>
                  </TooltipContent>
                </Tooltip>
              ),
              cell: ({ row }) => {
                const item = row.original;
                return (
                  <div className="flex items-center justify-center min-w-[150px]">
                    <AgentPicker
                      mapping={agentMapping}
                      validIds={hintAgentIds}
                      selectedIds={
                        item.hint_agent_id ? [item.hint_agent_id] : []
                      }
                      onSelect={(ids) =>
                        onHintAgentChange?.(
                          `${item.type}:${item.id}`,
                          ids[0] || null
                        )
                      }
                      placeholder="Select agent"
                      disabled={readonly || !onHintAgentChange}
                      multiSelect={false}
                      buttonClassName="h-8 text-xs"
                    />
                  </div>
                );
              },
            },
          ]
        : []),
      // Only show grade agents column if more than one option
      ...(gradeAgentIds.length > 1
        ? [
            {
              id: "grade_agents",
              header: () => (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex flex-col items-center gap-1 cursor-help">
                      <Target className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs">Grade Agents</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Agents to use for grading (multiple allowed)</p>
                  </TooltipContent>
                </Tooltip>
              ),
              cell: ({ row }) => {
                const item = row.original;
                return (
                  <div className="flex items-center justify-center min-w-[150px]">
                    <AgentPicker
                      mapping={agentMapping}
                      validIds={gradeAgentIds}
                      selectedIds={item.grade_agent_ids || []}
                      onSelect={(ids) =>
                        onGradeAgentsChange?.(`${item.type}:${item.id}`, ids)
                      }
                      placeholder="Select agents"
                      disabled={readonly || !onGradeAgentsChange}
                      multiSelect={true}
                      buttonClassName="h-8 text-xs"
                    />
                  </div>
                );
              },
            },
          ]
        : []),
      {
        id: "copy_paste_allowed",
        header: () => (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex flex-col items-center gap-1 cursor-help">
                <Copy className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs leading-tight text-center">
                  Copy
                  <br />
                  Paste
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Allow students to copy and paste text during the scenario</p>
            </TooltipContent>
          </Tooltip>
        ),
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="flex items-center justify-center">
              <Switch
                checked={item.copy_paste_allowed ?? false}
                onCheckedChange={(checked) =>
                  onCopyPasteToggle?.(`${item.type}:${item.id}`, checked)
                }
                disabled={readonly || !onCopyPasteToggle}
              />
            </div>
          );
        },
      },
      {
        id: "modality",
        header: () => (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex flex-col items-center gap-1 cursor-help">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs">Modality</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Enable input modalities for the scenario</p>
            </TooltipContent>
          </Tooltip>
        ),
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="flex flex-col items-center justify-center gap-2 py-1">
              <div className="flex items-center gap-1.5">
                <Text className="h-3 w-3 text-muted-foreground" />
                <Switch
                  checked={item.text_enabled ?? true}
                  onCheckedChange={(checked) =>
                    onTextToggle?.(`${item.type}:${item.id}`, checked)
                  }
                  disabled={readonly || !onTextToggle}
                />
              </div>
              <div className="flex items-center gap-1.5">
                <Mic className="h-3 w-3 text-muted-foreground" />
                <Switch
                  checked={item.audio_enabled ?? false}
                  onCheckedChange={(checked) =>
                    onAudioToggle?.(`${item.type}:${item.id}`, checked)
                  }
                  disabled={readonly || !onAudioToggle}
                />
              </div>
            </div>
          );
        },
      },
      {
        id: "rubric_id",
        header: () => (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex flex-col items-center gap-1 cursor-help">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs">Rubric</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Rubric for grading this scenario</p>
            </TooltipContent>
          </Tooltip>
        ),
        cell: ({ row }) => {
          const item = row.original;
          const contentId = `${item.type}:${item.id}`;
          return (
            <div className="flex items-center justify-center min-w-[120px]">
              {readonly ? (
                <span className="text-xs text-muted-foreground">
                  {item.rubric_id && rubricMapping[item.rubric_id]
                    ? rubricMapping[item.rubric_id].name
                    : "None"}
                </span>
              ) : (
                <GenericPicker
                  items={rubricMapping}
                  itemIds={validRubricIds}
                  selectedIds={item.rubric_id ? [item.rubric_id] : []}
                  onSelect={(ids) =>
                    onRubricChange?.(contentId, ids[0] || null)
                  }
                  getId={(rubric) => (rubric as unknown as { id: string }).id}
                  getLabel={(rubric) => rubric.name || ""}
                  getSearchText={(rubric) =>
                    `${rubric.name} ${rubric.description || ""}`
                  }
                  placeholder="Select rubric..."
                  hideSelectedChips={true}
                  buttonClassName="w-full"
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
              <div className="flex flex-col items-center gap-1 cursor-help">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs leading-tight text-center">
                  Time
                  <br />
                  Limit
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Time limit in minutes for this scenario</p>
            </TooltipContent>
          </Tooltip>
        ),
        cell: ({ row }) => {
          const item = row.original;
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
                  placeholder="None"
                  className="w-20 h-8 text-sm"
                  disabled={readonly}
                />
              )}
            </div>
          );
        },
      },
    ],
    [
      readonly,
      onHintsToggle,
      onCopyPasteToggle,
      onAudioToggle,
      onTextToggle,
      onRubricChange,
      onTimeLimitChange,
      onHintAgentChange,
      onGradeAgentsChange,
      rubricMapping,
      validRubricIds,
      agentMapping,
      hintAgentIds,
      gradeAgentIds,
    ]
  );

  const table = useReactTable({
    data: scenarioItems,
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
  }, [table, scenarioItems.length, sorting, columnFilters]);

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header with picker */}
        <div className="flex justify-between items-center">
          <div>
            <Label>Scenarios</Label>
            <p className="text-sm text-muted-foreground">
              Configure scenario-specific settings
            </p>
          </div>
          {!readonly && onScenarioSelect && (
            <div className="w-[200px]">
              <ScenarioPicker
                scenarioMapping={scenarioMapping}
                validScenarioIds={validScenarioIds}
                selectedScenarioIds={selectedScenarioIds}
                onSelect={onScenarioSelect}
                placeholder="Add scenarios..."
                hideSelectedChips={true}
                showLabel={false}
                buttonClassName="h-9"
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
                    No scenarios found.
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
