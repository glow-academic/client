"use client";
import React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTableColumnHeader } from "@/components/tasks/data-table-column-header";
import { DataTableRowActions } from "@/components/tasks/data-table-row-actions";
import { chats as chatsTable } from "@/drizzle/schema";
import { useQuery } from "@tanstack/react-query";
import { getChats } from "@/utils/queries/get-chats";
import { getAllChats } from "@/utils/queries/get-all-chats";
import { getUsers } from "@/utils/queries/get-users";
import { getClasses } from "@/utils/queries/get-classes";
import { getProfiles } from "@/utils/queries/get-profiles";
import { useMemo } from "react";
import { Check, Clock, Circle } from "lucide-react";
import { getUser } from "@/utils/queries/get-user";
import { getRubrics } from "@/utils/queries/get-rubrics";
import { Badge } from "../ui/badge";
import { getProfileConfig } from "@/utils/profiles";

// Define statuses with proper icon components
export const statuses = [
  { value: "completed", label: "Completed", icon: Check },
  { value: "grading", label: "Grading", icon: Clock },
  { value: "in-progress", label: "In Progress", icon: Circle },
];

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
}: { isAdmin?: boolean } = {}) {
  const { data: user, isLoading: userLoading } = useQuery({
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
  const { data: profiles, isLoading: profilesLoading } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getProfiles(),
  });

  // Use getAllChats if isAdmin, otherwise use getChats with user id
  const { data: chats, isLoading: chatsLoading } = useQuery({
    queryKey: isAdmin ? ["all-chats"] : ["chats", user?.id],
    queryFn: () => (isAdmin ? getAllChats() : getChats(user!.id)),
    enabled: isAdmin || !!user,
  });

  const { data: rubrics, isLoading: rubricsLoading } = useQuery({
    queryKey: isAdmin
      ? ["all-rubrics"]
      : ["rubrics", chats?.map((chat) => chat.id)],
    queryFn: () => getRubrics(chats!.map((chat) => chat.id)),
    enabled: !!chats && chats.length > 0,
  });

  // Create dynamic profile types from database profiles
  const profileTypes = useMemo(() => {
    if (!profiles) return [];
    return profiles.map((profile) => ({
      value: profile.id,
      label: profile.name,
      icon: getProfileConfig(profile.name).icon,
    }));
  }, [profiles]);

  // Create user options for GTA names
  const userOptions = useMemo(() => {
    if (!users) return [];
    return users.map((user) => ({
      value: user.id,
      label: user.name,
      icon: null,
    }));
  }, [users]);

  // Create class options
  const classOptions = useMemo(() => {
    if (!classes) return [];
    return classes.map((cls) => ({
      value: cls.id,
      label: cls.classCode,
      icon: null,
    }));
  }, [classes]);

  // Create a map of chat IDs to their rubric scores for efficient lookup
  const chatScores = useMemo(() => {
    if (!rubrics) return new Map();
    return new Map(rubrics.map((rubric) => [rubric.chatId, rubric.score]));
  }, [rubrics]);

  // Create a map of chat IDs to their rubric completion status
  const chatRubricStatus = useMemo(() => {
    if (!rubrics) return new Map();
    return new Map(rubrics.map((rubric) => [rubric.chatId, true]));
  }, [rubrics]);

  // Create a map of chat IDs to their full rubric data for efficient lookup
  const chatRubrics = useMemo(() => {
    if (!rubrics) return new Map();
    return new Map(rubrics.map((rubric) => [rubric.chatId, rubric]));
  }, [rubrics]);

  // Define columns
  const columns = useMemo<ColumnDef<typeof chatsTable.$inferSelect>[]>(() => {
    const baseColumns: ColumnDef<typeof chatsTable.$inferSelect>[] = [
      // Select column only shows in admin mode
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(!!value)
            }
            aria-label="Select all"
            className="translate-y-[2px]"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
            className="translate-y-[2px]"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
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

          // Format the date with more detailed time information
          const dateObj = new Date(date as string);

          // Format date as "Jan 01, 2023 - 14:30:45"
          const formattedDate = dateObj.toLocaleDateString("en-US", {
            month: "short",
            day: "2-digit",
            year: "numeric",
          });

          const formattedTime = dateObj.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          });

          return (
            <div className="font-medium">
              <div>{formattedDate}</div>
              <div className="text-xs text-muted-foreground">
                {formattedTime}
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
      {
        accessorKey: "profile",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Profile"
            isAdmin={isAdmin}
          />
        ),
        cell: ({ row }) => {
          const profileId = row.getValue("profile") as string;
          const profile = profiles?.find((p) => p.id === profileId);

          return (
            <div className="w-[100px]">
              {profile ? profile.name : profileId}
            </div>
          );
        },
        filterFn: (row, id, value) => {
          return value.includes(row.getValue(id));
        },
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
                {row.getValue("title")}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Status"
            isAdmin={isAdmin}
          />
        ),
        cell: ({ row }) => {
          const chatId = row.original.id;
          const completed = row.original.completed;
          const hasRubric = chatRubricStatus.get(chatId);

          let status;
          if (hasRubric) {
            status = statuses.find((s) => s.value === "completed");
          } else if (completed) {
            status = statuses.find((s) => s.value === "grading");
          } else {
            status = statuses.find((s) => s.value === "in-progress");
          }

          if (!status) {
            return null;
          }

          return (
            <div className="flex items-center">
              {status.icon &&
                React.createElement(status.icon, {
                  className: "mr-2 h-4 w-4 text-muted-foreground",
                })}
              <span>{status.label}</span>
            </div>
          );
        },
        filterFn: (row, id, value) => {
          const chatId = row.original.id;
          const completed = row.original.completed;
          const hasRubric = chatRubricStatus.get(chatId);

          let statusValue;
          if (hasRubric) {
            statusValue = "completed";
          } else if (completed) {
            statusValue = "grading";
          } else {
            statusValue = "in-progress";
          }

          return value.includes(statusValue);
        },
      },
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
            return null;
          }

          return (
            <div className="flex items-center">
              {classOption.icon &&
                React.createElement(classOption.icon, {
                  className: "mr-2 h-4 w-4 text-muted-foreground",
                })}
              <span>{classOption.label}</span>
            </div>
          );
        },
        filterFn: (row, id, value) => {
          return value.includes(row.getValue(id));
        },
      },
      {
        accessorKey: "score",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Score"
            isAdmin={isAdmin}
          />
        ),
        accessorFn: (row) => {
          const chatId = row.id;
          const rubric = chatRubrics.get(chatId);
          // Return 0 for chats without scores so they appear at top when sorting
          return rubric ? rubric.score : 0;
        },
        cell: ({ row, column }) => {
          const chatId = row.original.id;
          const rubric = chatRubrics.get(chatId);
          const selectedMetrics = (column.getFilterValue() as string[]) || [];

          // If there's no rubric, show "Not graded"
          if (!rubric) {
            return <div className="text-muted-foreground">Not graded</div>;
          }

          // If the chat is completed but not yet graded, show "Grading in progress"
          if (row.original.completed && !rubric) {
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
            score: rubric[metric as keyof typeof rubric] as number,
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
          const chatId = row.original.id;
          const rubric = chatRubrics.get(chatId);

          // If no rubric, exclude from filter
          if (!rubric) return false;

          // If no metrics selected, include all with rubrics
          if (value.length === 0) return true;

          // Check if any selected metric matches the filter value
          return value.some((metric) => {
            const score = rubric[metric as keyof typeof rubric] as number;
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
        cell: ({ row }) => <DataTableRowActions row={row} isAdmin={isAdmin} />,
      },
    ];

    // Filter out select column if not in admin mode
    if (!isAdmin) {
      return baseColumns.filter((col) => col.id !== "select");
    }

    // Add the name column only for admin view
    if (isAdmin) {
      baseColumns.splice(3, 0, {
        accessorKey: "userId",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Name"
            isAdmin={isAdmin}
          />
        ),
        cell: ({ row }) => {
          const gta_name = userOptions.find(
            (user) => user.value === row.getValue("userId"),
          );

          if (!gta_name) {
            return null;
          }

          return (
            <div className="flex w-[100px] items-center">
              {gta_name.icon &&
                React.createElement(gta_name.icon, {
                  className: "mr-2 h-4 w-4 text-muted-foreground",
                })}
              <span>{gta_name.label}</span>
            </div>
          );
        },
        filterFn: (row, id, value) => {
          return value.includes(row.getValue(id));
        },
      });
    }

    return baseColumns;
  }, [userOptions, classOptions, chatRubrics, isAdmin, profiles]);

  return {
    columns,
    isLoading: usersLoading || classesLoading || chatsLoading || rubricsLoading || profilesLoading,
    data: chats,
    userOptions,
    classOptions,
    profileTypes, // Export dynamic profile types
    isAdmin,
  };
}
