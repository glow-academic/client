"use client";
import { DataTableColumnHeader } from "@/components/common/history/DataTableColumnHeader";
import { DataTableRowActions } from "@/components/common/history/DataTableRowActions";
import { Badge } from "@/components/ui/badge";
import {
  Profile,
  ProfileRole,
  SimulationAttempt,
  SimulationChat,
} from "@/types";
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { getAllPersonas } from "@/utils/queries/personas/get-all-personas";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
// Removed time-based timeout logic per requirements
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

// Component to use the columns with data from queries
export function useHistoryColumns({
  profileId = null,
  showExport: _showExport = true,
  cohortIds = undefined,
  showPractice = false,
  showGeneral = true,
  startDate,
  endDate,
  allowedRoles,
}: {
  profileId?: string | null;
  showExport?: boolean;
  cohortIds: string[] | undefined;
  showPractice?: boolean;
  showGeneral?: boolean;
  startDate?: Date;
  endDate?: Date;
  allowedRoles?: ProfileRole[] | undefined;
}) {
  const { data: profiles, isLoading: isLoadingProfiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getAllProfiles(),
  });

  const { data: personas, isLoading: isLoadingPersonas } = useQuery({
    queryKey: ["personas"],
    queryFn: () => getAllPersonas(),
  });

  const { data: rubrics, isLoading: isLoadingRubrics } = useQuery({
    queryKey: ["rubrics"],
    queryFn: () => getAllRubrics(),
  });

  const { data: simulations, isLoading: isLoadingSimulations } = useQuery({
    queryKey: ["simulations"],
    queryFn: () => getAllSimulations(),
  });

  const { data: scenarios, isLoading: isLoadingScenarios } = useQuery({
    queryKey: ["scenarios"],
    queryFn: () => getAllScenarios(),
  });

  const { data: attempts, isLoading: isLoadingAttempts } = useQuery({
    queryKey: ["simulationAttempts", profiles?.map((profile) => profile.id)],
    queryFn: () =>
      getSimulationAttemptsByProfiles(profiles!.map((profile) => profile.id)),
    enabled: !!profiles && profiles.length > 0,
  });

  const filteredAttempts = useMemo(() => {
    if (!attempts) return [];
    return attempts.filter((attempt) => {
      if (startDate && endDate) {
        return (
          new Date(attempt.createdAt) >= startDate &&
          new Date(attempt.createdAt) <= endDate
        );
      }
      return true;
    });
  }, [attempts, startDate, endDate]);

  const { data: chats, isLoading: isLoadingChats } = useQuery({
    queryKey: [
      "simulationChats",
      filteredAttempts?.map((attempt) => attempt.id),
    ],
    queryFn: () =>
      getSimulationChatsByAttempts(
        filteredAttempts!.map((attempt) => attempt.id)
      ),
    enabled: !!filteredAttempts && filteredAttempts.length > 0,
  });

  const { data: grades, isLoading: isLoadingGrades } = useQuery({
    queryKey: ["simulationGrades", chats?.map((chat) => chat.id)],
    queryFn: () =>
      getSimulationChatGradesBySimulationChats(chats!.map((chat) => chat.id)),
    enabled: !!chats && chats.length > 0,
  });

  const { data: cohorts, isLoading: isLoadingCohorts } = useQuery({
    queryKey: ["cohorts"],
    queryFn: () => getAllCohorts(),
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

  // (color utilities are computed inline inside getBadgeColors)

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

  // Create user options for GTA names
  const profileOptions = useMemo(() => {
    if (!profiles) return [];
    return profiles.map((profile: Profile) => ({
      value: profile.id,
      label: profile.firstName + " " + profile.lastName,
      icon: null,
    }));
  }, [profiles]);

  // Filter valid rubrics based on simulations
  const validRubrics = useMemo(() => {
    if (!rubrics || !simulations) return [];
    return rubrics.filter((r) => simulations.some((s) => s.rubricId === r.id));
  }, [rubrics, simulations]);

  // Create enhanced attempts data
  const enhancedAttempts = useMemo(() => {
    if (!attempts || !chats || !personas || !simulations || !scenarios)
      return [];

    return attempts.map((attempt: SimulationAttempt): EnhancedAttempt => {
      const attemptChats = (chats || []).filter(
        (chat) => chat.attemptId === attempt.id
      );

      // Get agents from all scenarios in the chats
      const personasTested = [
        ...new Set(
          attemptChats.map((chat) => {
            // find the scenario for this chat
            const scenario = scenarios.find((s) => s.id === chat.scenarioId);
            if (scenario) {
              // Find agent by the agentId in the scenario
              const scenarioAgent = personas.find(
                (a) => a.id === scenario.personaId
              );
              return scenarioAgent?.name || "Unknown Persona";
            }

            return "Unknown Persona";
          })
        ),
      ].filter((name) => name !== "Unknown Persona"); // Filter out unknown personas

      const simulation = simulations?.find(
        (s) => s.id === attempt.simulationId
      );

      return {
        ...attempt,
        scenarios: attemptChats,
        personasTested,
        interactionIds: simulation?.scenarioIds || [],
      };
    });
  }, [attempts, chats, personas, simulations, scenarios]);

  // Create scenario options for filtering
  const scenarioOptions = useMemo(() => {
    if (!scenarios) return [];
    return scenarios.map((scenario) => ({
      value: scenario.id,
      label: scenario.name,
    }));
  }, [scenarios]);

  // Create simulation options for filtering
  const simulationOptions = useMemo(() => {
    if (!simulations) return [];
    return simulations.map((simulation) => ({
      value: simulation.id,
      label: simulation.title,
    }));
  }, [simulations]);

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
      // User Name column - only show if profileId is null (showing all data)
      ...(profileId === null
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
          const simulation = simulations?.find(
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
          const simulation = simulations?.find((s) => s.id === simulationId);
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
            const scenario = scenarios?.find((s) => s.id === scenarioId);
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
            const grade = grades?.find((g) => g.simulationChatId === chat.id);
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
            const grade = grades?.find((g) => g.simulationChatId === chat.id);
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
              grades?.find((grade) => grade.simulationChatId === chat.id)
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
              grades?.find((grade) => grade.simulationChatId === chat.id)
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
          const simulation = simulations?.find(
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
              grades?.find((grade) => grade.simulationChatId === chat.id)
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
          const simulation = simulations?.find(
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
              grades?.find((grade) => grade.simulationChatId === chat.id)
            )
            .filter(Boolean);

          const totalExpected = expectedChats || chatsArray.length;
          const allChatsCompleted = completedChats.length === totalExpected;

          // New definition: incomplete when all chats are completed but none have a rubric
          const isIncomplete =
            allChatsCompleted && gradedCompletedChatGrades.length === 0;

          return (
            <DataTableRowActions
              id={attempt.id}
              profileId={attempt.profileId || ""}
              simulationId={(attempt as EnhancedAttempt).simulationId}
              scenarios={attempt.scenarios}
              interactionIds={attempt.interactionIds}
              isIncomplete={isIncomplete}
              isPractice={showPractice}
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
    grades,
    simulations,
    scenarios,
    validRubrics,
    profileId,
    showPractice,
    personaColorMap,
    getBadgeColors,
  ]);

  // Use enhanced attempts data
  let data: unknown[] = enhancedAttempts || [];

  // Apply cohort filtering if cohortIds are provided
  if (cohortIds && cohortIds.length > 0 && cohorts) {
    // Get cohort filtering data
    const matchingCohorts = cohorts.filter(
      (cohort) => cohortIds.includes(cohort.id) && cohort.active
    );

    if (matchingCohorts.length > 0) {
      // Collect all profile IDs and simulation IDs from matching cohorts
      const allowedProfileIds = new Set<string>();
      const allowedSimulationIds = new Set<string>();

      matchingCohorts.forEach((cohort) => {
        cohort.profileIds.forEach((profileId: string) =>
          allowedProfileIds.add(profileId)
        );
        cohort.simulationIds.forEach((simulationId: string) =>
          allowedSimulationIds.add(simulationId)
        );
      });

      // Add admins and superadmins to allowed profiles by default
      // This ensures that admin/superadmin attempts are always visible
      if (profiles) {
        profiles.forEach((profile) => {
          if (profile.role === "admin" || profile.role === "superadmin") {
            allowedProfileIds.add(profile.id);
          }
        });
      }

      // Filter attempts based on cohort membership and practice/general flags
      data = data.filter((attempt: unknown) => {
        const attemptData = attempt as Record<string, unknown>;
        const attemptProfileId = attemptData["profileId"] as string | undefined;
        const attemptSimulationId = attemptData["simulationId"] as
          | string
          | undefined;
        if (!attemptProfileId || !attemptSimulationId) return false;

        // Must be in allowed profiles when cohorts are selected
        const profileOk = allowedProfileIds.has(attemptProfileId);
        if (!profileOk) return false;

        // Determine if the attempt is practice or general
        const simulation = simulations?.find(
          (s) => s.id === attemptSimulationId
        );
        const isPractice = Boolean(simulation?.practiceSimulation);

        // Practice attempts bypass cohort simulation restrictions
        const practiceAllowed = showPractice && isPractice;
        // General attempts must match allowed cohort simulations when cohorts are selected
        const generalAllowed =
          showGeneral &&
          !isPractice &&
          allowedSimulationIds.has(attemptSimulationId);

        return practiceAllowed || generalAllowed;
      });
    } else {
      // No matching cohorts, show empty data
      data = [];
    }
  }

  // Apply practice/general filtering only when no cohort filtering block handled it
  if (!cohortIds || cohortIds.length === 0) {
    if (showPractice || showGeneral) {
      data = data.filter((attempt: unknown) => {
        const attemptData = attempt as Record<string, unknown>;
        const simulation = simulations?.find(
          (s) => s.id === attemptData["simulationId"]
        );
        const isPractice = Boolean(simulation?.practiceSimulation);
        return (showPractice && isPractice) || (showGeneral && !isPractice);
      });
    } else {
      // If both are false, show nothing
      data = [];
    }
  }

  // Apply role filtering if allowedRoles provided
  if (allowedRoles && allowedRoles.length > 0 && profiles) {
    const allowedSet = new Set<ProfileRole>(allowedRoles);
    const profileIdToRole = new Map<string, ProfileRole>();
    profiles.forEach((p) => profileIdToRole.set(p.id, p.role));
    data = data.filter((attempt: unknown) => {
      const attemptData = attempt as Record<string, unknown>;
      const pid = attemptData["profileId"] as string | undefined;
      if (!pid) return false;
      const role = profileIdToRole.get(pid);
      return role ? allowedSet.has(role) : false;
    });
  }

  // Apply filtering based on profileId parameter
  if (profileId !== null) {
    // If profileId is provided, filter to that specific profile
    data = data.filter(
      (attempt: unknown) =>
        (attempt as Record<string, unknown>)["profileId"] === profileId
    );
  } else {
    // If profileId is null, show all data
    // Don't filter - show all data
  }

  return {
    columns,
    data,
    profileOptions,
    simulationOptions,
    scenarioOptions,
    isLoading:
      isLoadingProfiles ||
      isLoadingAttempts ||
      isLoadingPersonas ||
      isLoadingChats ||
      isLoadingRubrics ||
      isLoadingGrades ||
      isLoadingSimulations ||
      isLoadingScenarios ||
      isLoadingCohorts,
  };
}
