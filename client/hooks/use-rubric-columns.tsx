"use client";

import { DataTableColumnHeader } from "@/components/common/history/DataTableColumnHeader";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Rubric } from "@/types";
import { ColumnDef } from "@tanstack/react-table";
import { formatDistanceToNow } from "date-fns";

export function useRubricColumns() {
  const columns: ColumnDef<Rubric>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
      cell: ({ row }) => (
        <div className="w-[200px]">{row.getValue("name")}</div>
      ),
      enableSorting: true,
      enableHiding: false,
    },
    {
      accessorKey: "points",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Total Points" />
      ),
      cell: ({ row }) => {
        const points = row.getValue("points") as number;
        return <div className="w-[100px]">{points}</div>;
      },
      enableSorting: true,
      enableHiding: true,
      filterFn: (row, id, value) => {
        const points = row.getValue(id) as number;
        if (value.includes("100+")) {
          return points >= 100;
        }
        const [min, max] = value.split("-").map(Number);
        return points >= min && points <= max;
      },
    },
    {
      accessorKey: "passPoints",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Pass Points" />
      ),
      cell: ({ row }) => {
        const passPoints = row.getValue("passPoints") as number;
        return <div className="w-[100px]">{passPoints}</div>;
      },
      enableSorting: true,
      enableHiding: true,
      filterFn: (row, id, value) => {
        const passPoints = row.getValue(id) as number;
        if (value.includes("100+")) {
          return passPoints >= 100;
        }
        const [min, max] = value.split("-").map(Number);
        return passPoints >= min && passPoints <= max;
      },
    },
    {
      accessorKey: "passPercentage",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Pass %" />
      ),
      cell: ({ row }) => {
        const points = row.original.points;
        const passPoints = row.original.passPoints;
        const percentage =
          points > 0 ? Math.round((passPoints / points) * 100) : 0;
        return <div className="w-[80px]">{percentage}%</div>;
      },
      enableSorting: true,
      enableHiding: true,
      filterFn: (row, id, value) => {
        const points = row.original.points;
        const passPoints = row.original.passPoints;
        const percentage =
          points > 0 ? Math.round((passPoints / points) * 100) : 0;
        const [min, max] = value.split("-").map(Number);
        return percentage >= min && percentage <= max;
      },
    },
    {
      accessorKey: "active",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const active = row.getValue("active") as boolean;
        return (
          <Badge variant={active ? "default" : "secondary"}>
            {active ? "Active" : "Inactive"}
          </Badge>
        );
      },
      enableSorting: true,
      enableHiding: true,
    },
    {
      accessorKey: "defaultRubric",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Type" />
      ),
      cell: ({ row }) => {
        const defaultRubric = row.getValue("defaultRubric") as boolean;
        return (
          <Badge variant={defaultRubric ? "outline" : "secondary"}>
            {defaultRubric ? "Default" : "Custom"}
          </Badge>
        );
      },
      enableSorting: true,
      enableHiding: true,
    },
    {
      accessorKey: "updatedAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Updated" />
      ),
      cell: ({ row }) => {
        const updatedAt = row.getValue("updatedAt") as string;
        return (
          <div className="w-[120px]">
            {formatDistanceToNow(new Date(updatedAt), { addSuffix: true })}
          </div>
        );
      },
      enableSorting: true,
      enableHiding: true,
    },
  ];

  // Generate filter options for simulations
  const simulationOptions = [
    { value: "used", label: "Used in Simulations" },
    { value: "unused", label: "Not Used" },
  ];

  // Generate filter options for pass points ranges
  const passPointsOptions = [
    { value: "0-25", label: "0-25 points" },
    { value: "26-50", label: "26-50 points" },
    { value: "51-75", label: "51-75 points" },
    { value: "76-100", label: "76-100 points" },
    { value: "100+", label: "100+ points" },
  ];

  // Generate filter options for total points ranges
  const totalPointsOptions = [
    { value: "0-25", label: "0-25 points" },
    { value: "26-50", label: "26-50 points" },
    { value: "51-75", label: "51-75 points" },
    { value: "76-100", label: "76-100 points" },
    { value: "100+", label: "100+ points" },
  ];

  // Generate filter options for pass percentage ranges
  const passPercentageOptions = [
    { value: "0-25", label: "0-25%" },
    { value: "26-50", label: "26-50%" },
    { value: "51-75", label: "51-75%" },
    { value: "76-100", label: "76-100%" },
  ];

  return {
    columns,
    simulationOptions,
    passPointsOptions,
    totalPointsOptions,
    passPercentageOptions,
  };
}
