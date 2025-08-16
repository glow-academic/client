"use client";
import { DataTableColumnHeader } from "@/components/common/history/DataTableColumnHeader";
import { DataTableRowActions } from "@/components/common/history/DataTableRowActions";
import { Badge } from "@/components/ui/badge";
import type { Profile, SimulationAttempt, SimulationChat } from "@/types";
import type { FilteredData } from "@/utils/analytics/filtering";
import { getAllPersonas } from "@/utils/queries/personas/get-all-personas";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { useQuery } from "@tanstack/react-query";
import { Column, ColumnDef, Row } from "@tanstack/react-table";
import { Infinity as InfinityIcon } from "lucide-react";
import { useCallback, useMemo } from "react";

// Enhanced types for the data table
interface EnhancedAttempt extends SimulationAttempt {
  scenarios: SimulationChat[];
  personasTested: string[];
  interactionIds: string[];
}

// Component to use the columns with filtered data
export function useHistoryColumns({
  filteredData,
  showExport: _showExport = true,
}: {
  filteredData: FilteredData | null;
  showExport: boolean;
}) {
  // Fetch additional data needed for display
  const { data: personas, isLoading: isLoadingPersonas } = useQuery({
    queryKey: ["personas"],
    queryFn: () => getAllPersonas(),
  });

  const { data: rubrics, isLoading: isLoadingRubrics } = useQuery({
    queryKey: ["rubrics"],
    queryFn: () => getAllRubrics(),
  });

  // Map persona name -> hex color
  const personaColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (personas && personas.length > 0) {
      for (const persona of personas) {
        if (persona?.name && persona?.color) {
          map[persona.name] = persona.color;
        }
      }
    }
    return map;
  }, [personas]);

  // Color utilities
  const getBadgeColors = useCallback(
    (
      inputHex?: string
    ): {
      bg: string;
      border: string;
      text: string;
    } => {
      const normalizeHexInline = (hex?: string): string | null => {
        if (!hex) return null;
        let clean = hex.replace("#", "");
        if (clean.length === 3) {
          clean = clean
            .split("")
            .map((c) => c + c)
            .join("");
        }
        if (clean.length !== 6) return null;
        return `#${clean.toUpperCase()}`;
      };

      const normalized = normalizeHexInline(inputHex) ?? "#9CA3AF"; // gray-400 fallback
      // Inline helpers to avoid changing dependencies
      const hexToRgbInline = (hex: string) => {
        const clean = hex.replace("#", "");
        return {
          r: parseInt(clean.substring(0, 2), 16),
          g: parseInt(clean.substring(2, 4), 16),
          b: parseInt(clean.substring(4, 6), 16),
        };
      };
      const rgbToHexInline = (r: number, g: number, b: number) => {
        const toHex = (v: number) => v.toString(16).padStart(2, "0");
        return `#${toHex(Math.max(0, Math.min(255, Math.round(r))))}${toHex(
          Math.max(0, Math.min(255, Math.round(g)))
        )}${toHex(Math.max(0, Math.min(255, Math.round(b))))}`.toUpperCase();
      };
      const mixWithWhiteInline = (hex: string, weight: number) => {
        const base = hexToRgbInline(hex);
        const white = { r: 255, g: 255, b: 255 };
        const r = base.r * (1 - weight) + white.r * weight;
        const g = base.g * (1 - weight) + white.g * weight;
        const b = base.b * (1 - weight) + white.b * weight;
        return rgbToHexInline(r, g, b);
      };
      const getLuminanceInline = (hex: string) => {
        const { r, g, b } = hexToRgbInline(hex);
        return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      };

      const bg = mixWithWhiteInline(normalized, 0.88); // very light background
      const border = mixWithWhiteInline(normalized, 0.7); // light border closer to original outline
      const text =
        getLuminanceInline(normalized) > 0.75 ? "#111827" : normalized; // readable text
      return { bg, border, text };
    },
    []
  );

  // Create user options for profile names
  const profileOptions = useMemo(() => {
    if (!filteredData?.profiles) return [];
    return filteredData.profiles.map((profile: Profile) => ({
      value: profile.id,
      label: profile.firstName + " " + profile.lastName,
      icon: null,
    }));
  }, [filteredData?.profiles]);

  // Filter valid rubrics based on simulations
  const validRubrics = useMemo(() => {
    if (!rubrics || !filteredData?.simulations) return [];
    return rubrics.filter((r) =>
      filteredData.simulations.some((s) => s.rubricId === r.id)
    );
  }, [rubrics, filteredData?.simulations]);

  // Create enhanced attempts data from filtered data
  const enhancedAttempts = useMemo(() => {
    if (!filteredData || !personas) return [];

    return filteredData.attempts.map(
      (attempt: SimulationAttempt): EnhancedAttempt => {
        const attemptChats = filteredData.chats.filter(
          (chat) => chat.attemptId === attempt.id
        );

        // Get personas from all scenarios in the chats
        const personasTested = [
          ...new Set(
            attemptChats.map((chat) => {
              const scenario = filteredData.scenarios.find(
                (s) => s.id === chat.scenarioId
              );
              if (scenario) {
                const scenarioAgent = personas.find(
                  (a) => a.id === scenario.personaId
                );
                return scenarioAgent?.name || "Unknown Persona";
              }
              return "Unknown Persona";
            })
          ),
        ].filter((name) => name !== "Unknown Persona");

        const simulation = filteredData.simulations.find(
          (s) => s.id === attempt.simulationId
        );

        return {
          ...attempt,
          scenarios: attemptChats,
          personasTested,
          interactionIds: simulation?.scenarioIds || [],
        };
      }
    );
  }, [filteredData, personas]);

  // Create scenario options for filtering
  const scenarioOptions = useMemo(() => {
    if (!filteredData?.scenarios) return [];
    return filteredData.scenarios.map((scenario) => ({
      value: scenario.id,
      label: scenario.name,
    }));
  }, [filteredData?.scenarios]);

  // Create simulation options for filtering
  const simulationOptions = useMemo(() => {
    if (!filteredData?.simulations) return [];
    return filteredData.simulations.map((simulation) => ({
      value: simulation.id,
      label: simulation.title,
    }));
  }, [filteredData?.simulations]);

  // Define columns - only attempts view
  const columns = useMemo(() => {
    const attemptColumns: ColumnDef<EnhancedAttempt>[] = [
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

          return (
            <div className="font-medium text-sm">
              <div>
                {month}-{day}-{year}
              </div>
              <div className="text-xs text-muted-foreground">{time}</div>
            </div>
          );
        },
        enableSorting: true,
        sortDescFirst: true, // Default to descending order
      },
      // User Name column - only show if multiple profiles in filtered data
      ...(filteredData?.profiles && filteredData.profiles.length > 1
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
          const simulation = filteredData?.simulations?.find(
            (s) => s.id === row.getValue("simulationId")
          );
          const isInfinite = (row.original as EnhancedAttempt).infiniteMode;
          return (
            <div className="flex items-center space-x-1">
              <span className="max-w-[500px] truncate font-medium">
                {simulation?.title || "Unknown Simulation"}
              </span>
              {isInfinite && (
                <InfinityIcon className="h-3 w-3 text-muted-foreground" />
              )}
            </div>
          );
        },
        enableHiding: true,
        filterFn: (row, id, value) => {
          if (!value) return true;

          const searchTerm = value.toLowerCase();
          const simulationId = row.getValue(id) as string;
          const simulation = filteredData?.simulations?.find(
            (s) => s.id === simulationId
          );
          const simulationTitle = simulation?.title?.toLowerCase() || "";

          // Search in simulation title
          if (simulationTitle.includes(searchTerm)) return true;

          // Search in profile name
          const profileId = row.getValue("profileId") as string;
          const profileOption = profileOptions.find(
            (p) => p.value === profileId
          );
          const profileName = profileOption?.label?.toLowerCase() || "";
          if (profileName.includes(searchTerm)) return true;

          // Search in scenarios (chats)
          const chats = row.getValue("scenarios") as SimulationChat[];
          const scenarioIds = chats.map((chat) => chat.scenarioId);
          const scenarioNames = scenarioIds.map((scenarioId) => {
            const scenario = filteredData?.scenarios?.find(
              (s) => s.id === scenarioId
            );
            return scenario?.name?.toLowerCase() || "";
          });
          if (scenarioNames.some((name) => name.includes(searchTerm)))
            return true;

          return false;
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
          const isInfinite = (row.original as EnhancedAttempt).infiniteMode;

          // Ensure chats is an array
          const chatsArray = Array.isArray(chats) ? chats : [];
          // Count only chats that are completed AND have a corresponding rubric/grade
          const completedWithRubricCount = chatsArray.filter((chat) => {
            if (!chat.completed) return false;
            const grade = filteredData?.grades?.find(
              (g) => g.simulationChatId === chat.id
            );
            return Boolean(grade);
          }).length;
          const totalChats = interactionIds?.length || chatsArray.length || 0;

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
          const chats = row.scenarios;
          const interactionIds = row.interactionIds;

          // Ensure chats is an array
          const chatsArray = Array.isArray(chats) ? chats : [];
          // Only count chats that are completed AND have a corresponding rubric/grade
          const completedWithRubricCount = chatsArray.filter((chat) => {
            if (!chat.completed) return false;
            const grade = filteredData?.grades?.find(
              (g) => g.simulationChatId === chat.id
            );
            return Boolean(grade);
          }).length;
          const totalChats = interactionIds?.length || chatsArray.length || 0;
          return totalChats > 0 ? completedWithRubricCount / totalChats : 0;
        },
        filterFn: (row, id, value) => {
          if (!value || value.length === 0) return true;

          const chats = row.getValue(id) as SimulationChat[];

          // Ensure chats is an array
          const chatsArray = Array.isArray(chats) ? chats : [];

          // Check if any of the selected scenario IDs are present in the attempt's scenarios
          const attemptScenarioIds =
            chatsArray.map((chat) => chat.scenarioId) || [];
          const hasSelectedScenario = value.some((scenarioId: string) =>
            attemptScenarioIds.includes(scenarioId)
          );

          return hasSelectedScenario;
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
              {personasTested.map((agentName, index) => {
                const baseHex = personaColorMap[agentName] ?? "#9CA3AF"; // gray-400 fallback
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
                    {agentName}
                  </Badge>
                );
              })}
            </div>
          );
        },
        filterFn: (row, id, value) => {
          const personasTested = row.getValue(id) as string[];
          if (!value || value.length === 0) return true;
          return value.some((filterAgent: string) =>
            personasTested?.some((agent) =>
              agent.toLowerCase().includes(filterAgent.toLowerCase())
            )
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
          const chats = row.scenarios;

          // Ensure chats is an array
          const chatsArray = Array.isArray(chats) ? chats : [];
          if (chatsArray.length === 0) return 0;

          // Only include chats that are completed AND have a rubric/grade
          const gradedCompletedChatGrades = chatsArray
            .filter((chat) => chat.completed)
            .map((chat) =>
              filteredData?.grades?.find(
                (grade) => grade.simulationChatId === chat.id
              )
            )
            .filter(Boolean);

          if (gradedCompletedChatGrades.length === 0) return 0;

          const totalScore = gradedCompletedChatGrades.reduce(
            (sum: number, grade) => sum + (grade?.score || 0),
            0
          );
          return totalScore / gradedCompletedChatGrades.length;
        },
        cell: ({ row }) => {
          const chats = row.original.scenarios;
          const expectedChats = row.original.interactionIds?.length;

          // Ensure chats is an array
          const chatsArray = Array.isArray(chats) ? chats : [];
          if (chatsArray.length === 0) {
            return <div className="text-muted-foreground">No chats</div>;
          }

          const completedChats = chatsArray.filter((chat) => chat.completed);
          const gradedCompletedChatGrades = completedChats
            .map((chat: SimulationChat) =>
              filteredData?.grades?.find(
                (grade) => grade.simulationChatId === chat.id
              )
            )
            .filter(Boolean);

          // Determine if all chats are completed based on expected count
          const totalExpected = expectedChats || chatsArray.length;
          const allChatsCompleted = completedChats.length === totalExpected;

          // Show Incomplete if all chats are completed but no rubrics exist
          if (allChatsCompleted && gradedCompletedChatGrades.length === 0) {
            return <div className="text-red-500 font-medium">Incomplete</div>;
          }

          // If no graded chats, show Not graded
          if (gradedCompletedChatGrades.length === 0) {
            return <div className="text-muted-foreground">Not graded</div>;
          }

          const totalScore = gradedCompletedChatGrades.reduce(
            (sum: number, grade) => sum + (grade?.score || 0),
            0
          );
          const averageScore = totalScore / gradedCompletedChatGrades.length;

          // Calculate percentage based on rubric total points
          // Find the rubric for this simulation
          const simulation = filteredData?.simulations?.find(
            (s) => s.id === row.original.simulationId
          );
          const rubric = validRubrics.find(
            (r) => r.id === simulation?.rubricId
          );

          // Calculate percentage using rubric total points, fallback to 100 if not found
          const rubricTotalPoints = rubric?.points || 100;
          const scorePercent = Math.round(
            (averageScore / rubricTotalPoints) * 100
          );

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
          const chats = row.getValue("scenarios") as SimulationChat[];

          // Ensure chats is an array
          const chatsArray = Array.isArray(chats) ? chats : [];
          if (chatsArray.length === 0) {
            return value.includes("not-graded");
          }

          const completedChats = chatsArray.filter((chat) => chat.completed);
          const gradedCompletedChatGrades = completedChats
            .map((chat: SimulationChat) =>
              filteredData?.grades?.find(
                (grade) => grade.simulationChatId === chat.id
              )
            )
            .filter(Boolean);

          const totalExpected =
            row.original.interactionIds?.length || chatsArray.length;
          const allChatsCompleted = completedChats.length === totalExpected;

          if (gradedCompletedChatGrades.length === 0) {
            if (allChatsCompleted) {
              return value.includes("incomplete");
            }
            return value.includes("not-graded");
          }

          const totalScore = gradedCompletedChatGrades.reduce(
            (sum: number, grade) => sum + (grade?.score || 0),
            0
          );
          const averageScore = totalScore / gradedCompletedChatGrades.length;

          // Calculate percentage based on rubric total points
          const simulation = filteredData?.simulations?.find(
            (s) => s.id === row.original.simulationId
          );
          const rubric = validRubrics.find(
            (r) => r.id === simulation?.rubricId
          );
          const rubricTotalPoints = rubric?.points || 100;
          const scorePercent = Math.round(
            (averageScore / rubricTotalPoints) * 100
          );

          if (scorePercent >= 80) {
            return value.includes("excellent");
          } else if (scorePercent >= 70) {
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
          const attempt = row.original;
          const chats = attempt.scenarios;

          const expectedChats = attempt.interactionIds?.length;
          const chatsArray = Array.isArray(chats) ? chats : [];
          const completedChats = chatsArray.filter((chat) => chat.completed);
          const gradedCompletedChatGrades = completedChats
            .map((chat: SimulationChat) =>
              filteredData?.grades?.find(
                (grade) => grade.simulationChatId === chat.id
              )
            )
            .filter(Boolean);

          const totalExpected = expectedChats || chatsArray.length;
          const allChatsCompleted = completedChats.length === totalExpected;

          // New definition: incomplete when all chats are completed but none have a rubric
          const isIncomplete =
            allChatsCompleted && gradedCompletedChatGrades.length === 0;

          // Determine if this is practice mode based on simulation
          const simulation = filteredData?.simulations?.find(
            (s) => s.id === attempt.simulationId
          );
          const isPractice = Boolean(simulation?.practiceSimulation);

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
            />
          );
        },
      },
    ];

    return attemptColumns;
  }, [
    profileOptions,
    filteredData,
    validRubrics,
    personaColorMap,
    getBadgeColors,
  ]);

  // Use enhanced attempts data
  const data: unknown[] = enhancedAttempts || [];

  return {
    columns,
    data,
    profileOptions,
    simulationOptions,
    scenarioOptions,
    isLoading: isLoadingPersonas || isLoadingRubrics,
  };
}
