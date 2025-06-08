"use client";
import React from "react";
import { ColumnDef, Row, Table } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTableColumnHeader } from "@/components/common/history/data-table-column-header";
import { DataTableRowActions } from "@/components/common/history/data-table-row-actions";
import { useQuery } from "@tanstack/react-query";
import { getChats } from "@/utils/queries/get-chats";
import { getAllChats } from "@/utils/queries/get-all-chats";
import { getUsers } from "@/utils/queries/get-users";
import { getClasses } from "@/utils/queries/get-classes";
import { getAgents } from "@/utils/queries/get-agents";
import { useMemo } from "react";
import { getUser } from "@/utils/queries/get-user";
import { getRubrics } from "@/utils/queries/get-rubrics";
import { Badge } from "../../ui/badge";
import { getAgentConfig } from "@/utils/agents";
import { getEnhancedAttempts, getEnhancedAttemptsByUser } from "@/utils/queries/get-enhanced-attempts";
import { getAttemptChats } from "@/utils/queries/get-attempt-chats";
import { classes as Classes, attempts as Attempts, chats as Chats, rubrics as Rubrics, agents as Agents, users as Users } from "@/drizzle/schema";

// Use Drizzle schema types
type User = typeof Users.$inferSelect;
type Class = typeof Classes.$inferSelect;
type Agent = typeof Agents.$inferSelect;
type Chat = typeof Chats.$inferSelect;
type Rubric = typeof Rubrics.$inferSelect;
type Attempt = typeof Attempts.$inferSelect;

// Enhanced attempt type (from the query results)
interface EnhancedAttempt extends Attempt {
  chats: Chat[];
  agentsTested: string[];
  simulationTitle?: string | null;
  classCode?: string | null;
  interactionIds?: string[] | null;
}

// Define score metrics
export const scoreMetrics = [
  { value: "adaptability", label: "Adaptability", max: 5 },
  { value: "listening", label: "Listening", max: 5 },
  { value: "objectives", label: "Objectives", max: 5 },
  { value: "timeManagement", label: "Time Management", max: 5 },
];

