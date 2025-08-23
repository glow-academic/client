"use client";
import { DataTableColumnHeader } from "@/components/common/history/DataTableColumnHeader";
import { DataTableRowActions } from "@/components/common/history/DataTableRowActions";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Column, ColumnDef, Row } from "@tanstack/react-table";
import { Infinity as InfinityIcon } from "lucide-react";
import { useMemo } from "react";

// Enhanced types for the data table
interface EnhancedAttempt {
  id: string;
  profileId: string | null;
  simulationId: string;
  createdAt: string;
  archived: boolean;
  infiniteMode?: boolean;
  infiniteModeTimeLimit?: number | null;
  scenarios: Array<{
    id: string;
    attemptId: string;
    scenarioId: string;
    createdAt: string;
    completedAt: string | null;
    completed: boolean;
  }>;
  personasTested: string[];
  interactionIds: string[];
  completedWithRubricCount?: number;
  totalExpected?: number;
  scorePercent?: number;
  isPractice?: boolean;
  rootScenarioIds?: string[];
  isIncomplete?: boolean;
}

// Component to use the columns with filtered data
export function useHistoryColumns({
  showExport: _showExport = true,
  showArchive = false,
  allSameProfile = false,
  precomputedAttempts,
  precomputedProfileOptions,
  precomputedSimulationOptions,
  precomputedScenarioOptions,
}: {
  showExport: boolean;
  showArchive: boolean;
  allSameProfile?: boolean;
  precomputedAttempts?: EnhancedAttempt[];
  precomputedProfileOptions?: {
    value: string;
    label: string;
    icon?: unknown;
  }[];
  precomputedSimulationOptions?: { value: string; label: string }[];
  precomputedScenarioOptions?: { value: string; label: string }[];
}) {
  // Server-precomputed data is provided via props; avoid client recomputation.

  // Create user options for profile names - only if not all attempts have the same profile
  const profileOptions = useMemo(() => {
    if (precomputedProfileOptions) return precomputedProfileOptions;
    return [];
  }, [precomputedProfileOptions]);

  // No rubric filtering on client; server provides scorePercent

  // Create enhanced attempts data from filtered data
  const enhancedAttempts = useMemo(() => {
    if (precomputedAttempts) return precomputedAttempts;
    return [];
  }, [precomputedAttempts]);

  // Create scenario options for filtering
  const scenarioOptions = useMemo(() => {
    if (precomputedScenarioOptions) return precomputedScenarioOptions;
    return [];
  }, [precomputedScenarioOptions]);

  // Create simulation options for filtering
  const simulationOptions = useMemo(() => {
    if (precomputedSimulationOptions) return precomputedSimulationOptions;
    return [];
  }, [precomputedSimulationOptions]);

  // Define columns - only attempts view
  const columns = useMemo(() => {
    const attemptColumns: ColumnDef<EnhancedAttempt>[] = [
      // Search column (hidden, used for global search)
      {
        id: "search",
        enableHiding: true,
        enableSorting: false,
        filterFn: (row, _id, value) => {
          if (!value) return true;
          const searchValue = value.toLowerCase();
          const attempt = row.original;

          // Search in profile name
          const profileOption = profileOptions.find(
            (profile) => profile.value === attempt.profileId
          );
          if (profileOption?.label.toLowerCase().includes(searchValue)) {
            return true;
          }

          // Search in simulation title (from options)
          const simOption = simulationOptions.find(
            (s) => s.value === attempt.simulationId
          );
          if (simOption?.label.toLowerCase().includes(searchValue)) {
            return true;
          }

          return false;
        },
      },
      // Date column
      {
        accessorKey: "createdAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Date" />
        ),
        cell: ({ row }) => {
          const date = row.getValue("createdAt");
          if (!date) return null;

          const dateObj = new Date(date as string);
          const day = dateObj.getDate().toString().padStart(2, "0");
          const month = (dateObj.getMonth() + 1).toString().padStart(2, "0");
          const year = dateObj.getFullYear().toString().slice(-2);
          const time = dateObj.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });

          const isArchived = (row.original as EnhancedAttempt).archived;

          return (
            <div className="flex items-center justify-between">
              <div className="font-medium text-sm">
                <div>
                  {month}-{day}-{year}
                </div>
                <div className="text-xs text-muted-foreground">{time}</div>
              </div>
              {isArchived && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="w-2 h-2 rounded-full bg-red-500 ml-2" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Archived</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          );
        },
        enableSorting: true,
        sortDescFirst: true, // Default to descending order
      },
      // User Name column - only show if not all attempts have the same profile
      ...(!allSameProfile
        ? [
            {
              accessorKey: "profileId",
              header: ({
                column,
              }: {
                column: Column<EnhancedAttempt, unknown>;
              }) => <DataTableColumnHeader column={column} title="Name" />,
              cell: ({ row }: { row: Row<EnhancedAttempt> }) => {
                const profileOption = profileOptions.find(
                  (profile) => profile.value === row.getValue("profileId")
                );

                if (!profileOption) {
                  return (
                    <span className="text-muted-foreground">Unknown User</span>
                  );
                }

                return (
                  <div className="flex items-center">
                    <span>{profileOption.label}</span>
                  </div>
                );
              },
              filterFn: (
                row: Row<EnhancedAttempt>,
                id: string,
                value: string[]
              ) => {
                return value.includes(row.getValue(id) as string);
              },
              enableSorting: true,
            },
          ]
        : []),
      // Simulation ID column (hidden, used for filtering)
      {
        accessorKey: "simulationId",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Simulation" />
        ),
        cell: ({ row }) => {
          const simulation = simulationOptions.find(
            (s) => s.value === row.getValue("simulationId")
          );
          const isInfinite = (row.original as EnhancedAttempt).infiniteMode;
          return (
            <div className="flex items-center space-x-1">
              <span className="max-w-[500px] truncate font-medium">
                {simulation?.label || "Unknown Simulation"}
              </span>
              {isInfinite && (
                <InfinityIcon className="h-3 w-3 text-muted-foreground" />
              )}
            </div>
          );
        },
        enableHiding: true,
        filterFn: (row, id, value) => {
          if (!value || !Array.isArray(value) || value.length === 0)
            return true;

          const simulationId = row.getValue(id) as string;
          return value.includes(simulationId);
        },
      },
      // Scenarios completion column
      {
        accessorKey: "scenarios",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Scenarios" />
        ),
        cell: ({ row }) => {
          const chats = row.original.scenarios;
          const interactionIds = row.original.interactionIds;
          const preCompleted = (row.original as EnhancedAttempt)
            .completedWithRubricCount;
          const preTotal = (row.original as EnhancedAttempt).totalExpected;
          const isInfinite = (row.original as EnhancedAttempt).infiniteMode;

          // Ensure chats is an array
          const chatsArray = Array.isArray(chats) ? chats : [];
          // Prefer precomputed
          const completedWithRubricCount =
            typeof preCompleted === "number" ? preCompleted : 0;
          const totalChats =
            typeof preTotal === "number"
              ? preTotal
              : interactionIds?.length || chatsArray.length || 0;

          return (
            <div className="text-center">
              <span className="font-medium inline-flex items-center gap-1">
                {completedWithRubricCount}
                <span>/</span>
                {isInfinite ? (
                  <InfinityIcon className="h-3 w-3 text-muted-foreground" />
                ) : (
                  <span>{totalChats}</span>
                )}
              </span>
              <div className="text-xs text-muted-foreground">completed</div>
            </div>
          );
        },
        enableSorting: true,
        accessorFn: (row: EnhancedAttempt) => {
          const preCompleted = (row as EnhancedAttempt)
            .completedWithRubricCount;
          const preTotal = (row as EnhancedAttempt).totalExpected;
          const completedWithRubricCount =
            typeof preCompleted === "number" ? preCompleted : 0;
          const totalChats = typeof preTotal === "number" ? preTotal : 0;
          return totalChats > 0 ? completedWithRubricCount / totalChats : 0;
        },
        filterFn: (row, _id, value) => {
          if (!value || value.length === 0) return true;

          // Prefer precomputed root scenario ids if available
          const preRootIds = (row.original as EnhancedAttempt).rootScenarioIds;
          if (Array.isArray(preRootIds) && preRootIds.length > 0) {
            return value.some((scenarioId: string) =>
              preRootIds.includes(scenarioId)
            );
          }

          // No precomputed mapping available, do not exclude
          return true;
        },
      },
      // Agents tested column
      {
        accessorKey: "personasTested",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Personas" />
        ),
        cell: ({ row }) => {
          const personasTested = row.getValue("personasTested") as string[];

          if (!personasTested || personasTested.length === 0) {
            return <span className="text-muted-foreground">None</span>;
          }

          return (
            <div className="flex flex-wrap gap-1">
              {personasTested.map((agentName, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {agentName}
                </Badge>
              ))}
            </div>
          );
        },
        filterFn: (row, id, value) => {
          const personasTested = row.getValue(id) as string[];
          if (!value || !Array.isArray(value) || value.length === 0)
            return true;
          return value.some((filterAgent: string) =>
            personasTested?.includes(filterAgent)
          );
        },
      },
      // Average score column
      {
        accessorKey: "averageScore",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Score" />
        ),
        accessorFn: (row: EnhancedAttempt) => {
          const prePercent = (row as EnhancedAttempt).scorePercent;
          return typeof prePercent === "number" ? prePercent : 0;
        },
        cell: ({ row }) => {
          const isIncomplete = (row.original as EnhancedAttempt).isIncomplete;
          if (isIncomplete) {
            return <div className="text-red-500 font-medium">Incomplete</div>;
          }
          const prePercent = (row.original as EnhancedAttempt).scorePercent;
          if (typeof prePercent !== "number") {
            return <div className="text-muted-foreground">Not graded</div>;
          }
          const scorePercent = prePercent;

          return (
            <div className="text-center">
              <Badge
                variant="outline"
                className={`text-xs font-semibold ${
                  scorePercent >= 80
                    ? "bg-green-100 text-green-800 border-green-300 hover:bg-green-200"
                    : scorePercent >= 70
                      ? "bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200"
                      : "bg-red-100 text-red-800 border-red-300 hover:bg-red-200"
                }`}
              >
                {scorePercent}%
              </Badge>
            </div>
          );
        },
        enableSorting: true,
        filterFn: (row, _, value) => {
          // Prefer precomputed flags and percent
          const preIsIncomplete = (row.original as EnhancedAttempt)
            .isIncomplete;
          if (preIsIncomplete) {
            return value.includes("incomplete");
          }
          const prePercent = (row.original as EnhancedAttempt).scorePercent;
          if (typeof prePercent === "number") {
            if (prePercent >= 80) {
              return value.includes("excellent");
            } else if (prePercent >= 70) {
              return value.includes("good");
            } else {
              return value.includes("needs-improvement");
            }
          }

          return value.includes("not-graded");
        },
      },
      // Actions column
      {
        id: "actions",
        cell: ({ row }) => {
          const attempt = row.original;
          const isIncomplete =
            (attempt as EnhancedAttempt).isIncomplete || false;
          const isPractice = (attempt as EnhancedAttempt).isPractice || false;

          return (
            <DataTableRowActions
              id={attempt.id}
              profileId={attempt.profileId || ""}
              simulationId={(attempt as EnhancedAttempt).simulationId}
              scenarios={attempt.scenarios}
              interactionIds={attempt.interactionIds}
              isIncomplete={isIncomplete}
              isPractice={isPractice}
              infiniteMode={
                (attempt as EnhancedAttempt & { infiniteMode?: boolean })
                  .infiniteMode || false
              }
              infiniteModeTimeLimit={
                (
                  attempt as EnhancedAttempt & {
                    infiniteModeTimeLimit?: number | null;
                  }
                ).infiniteModeTimeLimit ?? null
              }
              attemptCreatedAt={
                (attempt as EnhancedAttempt & { createdAt?: string }).createdAt
              }
              archived={attempt.archived}
              showArchive={showArchive}
            />
          );
        },
      },
    ];

    return attemptColumns;
  }, [profileOptions, showArchive, allSameProfile, simulationOptions]);

  // Use enhanced attempts data
  const data: unknown[] = enhancedAttempts || [];

  return {
    columns,
    data,
    profileOptions,
    simulationOptions,
    scenarioOptions,
    isLoading: false,
  };
}
