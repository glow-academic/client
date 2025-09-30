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
  scenario_titles: string[] | undefined;
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

    const map = new Map<string, string>(); // id -> title
    for (const item of data) {
      const ids = item.scenario_ids || [];
      const titles = item.scenario_titles || [];
      ids.forEach((id, i) => {
        const title = titles[i] || `Scenario ${id}`;
        if (!map.has(id)) map.set(id, title);
      });
    }
    return Array.from(map.entries()).map(([value, label]) => ({
      value,
      label,
    }));
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
      // Hidden faceting column for Name (IDs)
      {
        accessorKey: "profileId",
        id: "profileId",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
      },
      // Hidden faceting column for Simulation (IDs)
      {
        accessorKey: "simulation_id",
        id: "simulationId",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
      },
      // Hidden faceting column for Scenarios (IDs)
      {
        id: "scenarios",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        // Return the array of scenario IDs for this row
        accessorFn: (row: HistoryDataItem) => row.scenario_ids ?? [],
        // Let filtering check membership
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("scenarios") as string[]) ?? [];
          // keep row if it contains ANY selected scenario
          return value.some((v) => rowIds.includes(v));
        },
      },
      // Date column
      {
        accessorKey: "date",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Date" />
        ),
        cell: ({ row }) => {
          const raw = row.getValue("date") as string; // <-- it's a string
          const date = new Date(raw); // <-- parse it

          if (Number.isNaN(date.getTime())) {
            return (
              <div className="text-sm text-muted-foreground">Invalid Date</div>
            );
          }

          const day = String(date.getDate()).padStart(2, "0");
          const month = String(date.getMonth() + 1).padStart(2, "0");
          const year = String(date.getFullYear()).slice(-2);
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
        sortDescFirst: true,
      },
      // User Name column - only show if not all attempts have the same profile
      ...(!allSameProfile
        ? [
            {
              accessorKey: "profileName",
              id: "profileName",
              header: ({
                column,
              }: {
                column: Column<HistoryDataItem, unknown>;
              }) => <DataTableColumnHeader column={column} title="Name" />,
              cell: ({ row }: { row: Row<HistoryDataItem> }) => {
                const profileName = row.original.profileName;
                return (
                  <div className="flex items-center">
                    <span>{profileName}</span>
                  </div>
                );
              },
              filterFn: (
                row: Row<HistoryDataItem>,
                _id: string,
                value: string[]
              ) => {
                return value.includes(row.original.profileId);
              },
              enableSorting: true,
            },
          ]
        : []),
      // Simulation column
      {
        accessorKey: "simulationName",
        id: "simulationName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Simulation" />
        ),
        cell: ({ row }) => {
          const simulationName = row.original.simulationName;
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

          const simulationId = row.original.simulation_id; // <-- use original
          return value.includes(simulationId);
        },
      },
      // Scenarios completion column
      {
        accessorKey: "numScenariosCompleted",
        id: "numScenariosCompleted",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Scenarios" />
        ),
        cell: ({ row }) => {
          // Use original for display so we don't show a ratio:
          const completedCount = row.original.numScenariosCompleted;
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
        // Keep accessorFn solely to provide a sortable value (ratio)
        accessorFn: (row: HistoryDataItem) => {
          const total = row.numScenarios;
          if (total === null || total === 0) return 0;
          return row.numScenariosCompleted / total;
        },
        // scenario filtering should read from original
        filterFn: (row, _id, value) => {
          if (!value || value.length === 0) return true;
          const scenarioIds = row.original.scenario_ids || [];
          return value.some((scenarioId: string) =>
            scenarioIds.includes(scenarioId)
          );
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
        // keep value as-is; do NOT coalesce to 0
        accessorFn: (row: HistoryDataItem) => row.score, // <-- no `|| 0`
        cell: ({ row }) => {
          const score = row.original.score; // <-- read original for display
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
        // Use original for filter buckets too so null stays null
        filterFn: (row, _, value) => {
          const score = (row.original as HistoryDataItem).score;
          if (score === null) return value.includes("not-graded");
          if (score >= 80) return value.includes("excellent");
          if (score >= 70) return value.includes("good");
          return value.includes("needs-improvement");
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
              attemptCreatedAt={(() => {
                try {
                  const date = new Date(item.date);
                  return isNaN(date.getTime())
                    ? new Date().toISOString()
                    : date.toISOString();
                } catch {
                  return new Date().toISOString();
                }
              })()}
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
