"use client";

import { useQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";

import { DataTableColumnHeader } from "@/components/common/history/DataTableColumnHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Document, Scenario } from "@/types";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";
import { Edit, Trash2 } from "lucide-react";

// Helper function to truncate text
const truncateText = (text: string, maxLength: number = 30): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
};

export function useDocumentColumns() {
  // Fetch data for filter options
  const { data: scenarios = [] } = useQuery({
    queryKey: ["scenarios"],
    queryFn: () => getAllScenarios(),
  });

  const columns = useMemo<ColumnDef<Document>[]>(
    () => [
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
      {
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Name" />
        ),
        cell: ({ row }) => {
          const name = row.getValue("name") as string;
          return (
            <div className="max-w-[200px]">
              <span title={name}>{truncateText(name, 25)}</span>
            </div>
          );
        },
        filterFn: (row, id, value) => {
          return value.length === 0 || value.includes(row.getValue(id));
        },
      },
      {
        accessorKey: "type",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Type" />
        ),
        cell: ({ row }) => {
          const type = row.getValue("type") as string;
          const typeInfo = typeOptions.find((option) => option.value === type);
          return (
            <Badge variant="outline" className="text-xs">
              {typeInfo?.label || type}
            </Badge>
          );
        },
        filterFn: (row, id, value) => {
          return value.length === 0 || value.includes(row.getValue(id));
        },
      },
      {
        accessorKey: "extension",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Extension" />
        ),
        cell: ({ row }) => {
          const document = row.original;
          const extension =
            document.name.split(".").pop()?.toUpperCase() || "N/A";
          return (
            <Badge variant="secondary" className="text-xs">
              {extension}
            </Badge>
          );
        },
        filterFn: (row, id, value) => {
          return value.length === 0 || value.includes(row.getValue(id));
        },
      },
      {
        accessorKey: "scenarios",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Scenarios" />
        ),
        cell: ({ row }) => {
          const document = row.original;
          const documentScenarios = scenarios.filter((scenario: Scenario) =>
            scenario.documentIds?.includes(document.id)
          );
          return (
            <div className="max-w-[150px]">
              {documentScenarios.length > 0 ? (
                <Badge variant="outline" className="text-xs">
                  {documentScenarios.length} scenario
                  {documentScenarios.length > 1 ? "s" : ""}
                </Badge>
              ) : (
                <span className="text-muted-foreground text-xs">None</span>
              )}
            </div>
          );
        },
        filterFn: (row, id, value) => {
          return value.length === 0 || value.includes(row.getValue(id));
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
      },
      {
        accessorKey: "updatedAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Updated" />
        ),
        cell: ({ row }) => {
          const date = new Date(row.getValue("updatedAt"));
          return (
            <div className="text-xs text-muted-foreground">
              {date.toLocaleDateString()}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const document = row.original;
          return (
            <div className="flex items-center justify-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
              >
                <Edit className="h-3 w-3" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          );
        },
        enableSorting: false,
        enableHiding: false,
      },
    ],
    [scenarios]
  );

  // Filter options
  const typeOptions = useMemo(
    () => [
      { value: "homework", label: "📚 Homework" },
      { value: "project", label: "🎯 Project" },
      { value: "quiz", label: "❓ Quiz" },
      { value: "midterm", label: "📝 Midterm" },
      { value: "lab", label: "🧪 Lab" },
      { value: "lecture", label: "📖 Lecture" },
      { value: "syllabus", label: "📋 Syllabus" },
    ],
    []
  );

  const scenarioOptions = useMemo(
    () =>
      scenarios.map((scenario: Scenario) => ({
        value: scenario.id,
        label: scenario.name,
      })),
    [scenarios]
  );

  const extensionOptions = useMemo(
    () => [
      { value: "PDF", label: "PDF" },
      { value: "DOC", label: "DOC" },
      { value: "DOCX", label: "DOCX" },
      { value: "TXT", label: "TXT" },
      { value: "MD", label: "MD" },
      { value: "JPG", label: "JPG" },
      { value: "PNG", label: "PNG" },
      { value: "OTHER", label: "Other" },
    ],
    []
  );

  return {
    columns,
    typeOptions,
    scenarioOptions,
    extensionOptions,
  };
}
