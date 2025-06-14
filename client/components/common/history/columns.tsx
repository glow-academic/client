"use client";
import { DataTableColumnHeader } from "@/components/common/history/data-table-column-header";
import { DataTableRowActions } from "@/components/common/history/data-table-row-actions";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Agent,
  Class,
  Profile,
  Scenario,
  SimulationAttempt,
  SimulationChat,
} from "@/types";
import { getAgentConfig } from "@/utils/agents";
import { getAllAgents } from "@/utils/queries/agents/get-all-agents";
import { getAllClasses } from "@/utils/queries/classes/get-all-classes";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getProfilesByUser } from "@/utils/queries/profiles/get-profiles-by-user";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatFeedbacksBySimulationChatGrades } from "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { getStandardGroupsByRubrics } from "@/utils/queries/standard_groups/get-standard-groups-by-rubrics";
import { getStandardsByStandardGroups } from "@/utils/queries/standards/get-standards-by-standardgroups";
import { getUserByEmail } from "@/utils/user/get-user-by-email";
import { useQuery } from "@tanstack/react-query";
import { ColumnDef, Row, Table } from "@tanstack/react-table";
import { useSession } from "next-auth/react";
import { useMemo } from "react";
import { Badge } from "../../ui/badge";

// Enhanced types for the data table
interface EnhancedAttempt extends SimulationAttempt {
  chats: SimulationChat[];
  agentsTested: string[];
  simulationTitle: string;
  interactionIds: string[];
  classIds: string[];
}

