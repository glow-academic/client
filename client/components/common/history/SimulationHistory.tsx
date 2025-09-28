/**
 * SimulationHistory.tsx
 * Used to display the simulation history page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useProfile } from "@/contexts/profile-context";
import { Column, ColumnDef, Row } from "@tanstack/react-table";
import { Infinity as InfinityIcon } from "lucide-react";
import * as React from "react";
import { DataTable } from "./DataTable";
import { DataTableColumnHeader } from "./DataTableColumnHeader";
import { DataTableRowActions } from "./DataTableRowActions";

// New data structure for history items
export interface HistoryDataItem {
  attemptId: string;
  date: Date;
  profileId: string;
  profileName: string;
  simulationName: string;
  numScenarios: number | null; // nullable for infinite mode
  numScenariosCompleted: number;
  infiniteMode: boolean;
  personaNames: string[];
  personaColors: string[];
  score: number | null; // nullable
  simulation_id: string;
  scenario_ids: string[];
  isArchived: boolean;
  showView: boolean;
  showContinue: boolean;
  practiceSimulation?: boolean; // Needed for routing to /practice/ vs /home/
  passPct: number; // Pass percentage threshold for this simulation
}

export interface SimulationHistoryProps {
  // Required: Array of history data items
  data: HistoryDataItem[];

  // Required: Whether to show export functionality
  showExport: boolean;

  // Required: Whether to show archive functionality
  showArchive: boolean;

  // Optional: Whether to hide Name column when all attempts have the same profile
  singleProfile?: boolean;

  // Optional: Whether to show loading state
  isLoading?: boolean;
}

export default function SimulationHistory({
  data,
  showExport,
  showArchive,
  singleProfile = false,
  isLoading = false,
}: SimulationHistoryProps) {
  const { effectiveProfile } = useProfile();
  // Check if all attempts have the same profileId (only when singleProfile is true)
  const allSameProfile = React.useMemo(() => {
    if (!singleProfile || data.length === 0) {
      return false;
    }

    const firstProfileId = data[0]?.profileId;
    if (!firstProfileId) {
      return false;
    }

    return data.every((item) => item.profileId === firstProfileId);
  }, [data, singleProfile]);

  // Create profile options from data
  const profileOptions = React.useMemo(() => {
    if (allSameProfile || !data || data.length === 0) return [];

    const uniqueProfiles = data.reduce(
      (acc, item) => {
        if (
          item?.profileId &&
          item?.profileName &&
          !acc.find((p) => p.value === item.profileId)
        ) {
          acc.push({
            value: item.profileId,
            label: item.profileName,
          });
        }
        return acc;
      },
      [] as { value: string; label: string }[]
    );

    return uniqueProfiles;
  }, [data, allSameProfile]);

  // Create simulation options from data
  const simulationOptions = React.useMemo(() => {
    if (!data || data.length === 0) return [];

    const uniqueSimulations = data.reduce(
      (acc, item) => {
        if (
          item?.simulation_id &&
          item?.simulationName &&
          !acc.find((s) => s.value === item.simulation_id)
        ) {
          acc.push({
            value: item.simulation_id,
            label: item.simulationName,
          });
        }
        return acc;
      },
      [] as { value: string; label: string }[]
    );

    return uniqueSimulations;
  }, [data]);

  // Create scenario options from data
  const scenarioOptions = React.useMemo(() => {
    if (!data || data.length === 0) return [];

    const uniqueScenarios = data.reduce(
      (acc, item) => {
        if (item?.scenario_ids && Array.isArray(item.scenario_ids)) {
          item.scenario_ids.forEach((scenarioId) => {
            if (scenarioId && !acc.find((s) => s.value === scenarioId)) {
              acc.push({
                value: scenarioId,
                label: `Scenario ${scenarioId}`, // You might want to fetch scenario names
              });
            }
          });
        }
        return acc;
      },
      [] as { value: string; label: string }[]
    );

    return uniqueScenarios;
  }, [data]);

  // Create column definitions that work with the new data structure
  const columns = React.useMemo(() => {
    const attemptColumns: ColumnDef<HistoryDataItem>[] = [
      // Search column (hidden, used for global search)
      {
        id: "search",
        enableHiding: true,
        enableSorting: false,
        filterFn: (row, _id, value) => {
          if (!value) return true;
          const searchValue = value.toLowerCase();
          const item = row.original;

          // Search in profile name
          if (item.profileName.toLowerCase().includes(searchValue)) {
            return true;
          }

          // Search in simulation name
          if (item.simulationName.toLowerCase().includes(searchValue)) {
            return true;
          }

          // Search in persona names
          if (
            item.personaNames.some((name) =>
              name.toLowerCase().includes(searchValue)
            )
          ) {
            return true;
          }

          return false;
        },
      },
      // Date column
      {
        accessorKey: "date",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Date" />
        ),
        cell: ({ row }) => {
          const date = row.getValue("date") as Date;
          if (!date || !(date instanceof Date)) return null;

          const day = date.getDate().toString().padStart(2, "0");
          const month = (date.getMonth() + 1).toString().padStart(2, "0");
          const year = date.getFullYear().toString().slice(-2);
          const time = date.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });

          const isArchived = row.original.isArchived;

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
              accessorKey: "profileName",
              header: ({
                column,
              }: {
                column: Column<HistoryDataItem, unknown>;
              }) => <DataTableColumnHeader column={column} title="Name" />,
              cell: ({ row }: { row: Row<HistoryDataItem> }) => {
                const profileName = row.getValue("profileName") as string;
                return (
                  <div className="flex items-center">
                    <span>{profileName}</span>
                  </div>
                );
              },
              filterFn: (
                row: Row<HistoryDataItem>,
                id: string,
                value: string[]
              ) => {
                return value.includes(row.getValue(id) as string);
              },
              enableSorting: true,
            },
          ]
        : []),
      // Simulation column
      {
        accessorKey: "simulationName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Simulation" />
        ),
        cell: ({ row }) => {
          const simulationName = row.getValue("simulationName") as string;
          const isInfinite = row.original.infiniteMode;

          return (
            <div className="flex items-center space-x-1">
              <span className="max-w-[500px] truncate font-medium">
                {simulationName}
              </span>
              {isInfinite && (
                <InfinityIcon className="h-3 w-3 text-muted-foreground" />
              )}
            </div>
          );
        },
        enableHiding: true,
        filterFn: (row, _id, value) => {
          if (!value || !Array.isArray(value) || value.length === 0)
            return true;

          const simulationId = row.getValue("simulation_id") as string;
          return value.includes(simulationId);
        },
      },
      // Scenarios completion column
      {
        accessorKey: "numScenariosCompleted",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Scenarios" />
        ),
        cell: ({ row }) => {
          const completedCount = row.getValue(
            "numScenariosCompleted"
          ) as number;
          const totalCount = row.original.numScenarios;
          const isInfinite = row.original.infiniteMode;

          return (
            <div className="text-center">
              <span className="font-medium inline-flex items-center gap-1">
                {completedCount}
                <span>/</span>
                {isInfinite ? (
                  <InfinityIcon className="h-3 w-3 text-muted-foreground" />
                ) : (
                  <span>{totalCount}</span>
                )}
              </span>
              <div className="text-xs text-muted-foreground">completed</div>
            </div>
          );
        },
        enableSorting: true,
        accessorFn: (row: HistoryDataItem) => {
          const totalCount = row.numScenarios;
          if (totalCount === null || totalCount === 0) return 0;
          return row.numScenariosCompleted / totalCount;
        },
        filterFn: (row, _id, value) => {
          if (!value || value.length === 0) return true;

          const scenarioIds = row.original.scenario_ids;
          const hasSelectedScenario = value.some((scenarioId: string) =>
            scenarioIds.includes(scenarioId)
          );

          return hasSelectedScenario;
        },
      },
      // Personas tested column
      {
        accessorKey: "personaNames",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Personas" />
        ),
        cell: ({ row }) => {
          const personaNames = row.getValue("personaNames") as string[];
          const personaColors = row.original.personaColors;

          if (
            !personaNames ||
            !Array.isArray(personaNames) ||
            personaNames.length === 0
          ) {
            return <span className="text-muted-foreground">None</span>;
          }

          return (
            <div className="flex flex-wrap gap-1">
              {personaNames.map((personaName, index) => {
                const baseHex = personaColors?.[index] || "#9CA3AF"; // gray-400 fallback

                // Simple color utility (you might want to use the more complex one from the original)
                const getBadgeColors = (hex: string) => {
                  // Simplified color logic - you can enhance this
                  return {
                    bg: `${hex}20`,
                    border: hex,
                    text: hex,
                  };
                };

                const { bg, border, text } = getBadgeColors(baseHex);

                return (
                  <Badge
                    key={index}
                    variant="outline"
                    className="text-xs"
                    style={{
                      backgroundColor: bg,
                      borderColor: border,
                      color: text,
                    }}
                  >
                    {personaName}
                  </Badge>
                );
              })}
            </div>
          );
        },
        filterFn: (row, id, value) => {
          const personaNames = row.getValue(id) as string[];
          if (!value || !Array.isArray(value) || value.length === 0)
            return true;
          return value.some((filterPersona: string) =>
            personaNames?.includes(filterPersona)
          );
        },
      },
      // Score column
      {
        accessorKey: "score",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Score" />
        ),
        accessorFn: (row: HistoryDataItem) => {
          return row.score || 0;
        },
        cell: ({ row }) => {
          const score = row.getValue("score") as number | null;

          if (score === null) {
            return <div className="text-muted-foreground">Not graded</div>;
          }

          return (
            <div className="text-center">
              <Badge
                variant="outline"
                className={`text-xs font-semibold ${
                  score >= 80
                    ? "bg-green-100 text-green-800 border-green-300 hover:bg-green-200"
                    : score >= 70
                      ? "bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200"
                      : "bg-red-100 text-red-800 border-red-300 hover:bg-red-200"
                }`}
              >
                {score}%
              </Badge>
            </div>
          );
        },
        enableSorting: true,
        filterFn: (row, _, value) => {
          const score = row.getValue("score") as number | null;

          if (score === null) {
            return value.includes("not-graded");
          }

          if (score >= 80) {
            return value.includes("excellent");
          } else if (score >= 70) {
            return value.includes("good");
          } else {
            return value.includes("needs-improvement");
          }
        },
      },
      // Actions column
      {
        id: "actions",
        cell: ({ row }) => {
          const item = row.original;

          return (
            <DataTableRowActions
              id={item.attemptId}
              profileId={item.profileId}
              simulationId={item.simulation_id}
              scenarios={[]} // You might need to pass scenario data here
              interactionIds={item.scenario_ids}
              isIncomplete={false} // Based on your logic
              isPractice={item.practiceSimulation || false}
              infiniteMode={item.infiniteMode}
              infiniteModeTimeLimit={null} // Can be determined server-side if needed
              attemptCreatedAt={item.date.toISOString()}
              archived={item.isArchived}
              showArchive={showArchive}
            />
          );
        },
      },
    ];

    return attemptColumns;
  }, [allSameProfile, showArchive]);

  // Derive cohort data from history items for the current profile
  const cohortData = React.useMemo(() => {
    if (!data || data.length === 0 || !effectiveProfile?.id) return [];

    // Filter data to only include entries for the current effective profile
    const profileData = data.filter(
      (item) => item.profileId === effectiveProfile.id
    );

    if (profileData.length === 0) return [];

    // Get profile name from any entry (they should all be the same)
    const profileName = profileData[0]?.profileName || "Unknown User";

    // Group by simulation to get the highest score for each simulation
    const simulationMap = new Map<
      string,
      { name: string; score: number; passed: boolean }
    >();

    profileData.forEach((item) => {
      const existing = simulationMap.get(item.simulation_id);
      const currentScore = item.score || 0;
      const passThreshold = item.passPct || 70;
      const currentPassed = currentScore >= passThreshold;

      // Keep the highest score for each simulation
      if (!existing || currentScore > existing.score) {
        simulationMap.set(item.simulation_id, {
          name: item.simulationName,
          score: currentScore,
          passed: currentPassed,
        });
      }
    });

    // Convert to cohort data format
    const simulations = Array.from(simulationMap.values());

    // Calculate average score across all simulations
    const averageScore =
      simulations.length > 0
        ? simulations.reduce((sum, sim) => sum + sim.score, 0) /
          simulations.length
        : 0;

    // Get the average pass percentage threshold (use the first item's passPct as representative)
    const averagePassThreshold =
      profileData.length > 0 ? profileData[0]?.passPct || 70 : 70;

    // Cohort is passed if average score meets the pass threshold
    const cohortPassed = averageScore >= averagePassThreshold;

    // Create cohort data with profile name and simulation results
    return [
      {
        name: profileName,
        passed: cohortPassed,
        simulations: simulations,
      },
    ];
  }, [data, effectiveProfile?.id]);

  // Create a key based on the data to force re-render when data changes
  const tableKey = React.useMemo(() => {
    if (!data || data.length === 0) return "empty";
    return data.map((item) => item.attemptId).join("-");
  }, [data]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <DataTable
      key={tableKey}
      data={data}
      columns={columns as never}
      profileOptions={profileOptions}
      simulationOptions={simulationOptions}
      scenarioOptions={scenarioOptions}
      showExport={showExport}
      showArchive={showArchive}
      showAll={true} // Always show all since filtering is handled upstream
      cohortData={cohortData}
    />
  );
}
