"use client";

import { DropdownMenuTrigger } from "@radix-ui/react-dropdown-menu";
import { Table } from "@tanstack/react-table";
import { Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const columnMap = {
  createdAt: "Date",
  profileId: "Name",
  userId: "Name",
  simulationId: "Simulation",
  classCode: "Classes",
  classIds: "Classes",
  personasTested: "Personas",
  averageScore: "Score",
  scenarios: "Scenarios",
  search: "Search",
  // Reports page columns
  firstName: "Name",
  username: "Alias",
  avgScore: "Score",
  totalSessions: "Sessions",
  passRate: "Pass",
  avgTimeMinutes: "Time",
  completionRate: "Complete",
  trend: "Trend",
  lastActivity: "Last Activity",
  scenariosCompleted: "Scenarios",
  messagesPerSession: "Msgs/Sess",
  totalAttempts: "Total Attempts",
  taCohorts: "Cohorts",
  isStruggling: "Status",
  // Leaderboard page columns
  rank: "Rank",
  name: "User",
  role: "Role",
  simsCompleted: "Sims Completed",
  completionPercentage: "Completion",
  firstAttemptPassRate: "First Pass",
  highestScore: "Highest Score",
  personaResponseTimes: "Response Time",
  sessionEfficiency: "Efficiency",
  stagnationRate: "Stagnation",
  timeSpent: "Time Spent",
  // Staff page columns
  active: "Status",
  lastActive: "Last Active",
  cohortNames: "Cohorts",
  email: "Email",
  actions: "Actions",
  modelId: "Model",
  modelName: "Model",
  actorId: "Agent/Persona",
  inputTokens: "Input Tokens",
  outputTokens: "Output Tokens",
  profileName: "Person",
};

export interface DataTableViewOptionsProps<TData> {
  table: Table<TData>;
  isAdmin?: boolean;
}

export function DataTableViewOptions<TData>({
  table,
}: DataTableViewOptionsProps<TData>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto hidden h-8 lg:flex"
        >
          <Settings2 />
          View
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[150px]">
        <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {table
          .getAllColumns()
          .filter(
            (column) =>
              typeof column.accessorFn !== "undefined" &&
              column.getCanHide() &&
              column.id !== "search" // Always hide search column
          )
          .map((column) => {
            return (
              <DropdownMenuCheckboxItem
                key={column.id}
                className="capitalize"
                checked={column.getIsVisible()}
                onCheckedChange={(value) => column.toggleVisibility(!!value)}
              >
                {columnMap[column.id as keyof typeof columnMap] || column.id}
              </DropdownMenuCheckboxItem>
            );
          })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
