"use client";

import { Class, Document } from "@/types";
import { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";

export interface UseClassColumnsProps {
  documents: Document[];
}

export function useClassColumns({ documents }: UseClassColumnsProps) {
  const columns = useMemo<ColumnDef<Class>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => row.getValue("name"),
        filterFn: (row, _, value) => {
          const name = (row.getValue("name") as string).toLowerCase();
          const description = row.original.description.toLowerCase();
          const classCode = row.original.classCode.toLowerCase();
          const searchTerm = value.toLowerCase();

          return (
            name.includes(searchTerm) ||
            description.includes(searchTerm) ||
            classCode.includes(searchTerm)
          );
        },
      },
      {
        id: "year",
        header: "Year",
        accessorFn: (classItem) => classItem.year,
        filterFn: (row, _, value) => {
          const classYear = row.original.year;
          return value.includes(classYear.toString());
        },
      },
      {
        id: "term",
        header: "Term",
        accessorFn: (classItem) => classItem.term,
        filterFn: (row, _, value) => {
          const classTerm = row.original.term;
          return value.includes(classTerm);
        },
      },
      {
        id: "profiles",
        header: "Profiles",
        accessorFn: (classItem) => {
          // Classes now have profileIds directly
          return classItem.profileIds || [];
        },
        filterFn: (row, _, value) => {
          const classItem = row.original;
          const classProfileIds = classItem.profileIds || [];
          return value.some((filterValue: string) =>
            classProfileIds.includes(filterValue)
          );
        },
      },
      {
        id: "documentCount",
        header: "Document Count",
        accessorFn: (classItem) => {
          const classDocuments = documents.filter(
            (document: Document) => document.classId === classItem.id
          );
          return classDocuments.length;
        },
        filterFn: (row, _, value) => {
          const classItem = row.original;
          const classDocuments = documents.filter(
            (document: Document) => document.classId === classItem.id
          );
          const documentCount = classDocuments.length;

          // Value is an array of document count ranges: ["0", "1-5", "6-10", "11-20", "21+"]
          return value.some((range: string) => {
            switch (range) {
              case "0":
                return documentCount === 0;
              case "1-5":
                return documentCount >= 1 && documentCount <= 5;
              case "6-10":
                return documentCount >= 6 && documentCount <= 10;
              case "11-20":
                return documentCount >= 11 && documentCount <= 20;
              case "21+":
                return documentCount >= 21;
              default:
                return false;
            }
          });
        },
      },
      {
        accessorKey: "updatedAt",
        header: "Updated At",
        cell: ({ row }) => row.getValue("updatedAt"),
      },
    ],
    [documents]
  );

  return { columns };
}
