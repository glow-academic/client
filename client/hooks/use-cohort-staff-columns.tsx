"use client";

import { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";

import { Profile } from "@/types";
import { profileRole } from "@/utils/drizzle/schema";

export function useCohortStaffColumns() {
  const columns = useMemo<ColumnDef<Profile>[]>(
    () => [
      {
        accessorKey: "role",
        header: "Role",
        cell: ({ row }) => row.getValue("role"),
        filterFn: (row, id, value) => {
          const role = row.getValue(id) as string;
          const searchText = value.toLowerCase();
          return role.toLowerCase().includes(searchText);
        },
      },
    ],
    [],
  );

  // Filter options
  const roleOptions = useMemo(
    () =>
      profileRole.enumValues
        .filter(
          (role) =>
            role !== "superadmin" && role !== "admin" && role !== "guest",
        )
        .map((role) => ({
          value: role,
          label: role,
        })),
    [],
  );

  return {
    columns,
    roleOptions,
  };
}
