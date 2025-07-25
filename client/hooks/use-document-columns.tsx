"use client";

import { useQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";

import { DataTableColumnHeader } from "@/components/common/history/DataTableColumnHeader";
import { Document, Scenario } from "@/types";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";

export function useDocumentColumns() {
  // Fetch data for filter options
  const { data: scenarios = [] } = useQuery({
    queryKey: ["scenarios"],
    queryFn: () => getAllScenarios(),
  });

  const columns = useMemo<ColumnDef<Document>[]>(
    () => [
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
        filterFn: (row, id, value) => {
          const name = row.getValue(id) as string;
          const searchText = value.toLowerCase();
          return name.toLowerCase().includes(searchText);
        },
      },
      {
        accessorKey: "type",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Type" />
        ),
        cell: ({ row }) => {
          const type = row.getValue("type") as string;
          const typeMap: Record<string, string> = {
            homework: "📝 Homework",
            project: "🚀 Project",
            quiz: "❓ Quiz",
            midterm: "📊 Midterm",
            lab: "🧪 Lab",
            lecture: "📚 Lecture",
            syllabus: "📋 Syllabus",
          };
          return (
            <div className="w-[120px]">{typeMap[type] || "📄 Document"}</div>
          );
        },
        enableSorting: true,
        enableHiding: true,
        filterFn: (row, id, value) => {
          const type = row.getValue(id) as string;
          return value.includes(type);
        },
      },
      {
        accessorKey: "extension",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Extension" />
        ),
        cell: ({ row }) => {
          const mimeType = row.original.mimeType;
          const extensionMap: Record<string, string> = {
            "application/pdf": "PDF",
            "image/jpeg": "JPEG",
            "image/jpg": "JPG",
            "image/png": "PNG",
            "image/gif": "GIF",
            "image/svg+xml": "SVG",
            "image/webp": "WEBP",
            "application/msword": "DOC",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
              "DOCX",
            "text/plain": "TXT",
            "text/markdown": "MD",
            "application/zip": "ZIP",
            "text/html": "HTML",
            "text/css": "CSS",
            "application/javascript": "JS",
            "text/javascript": "JS",
            "application/json": "JSON",
            "text/xml": "XML",
            "application/xml": "XML",
          };
          return (
            <div className="w-[80px] text-center">
              {extensionMap[mimeType] || "OTHER"}
            </div>
          );
        },
        enableSorting: true,
        enableHiding: true,
        filterFn: (row, _, value) => {
          const mimeType = row.original.mimeType;
          const extensionMap: Record<string, string> = {
            "application/pdf": "PDF",
            "image/jpeg": "JPEG",
            "image/jpg": "JPG",
            "image/png": "PNG",
            "image/gif": "GIF",
            "image/svg+xml": "SVG",
            "image/webp": "WEBP",
            "application/msword": "DOC",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
              "DOCX",
            "text/plain": "TXT",
            "text/markdown": "MD",
            "application/zip": "ZIP",
            "text/html": "HTML",
            "text/css": "CSS",
            "application/javascript": "JS",
            "text/javascript": "JS",
            "application/json": "JSON",
            "text/xml": "XML",
            "application/xml": "XML",
          };
          const extension = extensionMap[mimeType] || "OTHER";
          return value.includes(extension);
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
            <div className="w-[80px] text-center">
              {active ? "Active" : "Inactive"}
            </div>
          );
        },
        enableSorting: true,
        enableHiding: true,
        filterFn: (row, id, value) => {
          const active = row.getValue(id) as boolean;
          const status = active ? "Active" : "Inactive";
          return value.includes(status);
        },
      },
      {
        accessorKey: "scenarioIds",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Scenarios" />
        ),
        cell: ({ row }) => {
          const document = row.original;
          const documentScenarios = scenarios.filter((scenario: Scenario) =>
            scenario.documentIds?.includes(document.id)
          );
          return (
            <div className="w-[80px] text-center">
              {documentScenarios.length}
            </div>
          );
        },
        enableSorting: true,
        enableHiding: true,
        filterFn: (row, _, value) => {
          const document = row.original;
          const documentScenarios = scenarios.filter((scenario: Scenario) =>
            scenario.documentIds?.includes(document.id)
          );
          return value.some((filterValue: string) =>
            documentScenarios.some((scenario) => scenario.id === filterValue)
          );
        },
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
              {new Date(updatedAt).toLocaleDateString()}
            </div>
          );
        },
        enableSorting: true,
        enableHiding: true,
      },
    ],
    [scenarios]
  );

  // Filter options
  const typeOptions = useMemo(
    () => [
      { value: "homework", label: "📝 Homework" },
      { value: "project", label: "🚀 Project" },
      { value: "quiz", label: "❓ Quiz" },
      { value: "midterm", label: "📊 Midterm" },
      { value: "lab", label: "🧪 Lab" },
      { value: "lecture", label: "📚 Lecture" },
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
      { value: "JPEG", label: "JPEG" },
      { value: "JPG", label: "JPG" },
      { value: "PNG", label: "PNG" },
      { value: "GIF", label: "GIF" },
      { value: "SVG", label: "SVG" },
      { value: "WEBP", label: "WEBP" },
      { value: "DOC", label: "DOC" },
      { value: "DOCX", label: "DOCX" },
      { value: "TXT", label: "TXT" },
      { value: "MD", label: "MD" },
      { value: "ZIP", label: "ZIP" },
      { value: "HTML", label: "HTML" },
      { value: "CSS", label: "CSS" },
      { value: "JS", label: "JS" },
      { value: "JSON", label: "JSON" },
      { value: "XML", label: "XML" },
      { value: "OTHER", label: "OTHER" },
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