// Component to use the columns with data from queries
export function useColumns({
  showAll = false,
  showExport = true,
}: {
  showAll?: boolean;
  showExport?: boolean;
}) {
  const session = useSession();
  const userEmail = session.data?.user?.email;

  const { data: user } = useQuery({
    queryKey: ["user", userEmail],
    queryFn: () => getUserByEmail(userEmail!),
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", userEmail],
    queryFn: () => getProfilesByUser(user!.id!.toString()),
    select: (data) => data[0],
    enabled: !!user,
  });

  const { data: profiles, isLoading: isLoadingProfiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getAllProfiles(),
  });

  const { data: classes, isLoading: isLoadingClasses } = useQuery({
    queryKey: ["classes"],
    queryFn: () => getAllClasses(),
  });

  const { data: agents, isLoading: isLoadingAgents } = useQuery({
    queryKey: ["agents"],
    queryFn: () => getAllAgents(),
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

  const { data: standardGroups, isLoading: isLoadingStandardGroups } = useQuery(
    {
      queryKey: ["standardGroups", rubrics?.map((rubric) => rubric.id)],
      queryFn: () =>
        getStandardGroupsByRubrics(rubrics!.map((rubric) => rubric.id)),
      enabled: !!rubrics && rubrics.length > 0,
    }
  );

  const { data: standards, isLoading: isLoadingStandards } = useQuery({
    queryKey: ["standards", standardGroups?.map((group) => group.id)],
    queryFn: () =>
      getStandardsByStandardGroups(standardGroups!.map((group) => group.id)),
    enabled: !!standardGroups && standardGroups.length > 0,
  });

  const { data: attempts, isLoading: isLoadingAttempts } = useQuery({
    queryKey: ["simulationAttempts", profiles?.map((profile) => profile.id)],
    queryFn: () =>
      getSimulationAttemptsByProfiles(profiles!.map((profile) => profile.id)),
    enabled: !!profiles && profiles.length > 0,
  });

  const { data: chats, isLoading: isLoadingChats } = useQuery({
    queryKey: ["simulationChats", attempts?.map((attempt) => attempt.id)],
    queryFn: () =>
      getSimulationChatsByAttempts(attempts!.map((attempt) => attempt.id)),
    enabled: !!attempts && attempts.length > 0,
  });

  const { data: grades, isLoading: isLoadingGrades } = useQuery({
    queryKey: ["simulationGrades", chats?.map((chat) => chat.id)],
    queryFn: () =>
      getSimulationChatGradesBySimulationChats(chats!.map((chat) => chat.id)),
    enabled: !!chats && chats.length > 0,
  });

  const { data: feedbacks, isLoading: isLoadingFeedbacks } = useQuery({
    queryKey: ["simulationFeedbacks", grades?.map((grade) => grade.id)],
    queryFn: () =>
      getSimulationChatFeedbacksBySimulationChatGrades(
        grades!.map((grade) => grade.id)
      ),
    enabled: !!grades && grades.length > 0,
  });

  // Create dynamic profile types from database profiles
  const agentTypes = useMemo(() => {
    if (!agents) return [];
    return agents.map((agent: Agent) => ({
      value: agent.id,
      label: agent.name,
      icon: getAgentConfig(agent.name).icon,
    }));
  }, [agents]);

  // Create user options for GTA names
  const profileOptions = useMemo(() => {
    if (!profiles) return [];
    return profiles.map((profile: Profile) => ({
      value: profile.id,
      label: profile.firstName + " " + profile.lastName,
      icon: null,
    }));
  }, [profiles]);

  // Create class options - only include classes that are used in scenarios
  const classOptions = useMemo(() => {
    if (!classes || !scenarios) return [];

    // Get unique class IDs from scenarios
    const usedClassIds = [
      ...new Set(
        scenarios
          .map((scenario: Scenario) => scenario.classId)
          .filter((classId): classId is string => classId !== null)
      ),
    ];

    return classes
      .filter((cls: Class) => usedClassIds.includes(cls.id))
      .map((cls: Class) => ({
        value: cls.id,
        label: cls.classCode,
        icon: null,
      }));
  }, [classes, scenarios]);

  // Filter valid rubrics based on simulations
  const validRubrics = useMemo(() => {
    if (!rubrics || !simulations) return [];
    return rubrics.filter((r) => simulations.some((s) => s.rubricId === r.id));
  }, [rubrics, simulations]);

  // Filter valid standard groups based on valid rubrics
  const validStandardGroups = useMemo(() => {
    if (!standardGroups || !validRubrics) return [];
    return standardGroups.filter((g) =>
      validRubrics.some((r) => r.id === g.rubricId)
    );
  }, [standardGroups, validRubrics]);

  // Filter valid standards based on valid standard groups
  const validStandards = useMemo(() => {
    if (!standards || !validStandardGroups) return [];
    return standards.filter((s) =>
      validStandardGroups.some((g) => g.id === s.standardGroupId)
    );
  }, [standards, validStandardGroups]);

  // Create enhanced attempts data
  const enhancedAttempts = useMemo(() => {
    if (!attempts || !chats || !agents || !simulations || !scenarios) return [];

    return attempts.map((attempt: SimulationAttempt): EnhancedAttempt => {
      const attemptChats = chats.filter(
        (chat) => chat.attemptId === attempt.id
      );

      // Get agents from all scenarios in the chats
      const agentsTested = [
        ...new Set(
          attemptChats.map((chat) => {
            // find the scenario for this chat
            const scenario = scenarios.find((s) => s.id === chat.scenarioId);
            if (scenario) {
              // Find agent by the agentId in the scenario
              const scenarioAgent = agents.find(
                (a) => a.id === scenario.agentId
              );
              return scenarioAgent?.name || "Unknown Agent";
            }

            return "Unknown Agent";
          })
        ),
      ].filter((name) => name !== "Unknown Agent"); // Filter out unknown agents

      const simulation = simulations?.find(
        (s) => s.id === attempt.simulationId
      );

      // Derive all classIds from all scenarios in the chats
      const derivedClassIds = [
        ...new Set(
          attemptChats
            .map((chat) => {
              const scenario = scenarios.find(
                (s: Scenario) => s.id === chat.scenarioId
              );
              return scenario?.classId;
            })
            .filter((classId): classId is string => classId !== null)
        ),
      ];

      return {
        ...attempt,
        chats: attemptChats,
        agentsTested,
        simulationTitle:
          simulation?.title || `Simulation ${attempt.simulationId}`,
        interactionIds: simulation?.scenarioIds || [],
        classIds: derivedClassIds, // Add all class IDs for display
      };
    });
  }, [attempts, chats, agents, simulations, scenarios]);

  // Create skill categories from standard groups for scoring
  const skillCategories = useMemo(() => {
    if (!validStandardGroups || !validStandards || !feedbacks) return {};

    const categories: Record<string, number> = {};

    validStandardGroups.forEach((group) => {
      const groupStandards = validStandards.filter(
        (s) => s.standardGroupId === group.id
      );
      const groupFeedbacks = feedbacks.filter((f) =>
        groupStandards.some((s) => s.id === f.standardId)
      );

      if (groupFeedbacks.length > 0) {
        const avgScore =
          groupFeedbacks.reduce((sum, f) => sum + f.total, 0) /
          groupFeedbacks.length;
        const maxPoints = groupStandards[0]?.points || 5;
        categories[group.name] = Math.round((avgScore / maxPoints) * 100);
      }
    });

    return categories;
  }, [validStandardGroups, validStandards, feedbacks]);

  // Create dynamic score options from valid standard groups using shortName
  const scoreOptions = useMemo(() => {
    if (!validStandardGroups) return [];
    return validStandardGroups.map((group) => ({
      value: group.shortName,
      label: group.shortName, // Use shortName for both value and label to fit in space
    }));
  }, [validStandardGroups]);

  // Create score range options for filtering
  const scoreRangeOptions = useMemo(
    () => [
      {
        value: "excellent",
        label: "Excellent (80%+)",
      },
      {
        value: "good",
        label: "Good (70-79%)",
      },
      {
        value: "needs-improvement",
        label: "Needs Improvement (<70%)",
      },
      {
        value: "not-graded",
        label: "Not Graded",
      },
    ],
    []
  );

  // Define columns - only attempts view
  const columns = useMemo(() => {
    const attemptColumns: ColumnDef<EnhancedAttempt>[] = [
      // Select column - only show if showExport is true
      ...(showExport
        ? [
            {
              id: "select",
              header: ({ table }: { table: Table<EnhancedAttempt> }) => (
                <Checkbox
                  checked={
                    table.getIsAllPageRowsSelected() ||
                    (table.getIsSomePageRowsSelected() && "indeterminate")
                  }
                  onCheckedChange={(value: boolean | "indeterminate") =>
                    table.toggleAllPageRowsSelected(!!value)
                  }
                  aria-label="Select all"
                  className="translate-y-[2px]"
                />
              ),
              cell: ({ row }: { row: Row<EnhancedAttempt> }) => (
                <Checkbox
                  checked={row.getIsSelected()}
                  onCheckedChange={(value: boolean | "indeterminate") =>
                    row.toggleSelected(!!value)
                  }
                  aria-label="Select row"
                  className="translate-y-[2px]"
                />
              ),
              enableSorting: false,
              enableHiding: false,
            },
          ]
        : []),
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
        filterFn: (row, id, value) => {
          if (!value || value.length === 0) return true;
          const rowDate = new Date(row.getValue(id) as string);
          const [fromDate, toDate] = value as [Date, Date];
          if (fromDate && toDate) {
            return rowDate >= fromDate && rowDate <= toDate;
          }
          return true;
        },
      },
      // User Name column - only show if showAll is true
      ...(showAll
        ? [
            {
              accessorKey: "profileId",
              header: ({ column }: { column: any }) => (
                <DataTableColumnHeader column={column} title="Name" />
              ),
              cell: ({ row }: { row: any }) => {
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
              filterFn: (row: any, id: any, value: any) => {
                return value.includes(row.getValue(id) as string);
              },
              enableSorting: true,
            },
          ]
        : []),
      // Simulation Title column
      {
        accessorKey: "simulationTitle",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Simulation" />
        ),
        cell: ({ row }) => {
          return (
            <div className="flex space-x-2">
              <span className="max-w-[500px] truncate font-medium">
                {row.getValue("simulationTitle") || "Unknown Simulation"}
              </span>
            </div>
          );
        },
      },
      // Class column
      {
        accessorKey: "classIds",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Classes" />
        ),
        cell: ({ row }) => {
          const classIds = row.original.classIds || [];

          if (!classIds || classIds.length === 0) {
            return <span className="text-muted-foreground">No Classes</span>;
          }

          const classLabels = classIds
            .map((classId) => {
              const classOption = classOptions.find(
                (cls) => cls.value === classId
              );
              return classOption ? classOption.label : "Unknown Class";
            })
            .filter((label) => label !== "Unknown Class");

          if (classLabels.length === 0) {
            return (
              <span className="text-muted-foreground">Unknown Classes</span>
            );
          }

          return (
            <div className="flex flex-wrap gap-1">
              {classLabels.map((label, index) => (
                <Badge
                  key={index}
                  variant="outline"
                  className="text-xs bg-blue-100 text-blue-800 border-blue-300"
                >
                  {label}
                </Badge>
              ))}
            </div>
          );
        },
        filterFn: (row, id, value) => {
          const classId = row.getValue(id) as string | null;
          if (!classId) return false; // Exclude rows without classId from filters
          return value.includes(classId);
        },
        enableSorting: true,
      },
      // Chats completion column
      {
        accessorKey: "chats",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Chats" />
        ),
        cell: ({ row }) => {
          const chats = row.getValue("chats") as SimulationChat[];
          const interactionIds = row.original.interactionIds;

          const completedChats =
            chats?.filter((chat) => chat.completed).length || 0;
          const totalChats = interactionIds?.length || chats?.length || 0;

          return (
            <div className="text-center">
              <span className="font-medium">
                {completedChats}/{totalChats}
              </span>
              <div className="text-xs text-muted-foreground">completed</div>
            </div>
          );
        },
        enableSorting: false,
      },
      // Agents tested column
      {
        accessorKey: "agentsTested",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Agents" />
        ),
        cell: ({ row }) => {
          const agentsTested = row.getValue("agentsTested") as string[];

          if (!agentsTested || agentsTested.length === 0) {
            return <span className="text-muted-foreground">None</span>;
          }

          return (
            <div className="flex flex-wrap gap-1">
              {agentsTested.map((agentName, index) => {
                const badgeColorClass =
                  agentName.toLowerCase() === "aggressive"
                    ? "bg-red-100 text-red-800 border-red-300"
                    : agentName.toLowerCase() === "happy"
                      ? "bg-green-100 text-green-800 border-green-300"
                      : agentName.toLowerCase() === "confused"
                        ? "bg-yellow-100 text-yellow-800 border-yellow-300"
                        : "bg-gray-100 text-gray-800 border-gray-300";

                return (
                  <Badge
                    key={index}
                    variant="outline"
                    className={`text-xs ${badgeColorClass}`}
                  >
                    {agentName}
                  </Badge>
                );
              })}
            </div>
          );
        },
        filterFn: (row, id, value) => {
          const agentsTested = row.getValue(id) as string[];
          if (!value || value.length === 0) return true;
          return value.some((filterAgent: string) =>
            agentsTested?.some((agent) =>
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
          const chats = row.chats;
          if (!chats || chats.length === 0) return 0;

          const chatGrades = chats
            .map((chat) =>
              grades?.find((grade) => grade.simulationChatId === chat.id)
            )
            .filter(Boolean);

          if (chatGrades.length === 0) return 0;

          const totalScore = chatGrades.reduce(
            (sum: number, grade) => sum + (grade?.score || 0),
            0
          );
          return totalScore / chatGrades.length;
        },
        cell: ({ row }) => {
          const chats = row.getValue("chats") as SimulationChat[];
          if (!chats || chats.length === 0) {
            return <div className="text-muted-foreground">No chats</div>;
          }

          const chatGrades = chats
            .map((chat: SimulationChat) =>
              grades?.find((grade) => grade.simulationChatId === chat.id)
            )
            .filter(Boolean);

          if (chatGrades.length === 0) {
            const completedChats = chats.filter((chat) => chat.completed);
            if (completedChats.length > 0) {
              return <div className="text-amber-500">Grading in progress</div>;
            }
            return <div className="text-muted-foreground">Not graded</div>;
          }

          const totalScore = chatGrades.reduce(
            (sum: number, grade) => sum + (grade?.score || 0),
            0
          );
          const averageScore = totalScore / chatGrades.length;
          const scorePercent = Math.round(averageScore);

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
          const chats = row.getValue("chats") as SimulationChat[];
          if (!chats || chats.length === 0) {
            return value.includes("not-graded");
          }

          const chatGrades = chats
            .map((chat: SimulationChat) =>
              grades?.find((grade) => grade.simulationChatId === chat.id)
            )
            .filter(Boolean);

          if (chatGrades.length === 0) {
            return value.includes("not-graded");
          }

          const totalScore = chatGrades.reduce(
            (sum: number, grade) => sum + (grade?.score || 0),
            0
          );
          const averageScore = totalScore / chatGrades.length;
          const scorePercent = Math.round(averageScore);

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

          return <DataTableRowActions id={attempt.id} />;
        },
      },
    ];

    return attemptColumns;
  }, [profileOptions, classOptions, showAll, showExport, grades, profile]);

  // Use enhanced attempts data
  let data: unknown[] = enhancedAttempts || [];

  // Apply filtering based on showAll parameter
  if (!showAll && user) {
    // If showAll is false, filter to show only current user's data
    data = data.filter(
      (attempt: unknown) =>
        (attempt as Record<string, unknown>)["profileId"] === profile?.id
    );
  } else if (!user) {
    // If there's no user, show empty data
    data = [];
  }
  // If showAll is true, don't filter - show all data

  const isLoading =
    isLoadingProfiles ||
    isLoadingAttempts ||
    isLoadingAgents ||
    isLoadingChats ||
    isLoadingRubrics ||
    isLoadingStandardGroups ||
    isLoadingStandards ||
    isLoadingGrades ||
    isLoadingFeedbacks ||
    isLoadingClasses ||
    isLoadingSimulations ||
    isLoadingScenarios;

  return {
    columns,
    isLoading,
    data: data,
    profileOptions,
    classOptions,
    agentTypes,
    skillCategories,
    scoreOptions,
    scoreRangeOptions,
    showAll,
  };
}
