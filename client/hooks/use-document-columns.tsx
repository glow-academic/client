"use client";

import { useQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";

import DocumentViewer from "@/components/common/chat/DocumentViewer";
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

// Helper function to get file extension
const getFileExtension = (filename: string): string => {
  const parts = filename.split(".");
  if (parts.length > 1) {
    const extension = parts[parts.length - 1];
    return extension ? extension.toUpperCase() : "N/A";
  }
  return "N/A";
};

export function useDocumentColumns(onPreview?: (document: Document) => void) {
  // Fetch data for filter options
  const { data: scenarios = [] } = useQuery({
    queryKey: ["scenarios"],
    queryFn: () => getAllScenarios(),
  });

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
        sortingFn: "datetime",
      },
      {
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Name" />
        ),
        cell: ({ row }) => {
          const name = row.getValue("name") as string;
          return (
            <div className="flex items-center gap-3 max-w-[300px]">
              {/* Document preview */}
              <div
                className="w-12 h-12 bg-muted rounded-lg overflow-hidden flex-shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => onPreview?.(row.original)}
              >
                <div className="w-full h-full">
                  <DocumentViewer
                    document={row.original}
                    bare={true}
                    isFormDocument={false}
                    compact={true}
                  />
                </div>
              </div>
              {/* Document name */}
              <div className="flex-1 min-w-0">
                <span title={name} className="text-sm font-medium">
                  {truncateText(name, 25)}
                </span>
              </div>
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
          const extension = getFileExtension(row.original.name);
          return (
            <Badge variant="secondary" className="text-xs">
              {extension}
            </Badge>
          );
        },
        filterFn: (row, _id, value) => {
          const document = row.original;
          const extension = getFileExtension(document.name);
          return value.length === 0 || value.includes(extension);
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

          if (documentScenarios.length === 0) {
            return (
              <div className="max-w-[200px]">
                <span className="text-muted-foreground text-xs">None</span>
              </div>
            );
          }

          return (
            <div className="max-w-[200px] flex flex-wrap gap-1">
              {documentScenarios.slice(0, 3).map((scenario: Scenario) => (
                <Badge key={scenario.id} variant="outline" className="text-xs">
                  {truncateText(scenario.name, 15)}
                </Badge>
              ))}
              {documentScenarios.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{documentScenarios.length - 3} more
                </Badge>
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
        id: "actions",
        header: "Actions",
        cell: ({ row: _row }) => {
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
    [scenarios, typeOptions, onPreview]
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
