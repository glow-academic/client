"use client";
import React from "react";
import { ColumnDef, Row, Table } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTableColumnHeader } from "@/components/common/history/data-table-column-header";
import { DataTableRowActions } from "@/components/common/history/data-table-row-actions";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Badge } from "../../ui/badge";
import { getAgentConfig } from "@/utils/agents";
import { getAllClasses } from "@/utils/queries/classes/get-all-classes";
import { getAllAgents } from "@/utils/queries/agents/get-all-agents";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getStandardGroupsByRubrics } from "@/utils/queries/standard_groups/get-standard-groups-by-rubrics";
import { getStandardsByStandardGroups } from "@/utils/queries/standards/get-standards-by-standardgroups";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatFeedbacksBySimulationChatGrades } from "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades";
import {
  Agent,
  Class,
  SimulationChat,
  SimulationAttempt,
  SimulationChatGrade,
  SimulationChatFeedback,
  Profile,
} from "@/types";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getProfilesByUser } from "@/utils/queries/profiles/get-profiles-by-user";
import { useSession } from "next-auth/react";
import { getUserByEmail } from "@/utils/user/get-user-by-email";

// Enhanced types for the data table
interface EnhancedAttempt extends SimulationAttempt {
  chats: SimulationChat[];
  agentsTested: string[];
  simulationTitle: string;
  interactionIds: string[];
}

interface EnhancedChat extends SimulationChat {
  grades: SimulationChatGrade[];
  feedbacks: SimulationChatFeedback[];
  profileId?: string;
  classId?: string;
}

