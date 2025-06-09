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
import { useAuth } from "@/hooks/use-auth";
import { getAllUsers } from "@/utils/queries/users/get-all-users";
import { getAllClasses } from "@/utils/queries/classes/get-all-classes";
import { getAllAgents } from "@/utils/queries/agents/get-all-agents";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getStandardGroupsByRubrics } from "@/utils/queries/standard_groups/get-standard-groups-by-rubrics";
import { getStandardsByStandardGroups } from "@/utils/queries/standards/get-standards-by-standardgroups";
import { getSimulationAttemptsByUsers } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-users";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatFeedbacksBySimulationChatGrades } from "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades";
import { 
  Agent, 
  Class, 
  User, 
  SimulationChat, 
  SimulationAttempt, 
  SimulationChatGrade,
  SimulationChatFeedback,
  Standard,
  StandardGroup
} from "@/types";

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
}

// Component to use the columns with data from queries
export function useColumns({
  showChats = false,
  showAll = false,
}: { showChats?: boolean, showAll?: boolean }) {
  const { userId } = useAuth();

  const { data: users, isLoading: isLoadingUsers } = useQuery({
    queryKey: ["users"],
    queryFn: () => getAllUsers(),
  });

  const { data: classes, isLoading: isLoadingClasses } = useQuery({
    queryKey: ["classes"],
    queryFn: () => getAllClasses(),
  });

  const { data: agents, isLoading: isLoadingAgents } = useQuery({
    queryKey: ["agents"],
    queryFn: () => getAllAgents(),
  });

  const {data: rubrics, isLoading: isLoadingRubrics} = useQuery({
    queryKey: ["rubrics"],
    queryFn: () => getAllRubrics(),
  });

  const {data: standardGroups, isLoading: isLoadingStandardGroups} = useQuery({
    queryKey: ["standardGroups", rubrics?.map((rubric) => rubric.id)],
    queryFn: () => getStandardGroupsByRubrics(rubrics!.map((rubric) => rubric.id)),
    enabled: !!rubrics && rubrics.length > 0,
  });

  const {data: standards, isLoading: isLoadingStandards} = useQuery({
    queryKey: ["standards", standardGroups?.map((group) => group.id)],
    queryFn: () => getStandardsByStandardGroups(standardGroups!.map((group) => group.id)),
    enabled: !!standardGroups && standardGroups.length > 0,
  });

  const {data: attempts, isLoading: isLoadingAttempts} = useQuery({
    queryKey: ["simulationAttempts", users?.map((user) => user.id)],
    queryFn: () => getSimulationAttemptsByUsers(users!.map((user) => user.id)),
    enabled: !!users && users.length > 0,
  });

  const { data: chats, isLoading: isLoadingChats } = useQuery({
    queryKey: ["simulationChats", attempts?.map((attempt) => attempt.id)],
    queryFn: () => getSimulationChatsByAttempts(attempts!.map((attempt) => attempt.id)),
    enabled: !!attempts && attempts.length > 0,
  });

  const {data: grades, isLoading: isLoadingGrades} = useQuery({
    queryKey: ["simulationGrades", chats?.map((chat) => chat.id)],
    queryFn: () => getSimulationChatGradesBySimulationChats(chats!.map((chat) => chat.id)),
    enabled: !!chats && chats.length > 0,
  });

  const {data: feedbacks, isLoading: isLoadingFeedbacks} = useQuery({
    queryKey: ["simulationFeedbacks", grades?.map((grade) => grade.id)],
    queryFn: () => getSimulationChatFeedbacksBySimulationChatGrades(grades!.map((grade) => grade.id)),
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
  const userOptions = useMemo(() => {
    if (!users) return [];
    return users.map((user: User) => ({
      value: user.id,
      label: user.name,
      icon: null,
    }));
  }, [users]);

  // Create class options
  const classOptions = useMemo(() => {
    if (!classes) return [];
    return classes.map((cls: Class) => ({
      value: cls.id,
      label: cls.classCode,
      icon: null,
    }));
  }, [classes]);

  // Create enhanced attempts data
  const enhancedAttempts = useMemo(() => {
    if (!attempts || !chats || !agents) return [];
    
    return attempts.map((attempt: SimulationAttempt): EnhancedAttempt => {
      const attemptChats = chats.filter(chat => chat.attemptId === attempt.id);
      const agentsTested = [...new Set(attemptChats.map(chat => {
        // Find the agent name from the scenario
        const agent = agents.find(a => a.id === chat.scenarioId);
        return agent?.name || 'Unknown';
      }))];

      return {
        ...attempt,
        chats: attemptChats,
        agentsTested,
        simulationTitle: `Simulation ${attempt.simulationId}`,
        interactionIds: [], // This would come from simulation data if available
      };
    });
  }, [attempts, chats, agents]);

  // Create enhanced chats data
  const enhancedChats = useMemo(() => {
    if (!chats || !grades || !feedbacks) return [];
    
    return chats.map((chat: SimulationChat): EnhancedChat => {
      const chatGrades = grades.filter(grade => grade.simulationChatId === chat.id);
      const chatFeedbacks = feedbacks.filter(feedback => 
        chatGrades.some(grade => grade.id === feedback.simulationChatGradeId)
      );

      return {
        ...chat,
        grades: chatGrades,
        feedbacks: chatFeedbacks,
      };
    });
  }, [chats, grades, feedbacks]);

  // Create skill categories from standard groups for scoring
  const skillCategories = useMemo(() => {
    if (!standardGroups || !standards || !feedbacks) return {};
    
    const categories: Record<string, number> = {};
    
    standardGroups.forEach(group => {
      const groupStandards = standards.filter(s => s.standardGroupId === group.id);
      const groupFeedbacks = feedbacks.filter(f => 
        groupStandards.some(s => s.id === f.standardId)
      );
      
      if (groupFeedbacks.length > 0) {
        const avgScore = groupFeedbacks.reduce((sum, f) => sum + f.total, 0) / groupFeedbacks.length;
        const maxPoints = groupStandards[0]?.points || 5;
        categories[group.name] = Math.round((avgScore / maxPoints) * 100);
      }
    });
    
    return categories;
  }, [standardGroups, standards, feedbacks]);

  // Define columns
  const columns = useMemo(() => {
    if (showChats) {
      // Attempts view columns
      const attemptColumns: ColumnDef<EnhancedAttempt>[] = [
        // Select column
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
              onCheckedChange={(value: boolean | "indeterminate") => row.toggleSelected(!!value)}
              aria-label="Select row"
              className="translate-y-[2px]"
            />
          ),
          enableSorting: false,
          enableHiding: false,
        },
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
            const day = dateObj.getDate().toString().padStart(2, '0');
            const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
            const year = dateObj.getFullYear().toString().slice(-2);
            const time = dateObj.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            });

            return (
              <div className="font-medium text-sm">
                <div>{month}-{day}-{year}</div>
                <div className="text-xs text-muted-foreground">
                  {time}
                </div>
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
        ...(showAll ? [{
          accessorKey: "userId",
          header: ({ column }: any) => (
            <DataTableColumnHeader
              column={column}
              title="Name"
              showChats={showChats}
            />
          ),
          cell: ({ row }: any) => {
            const userOption = userOptions.find(
              (user) => user.value === row.getValue("userId"),
            );

            if (!userOption) {
              return <span className="text-muted-foreground">Unknown User</span>;
            }

            return (
              <div className="flex items-center">
                <span>{userOption.label}</span>
              </div>
            );
          },
          filterFn: (row: any, id: any, value: any) => {
            return value.includes(row.getValue(id) as string);
          },
          enableSorting: true,
        }] : []),
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
            
            const completedChats = chats?.filter(chat => chat.completed).length || 0;
            const totalChats = interactionIds?.length || chats?.length || 0;
            
            return (
              <div className="text-center">
                <span className="font-medium">{completedChats}/{totalChats}</span>
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
                  const badgeColorClass = agentName.toLowerCase() === 'aggressive' 
                    ? 'bg-red-100 text-red-800 border-red-300'
                    : agentName.toLowerCase() === 'happy'
                    ? 'bg-green-100 text-green-800 border-green-300'
                    : agentName.toLowerCase() === 'confused'
                    ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                    : 'bg-gray-100 text-gray-800 border-gray-300';
                  
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
              agentsTested?.some(agent => agent.toLowerCase().includes(filterAgent.toLowerCase()))
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
              .map(chat => grades?.find(grade => grade.simulationChatId === chat.id))
              .filter(Boolean);
            
            if (chatGrades.length === 0) return 0;
            
            const totalScore = chatGrades.reduce((sum: number, grade) => sum + (grade?.score || 0), 0);
            return totalScore / chatGrades.length;
          },
          cell: ({ row }) => {
            const chats = row.getValue("chats") as SimulationChat[];
            if (!chats || chats.length === 0) {
              return <div className="text-muted-foreground">No chats</div>;
            }
            
            const chatGrades = chats
              .map((chat: SimulationChat) => grades?.find(grade => grade.simulationChatId === chat.id))
              .filter(Boolean);
            
            if (chatGrades.length === 0) {
              const completedChats = chats.filter(chat => chat.completed);
              if (completedChats.length > 0) {
                return <div className="text-amber-500">Grading in progress</div>;
              }
              return <div className="text-muted-foreground">Not graded</div>;
            }
            
            const totalScore = chatGrades.reduce((sum: number, grade) => sum + (grade?.score || 0), 0);
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
            const completedChats = chats?.filter((chat: SimulationChat) => chat.completed).length || 0;
            const isAttemptCompleted = totalExpectedChats > 0 && completedChats === totalExpectedChats;
            
            return (
              <DataTableRowActions 
                id={attempt.id} 
                completed={isAttemptCompleted} 
                showChats={showChats} 
              />
            );
          },
        },
      ];

      return attemptColumns;
    }

    // Original chats view columns
    const baseColumns: ColumnDef<EnhancedChat>[] = [
      // Select column
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
            className="translate-y-[2px]"
          />
        ),
        cell: ({ row }: { row: Row<EnhancedChat> }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value: boolean | "indeterminate") => row.toggleSelected(!!value)}
            aria-label="Select row"
            className="translate-y-[2px]"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
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
          const day = dateObj.getDate().toString().padStart(2, '0');
          const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
          const year = dateObj.getFullYear().toString().slice(-2);
          const time = dateObj.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });

          return (
            <div className="font-medium text-sm">
              <div>{month}-{day}-{year}</div>
              <div className="text-xs text-muted-foreground">
                {time}
              </div>
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
      ...(showAll ? [{
        accessorKey: "userId",
        header: ({ column }: any) => (
          <DataTableColumnHeader
            column={column}
            title="Name"
            showChats={showChats}
          />
        ),
        cell: ({ row }: any) => {
          const userOption = userOptions.find(
            (user) => user.value === row.getValue("userId"),
          );

          if (!userOption) {
            return <span className="text-muted-foreground">Unknown User</span>;
          }

          return (
            <div className="flex items-center">
              <span>{userOption.label}</span>
            </div>
          );
        },
        filterFn: (row: any, id: any, value: any) => {
          return value.includes(row.getValue(id) as string);
        },
        enableSorting: true,
      }] : []),
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
      // Score column based on grades
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
        cell: ({ row }) => {
          const chat = row.original;
          const grades = chat.grades;

          if (!grades || grades.length === 0) {
            if (chat.completed) {
              return <div className="text-amber-500">Grading in progress</div>;
            }
            return <div className="text-muted-foreground">Not graded</div>;
          }

          const score = grades[0].score;
          const scorePercent = Math.round(score);

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
        },
        enableSorting: true,
      },
      // Actions column
      {
        id: "actions",
        cell: ({ row }) => {
          const chat = row.original;
          return <DataTableRowActions id={chat.id} completed={chat.completed} showChats={showChats} />;
        },
      },
    ];

    return baseColumns;
  }, [userOptions, classOptions, showChats, showAll, grades]);

  // Determine which data to return based on view mode
  let data: unknown[] = showChats ? (enhancedAttempts || []) : (enhancedChats || []);
  
  // Get current user data
  const currentUser = users?.find(u => u.id === userId);
  
  // Apply filtering based on showAll parameter
  if (!showAll && userId) {
    // If showAll is false, filter to show only current user's data
    if (showChats) {
      // Filter attempts to only show those belonging to the current user
      data = data.filter((attempt: unknown) => (attempt as Record<string, unknown>).userId === userId);
    } else {
      // Filter chats to only show those belonging to the current user
      data = data.filter((chat: unknown) => (chat as Record<string, unknown>).userId === userId);
    }
  } else if (!userId) {
    // If there's no user, show empty data
    data = [];
  }
  // If showAll is true, don't filter - show all data

  const isLoading = isLoadingUsers || isLoadingAttempts || isLoadingAgents || isLoadingChats || 
                   isLoadingRubrics || isLoadingStandardGroups || isLoadingStandards || 
                   isLoadingGrades || isLoadingFeedbacks || isLoadingClasses;

  return {
    columns,
    isLoading,
    data: data,
    userOptions,
    classOptions,
    agentTypes,
    skillCategories,
    showChats,
    showAll,
  };
}