// Component to use the columns with data from queries
export function useTaskColumns({
  isAdmin = false,
  viewMode = 'chats',
  effectiveRole = 'student',
}: { isAdmin?: boolean; viewMode?: 'chats' | 'attempts'; effectiveRole?: 'student' | 'guest' | 'ta' } = {}) {
  const { data: user, isLoading: _userLoading } = useQuery({
    queryKey: ["user"],
    queryFn: () => getUser(),
  });

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => getUsers(),
  });

  const { data: classes, isLoading: classesLoading } = useQuery({
    queryKey: ["classes"],
    queryFn: () => getClasses(),
  });

  // Fetch profiles dynamically
  const { data: agents, isLoading: agentsLoading } = useQuery({
    queryKey: ["agents"],
    queryFn: () => getAgents(),
  });

  // Use getAllChats if isAdmin, otherwise use getChats with user id (for chats view)
  const { data: chats, isLoading: chatsLoading, error: _chatsError } = useQuery({
    queryKey: isAdmin ? ["all-chats"] : ["chats", user?.id],
    queryFn: () => {
      return isAdmin ? getAllChats() : getChats(user?.id || '');
    },
    enabled: viewMode === 'chats',
    retry: 1,
  });

  // Fetch enhanced attempts data (for attempts view)
  const { data: enhancedAttempts, isLoading: attemptsLoading } = useQuery({
    queryKey: isAdmin ? ["enhanced-attempts"] : ["enhanced-attempts", user?.id],
    queryFn: () => {
      if (isAdmin) {
        return getEnhancedAttempts();
      } else {
        return getEnhancedAttemptsByUser(user?.id || '');
      }
    },
    enabled: viewMode === 'attempts' && (isAdmin || !!user?.id),
  });

  // Fetch all chats for attempts to get rubrics
  const attemptIds = enhancedAttempts?.map(attempt => attempt.id) || [];
  const { data: allAttemptChats, isLoading: attemptChatsLoading } = useQuery({
    queryKey: ["attempt-chats", attemptIds],
    queryFn: () => getAttemptChats(attemptIds),
    enabled: viewMode === 'attempts' && attemptIds.length > 0,
  });

  // Fetch rubrics for attempt chats
  const chatIds = allAttemptChats?.map(chat => chat.id) || [];
  const { data: attemptRubrics, isLoading: attemptRubricsLoading } = useQuery({
    queryKey: ["attempt-rubrics", chatIds],
    queryFn: () => getRubrics(chatIds),
    enabled: viewMode === 'attempts' && chatIds.length > 0,
  });

  const { data: rubrics, isLoading: rubricsLoading } = useQuery({
    queryKey: isAdmin
      ? ["all-rubrics"]
      : ["rubrics", chats?.map((chat) => chat.id)],
    queryFn: () => getRubrics(chats!.map((chat) => chat.id)),
    enabled: !!chats && chats.length > 0 && viewMode === 'chats',
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

  // Create class options for attempts (uses classCode as value since attempts data has classCode directly)
  const attemptClassOptions = useMemo(() => {
    if (!classes) return [];
    return classes.map((cls: Class) => ({
      value: cls.classCode,
      label: cls.classCode,
      icon: null,
    }));
  }, [classes]);

  // Create a map of chat IDs to their full rubric data for efficient lookup
  const chatRubrics = useMemo(() => {
    if (!rubrics) return new Map();
    return new Map(rubrics.map((rubric: Rubric) => [rubric.chatId, rubric]));
  }, [rubrics]);

  // Create a map of attempt rubrics for attempts view
  const attemptRubricsByChat = useMemo(() => {
    if (!attemptRubrics) return new Map();
    return new Map(attemptRubrics.map((rubric: Rubric) => [rubric.chatId, rubric]));
  }, [attemptRubrics]);

  // Define columns
  const columns = useMemo(() => {
    if (viewMode === 'attempts') {
      // Attempts view columns
      const attemptColumns: ColumnDef<EnhancedAttempt>[] = [
        // Select column only shows in admin mode
        ...(isAdmin ? [{
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
        }] : []),
        // Date column
        {
          accessorKey: "createdAt",
          header: ({ column }) => (
            <DataTableColumnHeader
              column={column}
              title="Date"
              isAdmin={isAdmin}
            />
          ),
          cell: ({ row }) => {
            const date = row.getValue("createdAt");
            if (!date) return null;

            const dateObj = new Date(date as string);
            // Use compact DD-MM-YY format
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
        // User Name column for attempts
        {
          accessorKey: "userId",
          header: ({ column }) => (
            <DataTableColumnHeader
              column={column}
              title="Name"
              isAdmin={isAdmin}
            />
          ),
          cell: ({ row }) => {
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
          filterFn: (row, id, value) => {
            return value.includes(row.getValue(id) as string);
          },
          enableSorting: true,
        },
        // Simulation Title column
        {
          accessorKey: "simulationTitle",
          header: ({ column }) => (
            <DataTableColumnHeader
              column={column}
              title="Simulation"
              isAdmin={isAdmin}
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
        // Class column with proper sorting
        {
          accessorKey: "classCode",
          header: ({ column }) => (
            <DataTableColumnHeader
              column={column}
              title="Class"
              isAdmin={isAdmin}
            />
          ),
          cell: ({ row }) => {
            const classCode = row.getValue("classCode");
            return classCode ? (
              <div className="flex items-center">
                <span>{classCode as string}</span>
              </div>
            ) : <span className="text-muted-foreground">No Class</span>;
          },
          filterFn: (row, id, value) => {
            return value.includes(row.getValue(id) as string);
          },
          enableSorting: true,
          sortingFn: (rowA, rowB, columnId) => {
            const valueA = rowA.getValue(columnId) as string;
            const valueB = rowB.getValue(columnId) as string;
            
            // Handle null/undefined values
            if (!valueA && !valueB) return 0;
            if (!valueA) return 1;
            if (!valueB) return -1;
            
            return valueA.localeCompare(valueB);
          },
        },
        // Chats completion column
        {
          accessorKey: "chats",
          header: ({ column }) => (
            <DataTableColumnHeader
              column={column}
              title="Chats"
              isAdmin={isAdmin}
            />
          ),
          cell: ({ row }) => {
            const chats = row.getValue("chats") as Chat[];
            const interactionIds = row.original.interactionIds;
            
            const completedChats = chats?.filter(chat => chat.completed).length || 0;
            // Use simulation's interactionIds length for total expected chats
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
        // Profiles tested column
        {
          accessorKey: "agentsTested",
          header: ({ column }) => (
            <DataTableColumnHeader
              column={column}
              title="Agents Tested"
              isAdmin={isAdmin}
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
                  // Create badge color classes based on profile colors
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
              isAdmin={isAdmin}
            />
          ),
          accessorFn: (row: EnhancedAttempt) => {
            const chats = row.chats;
            if (!chats || chats.length === 0) return 0;
            
            const chatRubrics = chats
              .map(chat => attemptRubricsByChat.get(chat.id))
              .filter(Boolean);
            
            if (chatRubrics.length === 0) return 0;
            
            const totalScore = chatRubrics.reduce((sum, rubric) => sum + (rubric?.score || 0), 0);
            return totalScore / chatRubrics.length;
          },
          cell: ({ row }) => {
            const chats = row.getValue("chats") as Chat[];
            if (!chats || chats.length === 0) {
              return <div className="text-muted-foreground">No chats</div>;
            }
            
            const chatRubrics = chats
              .map((chat: Chat) => attemptRubricsByChat.get(chat.id))
              .filter(Boolean);
            
            if (chatRubrics.length === 0) {
              const completedChats = chats.filter(chat => chat.completed);
              if (completedChats.length > 0) {
                return <div className="text-amber-500">Grading in progress</div>;
              }
              return <div className="text-muted-foreground">Not graded</div>;
            }
            
            const totalScore = chatRubrics.reduce((sum: number, rubric: Rubric) => sum + (rubric?.score || 0), 0);
            const averageScore = totalScore / chatRubrics.length;
            const scorePercent = (averageScore / 20) * 100;
            
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
                  {Math.round(scorePercent)}%
                </Badge>
                <div className="text-xs text-muted-foreground mt-1">
                  {averageScore.toFixed(1)}/20
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
            
            // An attempt is completed if all expected chats are completed
            const totalExpectedChats = interactionIds?.length || 0;
            const completedChats = chats?.filter(chat => chat.completed).length || 0;
            const isAttemptCompleted = totalExpectedChats > 0 && completedChats === totalExpectedChats;
            
            return (
              <DataTableRowActions 
                id={attempt.id} 
                completed={isAttemptCompleted} 
                isAdmin={isAdmin} 
                viewMode={viewMode} 
              />
            );
          },
        },
      ];

      return attemptColumns;
    }

    // Original chats view columns
    const baseColumns: ColumnDef<Chat>[] = [
      // Select column only shows in admin mode
      ...(isAdmin ? [{
        id: "select",
        header: ({ table }: { table: Table<Chat> }) => (
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
        cell: ({ row }: { row: Row<Chat> }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value: boolean | "indeterminate") => row.toggleSelected(!!value)}
            aria-label="Select row"
            className="translate-y-[2px]"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      }] : []),
      // Date column - first column after select
      {
        accessorKey: "createdAt",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Date"
            isAdmin={isAdmin}
          />
        ),
        cell: ({ row }) => {
          const date = row.getValue("createdAt");
          if (!date) return null;

          // Format the date with compact format
          const dateObj = new Date(date as string);

          // Use compact MM-DD-YY format
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
      // Name column - show for all users in chat mode
      {
        accessorKey: "userId",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Name"
            isAdmin={isAdmin}
          />
        ),
        cell: ({ row }) => {
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
        filterFn: (row, id, value) => {
          return value.includes(row.getValue(id) as string);
        },
        enableSorting: true,
      },
      {
        accessorKey: "title",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Title"
            isAdmin={isAdmin}
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
      // Class column - show for all users in chat mode
      {
        accessorKey: "classId",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Class"
            isAdmin={isAdmin}
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
      // Score column
      {
        accessorKey: "score",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Score"
            isAdmin={isAdmin}
          />
        ),
        accessorFn: (row: Chat) => {
          const chatId = row.id;
          const rubric = chatRubrics.get(chatId);
          // Return 0 for chats without scores so they appear at top when sorting
          return rubric ? rubric.score : 0;
        },
        cell: ({ row, column }) => {
          const chat = row.original;
          const chatId = chat.id;
          const rubric = chatRubrics.get(chatId);
          const selectedMetrics = (column.getFilterValue() as string[]) || [];

          // If there's no rubric, show "Not graded"
          if (!rubric) {
            return <div className="text-muted-foreground">Not graded</div>;
          }

          // If the chat is completed but not yet graded, show "Grading in progress"
          if (chat.completed && !rubric) {
            return <div className="text-amber-500">Grading in progress</div>;
          }

          // If no metrics are selected, show the overall score out of 20
          if (selectedMetrics.length === 0) {
            const scorePercent = (rubric.score / 20) * 100;
            return (
              <Badge
                variant="outline"
                className={`text-xs font-semibold ${scorePercent >= 80 ? "bg-green-100 text-green-800 border-green-300 hover:bg-green-200" : scorePercent >= 70 ? "bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200" : "bg-red-100 text-red-800 border-red-300 hover:bg-red-200"}`}
              >
                {Math.round(scorePercent)}%
              </Badge>
            );
          }

          // Calculate total for selected metrics
          const selectedScores = selectedMetrics.map((metric) => ({
            label:
              scoreMetrics.find((m) => m.value === metric)?.label || metric,
            score: rubric[metric as keyof Rubric] as number,
          }));

          const total = selectedScores.reduce(
            (sum, item) => sum + item.score,
            0,
          );
          const maxPossible = selectedMetrics.length * 5;

          return (
            <div className="flex flex-col gap-1">
              {selectedScores.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-muted-foreground">{item.label}:</span>
                  <span>{item.score}/5</span>
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
          const chatId = chat.id;
          const rubric = chatRubrics.get(chatId);

          // If no rubric, exclude from filter
          if (!rubric) return false;

          // If no metrics selected, include all with rubrics
          if (value.length === 0) return true;

          // Check if any selected metric matches the filter value
          return value.some((metric) => {
            const score = rubric[metric as keyof Rubric] as number;
            return score !== undefined;
          });
        },
        sortingFn: (rowA, rowB, columnId) => {
          const scoreA = rowA.getValue(columnId) as number;
          const scoreB = rowB.getValue(columnId) as number;

          // Handle non-graded chats (-1 value)
          if (scoreA === -1 && scoreB === -1) return 0;
          if (scoreA === -1) return 1; // Move non-graded to bottom
          if (scoreB === -1) return -1;

          return scoreA - scoreB;
        },
      },
      {
        id: "actions",
        cell: ({ row }) => {
          const chat = row.original;
          return <DataTableRowActions id={chat.id} completed={chat.completed} isAdmin={isAdmin} viewMode={viewMode} />;
        },
      },
    ];

    return baseColumns;
  }, [userOptions, classOptions, chatRubrics, attemptRubricsByChat, isAdmin, viewMode]);

  // Determine which data to return based on view mode and apply additional filtering for TAs
  let data: unknown[] = viewMode === 'attempts' ? (enhancedAttempts || []) : (chats || []);
  
  // Apply additional filtering for TAs and non-admin users
  if (!isAdmin && effectiveRole === 'ta' && user?.id) {
    if (viewMode === 'chats') {
      // Filter chats to only show those belonging to the current user
      data = data.filter((chat: unknown) => (chat as Record<string, unknown>).userId === user.id);
    } else if (viewMode === 'attempts') {
      // Filter attempts to only show those belonging to the current user
      data = data.filter((attempt: unknown) => (attempt as Record<string, unknown>).userId === user.id);
    }
  } else if (!isAdmin && !user?.id) {
    // If there's no user and not admin, show empty data
    data = [];
  }

  const isLoading = viewMode === 'attempts' 
    ? (usersLoading || classesLoading || attemptsLoading || agentsLoading || attemptChatsLoading || attemptRubricsLoading)
    : (usersLoading || classesLoading || chatsLoading || rubricsLoading || agentsLoading);

  return {
    columns,
    isLoading,
    data: data,
    userOptions,
    classOptions: viewMode === 'attempts' ? attemptClassOptions : classOptions,
    agentTypes, // Export dynamic agent types
    isAdmin,
  };
}
