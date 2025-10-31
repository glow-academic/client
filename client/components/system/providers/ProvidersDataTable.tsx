"use client";

import * as React from "react";

import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { DataTablePagination } from "@/components/common/history/DataTablePagination";
import type { ModelItem, ProviderWithModels } from "@/lib/api/v2/schemas/providers";
import { ProvidersDataTableToolbar } from "./ProvidersDataTableToolbar";

// Flattened row type for table (model + provider info)
export type ProviderModelRow = ModelItem & {
  provider_id: string;
  provider_name: string;
  provider_description: string;
  provider_can_edit: boolean;
  provider_can_delete: boolean;
};

export interface ProvidersDataTableProps {
  columns: ColumnDef<ProviderModelRow>[];
  providers: ProviderWithModels[];
  providerOptions: { value: string; label: string }[];
  customModelOptions: { value: string; label: string }[];
  statusOptions: { value: string; label: string }[];
  renderProviderGroup: (provider: ProviderWithModels) => React.ReactNode;
}

export function ProvidersDataTable({
  columns,
  providers,
  providerOptions,
  customModelOptions,
  statusOptions,
  renderProviderGroup,
}: ProvidersDataTableProps) {
  // Flatten providers/models into rows
  const rows = React.useMemo<ProviderModelRow[]>(() => {
    const flattened: ProviderModelRow[] = [];
    providers.forEach((provider) => {
      provider.models.forEach((model) => {
        flattened.push({
          ...model,
          provider_id: provider.provider_id,
          provider_name: provider.name,
          provider_description: provider.description,
          provider_can_edit: provider.can_edit,
          provider_can_delete: provider.can_delete,
        });
      });
      // Also add a row for providers with 0 models (for filtering)
      if (provider.models.length === 0) {
        flattened.push({
          model_id: `${provider.provider_id}-empty`,
          name: "",
          description: "",
          active: false,
          custom_model: false,
          updated_at: "",
          can_edit: false,
          can_delete: false,
          provider_id: provider.provider_id,
          provider_name: provider.name,
          provider_description: provider.description,
          provider_can_edit: provider.can_edit,
          provider_can_delete: provider.can_delete,
        });
      }
    });
    return flattened;
  }, [providers]);

  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "provider_name", desc: false },
    { id: "name", desc: false },
  ]);

  const table = useReactTable({
    data: rows,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    initialState: {
      pagination: {
        pageSize: 12,
      },
    },
  });

  // Group filtered rows back by provider for rendering
  const filteredProviders = React.useMemo(() => {
    const providerMap = new Map<string, ProviderWithModels>();
    const selectedProviderIds = (table
      .getColumn("provider_id")
      ?.getFilterValue() as string[]) || [];

    // Get all filtered model IDs
    const filteredModelIds = new Set<string>();
    table.getRowModel().rows.forEach((row) => {
      const modelId = row.original.model_id;
      // Only include actual models, not empty provider placeholders
      if (!modelId.endsWith("-empty")) {
        filteredModelIds.add(modelId);
      }
    });

    // Process each provider
    providers.forEach((provider) => {
      // Filter models for this provider based on filtered rows
      const filteredModels = provider.models.filter((model) =>
        filteredModelIds.has(model.model_id)
      );

      // Include provider if:
      // 1. It has filtered models, OR
      // 2. It was explicitly selected (even if 0 models)
      const isSelected = selectedProviderIds.includes(provider.provider_id);
      const hasFilteredModels = filteredModels.length > 0;
      
      // If provider filter is active, only show if selected
      // If provider filter is not active, show if has filtered models
      if (selectedProviderIds.length > 0) {
        if (isSelected) {
          providerMap.set(provider.provider_id, {
            ...provider,
            models: filteredModels,
          });
        }
      } else if (hasFilteredModels || filteredModelIds.size === 0) {
        // If no filters applied or provider has models, include it
        providerMap.set(provider.provider_id, {
          ...provider,
          models: filteredModels,
        });
      }
    });

    return Array.from(providerMap.values());
  }, [table, providers]);

  return (
    <div className="space-y-4">
      <ProvidersDataTableToolbar
        table={table}
        providerOptions={providerOptions}
        customModelOptions={customModelOptions}
        statusOptions={statusOptions}
      />

      {/* Provider groups */}
      {filteredProviders.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No models match the current filters.
        </div>
      ) : (
        <div className="space-y-6">
          {filteredProviders.map((provider) => renderProviderGroup(provider))}
        </div>
      )}

      <DataTablePagination table={table} card={true} />
    </div>
  );
}