// Component to use the columns with data from queries
export function useColumns({
  showChats = false,
  showAll = false,
  showExport = true,
}: {
  showChats?: boolean;
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
    queryFn: () => getProfilesByUser(user!.id!),
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

  const { data: standardGroups, isLoading: isLoadingStandardGroups } = useQuery(
    {
      queryKey: ["standardGroups", rubrics?.map((rubric) => rubric.id)],
      queryFn: () =>
        getStandardGroupsByRubrics(rubrics!.map((rubric) => rubric.id)),
      enabled: !!rubrics && rubrics.length > 0,
    },
  );

  const { data: standards, isLoading: isLoadingStandards } = useQuery({
    queryKey: ["standards", standardGroups?.map((group) => group.id)],
    queryFn: () =>
      getStandardsByStandardGroups(standardGroups!.map((group) => group.id)),
    enabled: !!standardGroups && standardGroups.length > 0,
  });

  const { data: attempts, isLoading: isLoadingAttempts } = useQuery({
    queryKey: ["simulationAttempts", profiles?.map((profile) => profile.id)],
    queryFn: () => getSimulationAttemptsByProfiles(profiles!.map((profile) => profile.id)),
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
        grades!.map((grade) => grade.id),
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

  // Create class options
  const classOptions = useMemo(() => {
    if (!classes) return [];
    return classes.map((cls: Class) => ({
      value: cls.id,
      label: cls.classCode,
      icon: null,
    }));
  }, [classes]);

  // Filter valid rubrics based on simulations
  const validRubrics = useMemo(() => {
    if (!rubrics || !simulations) return [];
    return rubrics.filter((r) => simulations.some((s) => s.rubricId === r.id));
  }, [rubrics, simulations]);

  // Filter valid standard groups based on valid rubrics
  const validStandardGroups = useMemo(() => {
    if (!standardGroups || !validRubrics) return [];
    return standardGroups.filter((g) => validRubrics.some((r) => r.id === g.rubricId));
  }, [standardGroups, validRubrics]);

  // Filter valid standards based on valid standard groups
  const validStandards = useMemo(() => {
    if (!standards || !validStandardGroups) return [];
    return standards.filter((s) => validStandardGroups.some((g) => g.id === s.standardGroupId));
  }, [standards, validStandardGroups]);

  // Create enhanced attempts data
  const enhancedAttempts = useMemo(() => {
    if (!attempts || !chats || !agents || !simulations) return [];

    return attempts.map((attempt: SimulationAttempt): EnhancedAttempt => {
      const attemptChats = chats.filter(
        (chat) => chat.attemptId === attempt.id,
      );
      
      // Get agents tested from chats - look at scenarioId and match with agents
      const agentsTested = [
        ...new Set(
          attemptChats.map((chat) => {
            // First try to find agent by scenarioId
            const agent = agents.find((a) => a.id === chat.scenarioId);
            if (agent) return agent.name;
            
            // If not found, try to get from simulation scenarios
            const simulation = simulations.find((s) => s.id === attempt.simulationId);
            if (simulation?.scenarioIds?.includes(chat.scenarioId)) {
              // Find agent by scenario ID in the simulation
              const scenarioAgent = agents.find((a) => 
                simulation.scenarioIds?.includes(a.id)
              );
              return scenarioAgent?.name || "Unknown Agent";
            }
            
            return "Unknown Agent";
          }),
        ),
      ].filter(name => name !== "Unknown Agent"); // Filter out unknown agents

      const simulation = simulations?.find(
        (s) => s.id === attempt.simulationId,
      );

      return {
        ...attempt,
        chats: attemptChats,
        agentsTested,
        simulationTitle:
          simulation?.title || `Simulation ${attempt.simulationId}`,
        interactionIds: simulation?.scenarioIds || [],
      };
    });
  }, [attempts, chats, agents, simulations]);

  // Create enhanced chats data
  const enhancedChats = useMemo(() => {
    if (!chats || !grades || !feedbacks || !attempts) return [];

    return chats.map((chat: SimulationChat): EnhancedChat => {
      const chatGrades = grades.filter(
        (grade) => grade.simulationChatId === chat.id,
      );
      const chatFeedbacks = feedbacks.filter((feedback) =>
        chatGrades.some((grade) => grade.id === feedback.simulationChatGradeId),
      );

      // Find the associated attempt to get user and class information
      const associatedAttempt = attempts.find(
        (attempt) => attempt.id === chat.attemptId,
      );

      return {
        ...chat,
        grades: chatGrades,
        feedbacks: chatFeedbacks,
        // Add user and class information from the associated attempt
        profileId: associatedAttempt?.profileId || undefined,
        classId: associatedAttempt?.classId || undefined,
      };
    });
  }, [chats, grades, feedbacks, attempts]);

  // Create skill categories from standard groups for scoring
  const skillCategories = useMemo(() => {
    if (!validStandardGroups || !validStandards || !feedbacks) return {};

    const categories: Record<string, number> = {};

    validStandardGroups.forEach((group) => {
      const groupStandards = validStandards.filter(
        (s) => s.standardGroupId === group.id,
      );
      const groupFeedbacks = feedbacks.filter((f) =>
        groupStandards.some((s) => s.id === f.standardId),
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



  // Define columns
  const columns = useMemo(() => {
    if (!showChats) {
      // Attempts view columns (when showChats is false, show attempts/simulations)
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
                    className="translate-y-[2px] ml-4"
                  />
                ),
                cell: ({ row }: { row: Row<EnhancedAttempt> }) => (
                  <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value: boolean | "indeterminate") =>
                      row.toggleSelected(!!value)
                    }
                    aria-label="Select row"
                    className="translate-y-[2px] ml-4"
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
            <DataTableColumnHeader
              column={column}
              title="Date"
              showChats={showChats}
            />
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
                header: ({ column }: any) => (
                  <DataTableColumnHeader
                    column={column}
                    title="Name"
                    showChats={showChats}
                  />
                ),
                cell: ({ row }: any) => {
                  const profileOption = profileOptions.find(
                    (profile) => profile.value === row.getValue("profileId"),
                  );

                  if (!profileOption) {
                    return (
                      <span className="text-muted-foreground">
                        Unknown User
                      </span>
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
            <DataTableColumnHeader
              column={column}
              title="Simulation"
              showChats={showChats}
            />
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
          accessorKey: "classId",
          header: ({ column }) => (
            <DataTableColumnHeader
              column={column}
              title="Class"
              showChats={showChats}
            />
          ),
          cell: ({ row }) => {
            const classOption = classOptions.find(
              (cls) => cls.value === row.getValue("classId"),
            );

            if (!classOption) {
              return <span className="text-muted-foreground">No Class</span>;
            }

            return (
              <div className="flex items-center">
                <span>{classOption.label}</span>
              </div>
            );
          },
          filterFn: (row, id, value) => {
            return value.includes(row.getValue(id) as string);
          },
          enableSorting: true,
        },
        // Chats completion column
        {
          accessorKey: "chats",
          header: ({ column }) => (
            <DataTableColumnHeader
              column={column}
              title="Chats"
              showChats={showChats}
            />
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
            <DataTableColumnHeader
              column={column}
              title="Agents Tested"
              showChats={showChats}
            />
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
                agent.toLowerCase().includes(filterAgent.toLowerCase()),
              ),
            );
          },
        },
        // Average score column
        {
          accessorKey: "averageScore",
          header: ({ column }) => (
            <DataTableColumnHeader
              column={column}
              title="Avg Score"
              showChats={showChats}
            />
          ),
          accessorFn: (row: EnhancedAttempt) => {
            const chats = row.chats;
            if (!chats || chats.length === 0) return 0;

            const chatGrades = chats
              .map((chat) =>
                grades?.find((grade) => grade.simulationChatId === chat.id),
              )
              .filter(Boolean);

            if (chatGrades.length === 0) return 0;

            const totalScore = chatGrades.reduce(
              (sum: number, grade) => sum + (grade?.score || 0),
              0,
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
                grades?.find((grade) => grade.simulationChatId === chat.id),
              )
              .filter(Boolean);

            if (chatGrades.length === 0) {
              const completedChats = chats.filter((chat) => chat.completed);
              if (completedChats.length > 0) {
                return (
                  <div className="text-amber-500">Grading in progress</div>
                );
              }
              return <div className="text-muted-foreground">Not graded</div>;
            }

            const totalScore = chatGrades.reduce(
              (sum: number, grade) => sum + (grade?.score || 0),
              0,
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
                <div className="text-xs text-muted-foreground mt-1">
                  {averageScore.toFixed(1)}
                </div>
              </div>
            );
          },
          enableSorting: true,
        },
        // Actions column
        {
          id: "actions",
          cell: ({ row }) => {
            const attempt = row.original;
            const chats = attempt.chats;
            const interactionIds = attempt.interactionIds;

            const totalExpectedChats = interactionIds?.length || 0;
            const completedChats =
              chats?.filter((chat: SimulationChat) => chat.completed).length ||
              0;
            const isAttemptCompleted =
              totalExpectedChats > 0 && completedChats === totalExpectedChats;

            return (
              <DataTableRowActions
                id={attempt.id}
                completed={isAttemptCompleted}
                showChats={showChats}
                isOwnUser={attempt.profileId === profile?.id}
              />
            );
          },
        },
      ];

      return attemptColumns;
    }

    // Original chats view columns
    const baseColumns: ColumnDef<EnhancedChat>[] = [
      // Select column - only show if showExport is true
      ...(showExport
        ? [
            {
              id: "select",
              header: ({ table }: { table: Table<EnhancedChat> }) => (
                <Checkbox
                  checked={
                    table.getIsAllPageRowsSelected() ||
                    (table.getIsSomePageRowsSelected() && "indeterminate")
                  }
                  onCheckedChange={(value: boolean | "indeterminate") =>
                    table.toggleAllPageRowsSelected(!!value)
                  }
                  aria-label="Select all"
                  className="translate-y-[2px] ml-4"
                />
              ),
              cell: ({ row }: { row: Row<EnhancedChat> }) => (
                <Checkbox
                  checked={row.getIsSelected()}
                  onCheckedChange={(value: boolean | "indeterminate") =>
                    row.toggleSelected(!!value)
                  }
                  aria-label="Select row"
                  className="translate-y-[2px] ml-4"
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
          <DataTableColumnHeader
            column={column}
            title="Date"
            showChats={showChats}
          />
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
      // Name column - only show if showAll is true
      ...(showAll
        ? [
            {
              accessorKey: "userId",
              header: ({ column }: any) => (
                <DataTableColumnHeader
                  column={column}
                  title="Name"
                  showChats={showChats}
                />
              ),
              cell: ({ row }: any) => {
                const profileOption = profileOptions.find(
                  (profile) => profile.value === row.getValue("profileId"),
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
      // Title column
      {
        accessorKey: "title",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Title"
            showChats={showChats}
          />
        ),
        cell: ({ row }) => {
          return (
            <div className="flex space-x-2">
              <span className="max-w-[500px] truncate font-medium">
                {row.getValue("title") as string}
              </span>
            </div>
          );
        },
      },
      // Class column
      {
        accessorKey: "classId",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Class"
            showChats={showChats}
          />
        ),
        cell: ({ row }) => {
          const classOption = classOptions.find(
            (cls) => cls.value === row.getValue("classId"),
          );

          if (!classOption) {
            return <span className="text-muted-foreground">No Class</span>;
          }

          return (
            <div className="flex items-center">
              <span>{classOption.label}</span>
            </div>
          );
        },
        filterFn: (row, id, value) => {
          return value.includes(row.getValue(id) as string);
        },
        enableSorting: true,
      },
      // Score column based on grades with individual breakdown
      {
        accessorKey: "score",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Score"
            showChats={showChats}
          />
        ),
        accessorFn: (row: EnhancedChat) => {
          const grades = row.grades;
          return grades.length > 0 ? grades[0].score : 0;
        },
        cell: ({ row, column }) => {
          const chat = row.original;
          const grades = chat.grades;
          const selectedMetrics = (column.getFilterValue() as string[]) || [];

          if (!grades || grades.length === 0) {
            if (chat.completed) {
              return <div className="text-amber-500">Grading in progress</div>;
            }
            return <div className="text-muted-foreground">Not graded</div>;
          }

          const score = grades[0].score;
          const scorePercent = Math.round(score);

          // If no metrics are selected, show the overall score
          if (selectedMetrics.length === 0) {
            return (
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
            );
          }

          // Show individual breakdown for selected metrics
          const chatFeedbacks = chat.feedbacks;
          const selectedScores = selectedMetrics.map((metric) => {
            const standardGroup = validStandardGroups?.find(g => g.shortName === metric);
            if (!standardGroup) return null;
            
            const groupStandards = validStandards?.filter(s => s.standardGroupId === standardGroup.id) || [];
            const groupFeedbacks = chatFeedbacks.filter(f => 
              groupStandards.some(s => s.id === f.standardId)
            );
            
            const totalScore = groupFeedbacks.reduce((sum, f) => sum + f.total, 0);
            const maxScore = groupStandards.reduce((sum, s) => sum + s.points, 0);
            
            return {
              label: metric,
              score: totalScore,
              maxScore: maxScore,
            };
          }).filter(Boolean);

          if (selectedScores.length === 0) {
            return (
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
            );
          }

          const total = selectedScores.reduce((sum, item) => sum + (item?.score || 0), 0);
          const maxPossible = selectedScores.reduce((sum, item) => sum + (item?.maxScore || 0), 0);

          return (
            <div className="flex flex-col gap-1">
              {selectedScores.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-muted-foreground">{item?.label}:</span>
                  <span>{item?.score}/{item?.maxScore}</span>
                </div>
              ))}
              {selectedMetrics.length > 1 && (
                <div className="flex items-center justify-between border-t pt-1 mt-1">
                  <span className="font-medium">Total:</span>
                  <span className="font-medium">
                    {total}/{maxPossible}
                  </span>
                </div>
              )}
            </div>
          );
        },
        filterFn: (row, id, value: string[]) => {
          const chat = row.original;
          const grades = chat.grades;

          // If no grades, exclude from filter
          if (!grades || grades.length === 0) return false;

          // If no metrics selected, include all with grades
          if (value.length === 0) return true;

          // Check if any selected metric has data
          return value.some((metric) => {
            const standardGroup = validStandardGroups?.find(g => g.shortName === metric);
            if (!standardGroup) return false;
            
            const groupStandards = validStandards?.filter(s => s.standardGroupId === standardGroup.id) || [];
            const groupFeedbacks = chat.feedbacks.filter(f => 
              groupStandards.some(s => s.id === f.standardId)
            );
            
            return groupFeedbacks.length > 0;
          });
        },
        enableSorting: true,
      },
      // Actions column
      {
        id: "actions",
        cell: ({ row }) => {
          const chat = row.original;
          return (
            <DataTableRowActions
              id={chat.id}
              completed={chat.completed}
              showChats={showChats}
              isOwnUser={chat.profileId === profile?.id}
            />
          );
        },
      },
    ];

    return baseColumns;
  }, [profileOptions, classOptions, showChats, showAll, showExport, grades, validStandardGroups, validStandards, user]);

  // Determine which data to return based on view mode
  // showChats=true means show individual chats, showChats=false means show attempts/simulations
  let data: unknown[] = showChats
    ? enhancedChats || []
    : enhancedAttempts || [];

  // Apply filtering based on showAll parameter
  if (!showAll && user) {
    // If showAll is false, filter to show only current user's data
    if (showChats) {
      // Filter chats to only show those belonging to the current user
      data = data.filter(
        (chat: unknown) => (chat as Record<string, unknown>).userId === user.id,
      );
    } else {
      // Filter attempts to only show those belonging to the current user
      data = data.filter(
        (attempt: unknown) =>
          (attempt as Record<string, unknown>).userId === user.id,
      );
    }
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
    isLoadingClasses;

  return {
    columns,
    isLoading,
    data: data,
    profileOptions,
    classOptions,
    agentTypes,
    skillCategories,
    scoreOptions,
    showChats,
    showAll,
  };
}
