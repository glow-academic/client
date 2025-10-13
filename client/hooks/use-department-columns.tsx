"use client";

import { ColumnDef } from "@tanstack/react-table";
import { useCallback, useMemo } from "react";

import { useModelRuns } from "@/lib/api/hooks/model_runs";
import { useModels } from "@/lib/api/hooks/models";
import { useProfiles } from "@/lib/api/hooks/profiles";
import { Department, Model, ModelRun, Profile } from "@/types";

export function useDepartmentColumns() {
  const { data: profiles = [] } = useProfiles();
  const { data: modelRuns = [] } = useModelRuns();
  const { data: models = [] } = useModels();

  // Create filter options for total price spent
  const priceSpentOptions = useMemo(
    () => [
      { value: "low", label: "Low ($0 - $100)" },
      { value: "medium", label: "Medium ($100 - $500)" },
      { value: "high", label: "High ($500+)" },
    ],
    [],
  );

  // Create filter options for staff count
  const staffCountOptions = useMemo(
    () => [
      { value: "small", label: "Small (1-5 staff)" },
      { value: "medium", label: "Medium (6-20 staff)" },
      { value: "large", label: "Large (20+ staff)" },
    ],
    [],
  );

  // Helper function to get price range
  const getPriceRange = (totalSpent: number) => {
    if (totalSpent <= 100) return "low";
    if (totalSpent <= 500) return "medium";
    return "high";
  };

  // Helper function to get staff count range
  const getStaffRange = (staffCount: number) => {
    if (staffCount <= 5) return "small";
    if (staffCount <= 20) return "medium";
    return "large";
  };

  // Create model metadata map for pricing calculations
  const modelIdToMeta = useMemo(() => {
    const map = new Map<string, Model>();
    models.forEach((m) => map.set(m.id, m));
    return map;
  }, [models]);

  // Helper function to calculate total price spent for a department
  const calculateTotalPriceSpent = useCallback(
    (departmentId: string): number => {
      const departmentRuns = modelRuns.filter(
        (run: ModelRun) => run.departmentId === departmentId,
      );

      let totalSpend = 0;
      for (const run of departmentRuns) {
        const modelId = (run as unknown as { modelId?: string | null }).modelId;
        if (!modelId) continue;

        const meta = modelIdToMeta.get(modelId);
        if (!meta) continue;

        const spend =
          (run.inputTokens / 1_000_000) * (meta.inputPpm || 0) +
          (run.outputTokens / 1_000_000) * (meta.outputPpm || 0);
        totalSpend += spend;
      }
      return totalSpend;
    },
    [modelRuns, modelIdToMeta],
  );

  // Helper function to get staff count for a department
  const getStaffCount = useCallback(
    (departmentId: string): number => {
      const departmentProfiles = profiles.filter(
        (profile: Profile) => profile.departmentId === departmentId,
      );
      return departmentProfiles.length;
    },
    [profiles],
  );

  // Create columns for the data table
  const columns: ColumnDef<Department>[] = useMemo(
    () => [
      {
        accessorKey: "title",
        header: "Department Name",
        cell: ({ row }) => {
          const department = row.original;
          return (
            <div className="font-medium">
              {department.title || "Unnamed Department"}
            </div>
          );
        },
      },
      {
        accessorKey: "description",
        header: "Description",
        cell: ({ row }) => {
          const department = row.original;
          return (
            <div className="text-sm text-muted-foreground">
              {department.description || "No description available"}
            </div>
          );
        },
      },
      {
        accessorKey: "staffCount",
        header: "Staff Count",
        cell: ({ row }) => {
          const department = row.original;
          const staffCount = getStaffCount(department.id);
          return <div className="text-sm">{staffCount}</div>;
        },
        filterFn: (row, _id, value) => {
          const department = row.original;
          const staffCount = getStaffCount(department.id);
          const range = getStaffRange(staffCount);
          return value.includes(range);
        },
      },
      {
        accessorKey: "totalPriceSpent",
        header: "Total Price Spent",
        cell: ({ row }) => {
          const department = row.original;
          const totalSpent = calculateTotalPriceSpent(department.id);
          return <div className="text-sm">${totalSpent.toFixed(2)}</div>;
        },
        filterFn: (row, _id, value) => {
          const department = row.original;
          const totalSpent = calculateTotalPriceSpent(department.id);
          const range = getPriceRange(totalSpent);
          return value.includes(range);
        },
      },
      {
        accessorKey: "updatedAt",
        header: "Updated",
        cell: ({ row }) => {
          const department = row.original;
          return (
            <div className="text-sm text-muted-foreground">
              {new Date(department.updatedAt).toLocaleDateString()}
            </div>
          );
        },
      },
    ],
    [getStaffCount, calculateTotalPriceSpent],
  );

  return {
    columns,
    priceSpentOptions,
    staffCountOptions,
  };
}
