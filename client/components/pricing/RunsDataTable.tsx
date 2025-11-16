"use client";

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
import { Bug } from "lucide-react";
import * as React from "react";

import { DataTableColumnHeader } from "@/components/common/table/DataTableColumnHeader";
import { DataTableFacetedFilter } from "@/components/common/table/DataTableFacetedFilter";
import { DataTablePagination } from "@/components/common/table/DataTablePagination";
import { DataTableViewOptions } from "@/components/common/table/DataTableViewOptions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { X } from "lucide-react";
import { useProfile } from "@/contexts/profile-context";
import { format } from "date-fns";

type DebugInfoItem = {
  id: string;
  created_at: string;
  content: string;
};

type ModelMappingWithPricing = {
  name: string;
  description: string;
  input_ppm: number;
  output_ppm: number;
};

const currency = (value: number) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 4,
  }).format(value);

export interface ModelRunRow {
  id: string;
  createdAt: string;
  modelId: string | null;
  modelName: string;
  agentId?: string | null;
  agentName?: string;
  personaId?: string | null;
  personaName?: string;
  profileId?: string | null;
  profileName?: string;
  inputTokens: number;
  outputTokens: number;
  debugInfo?: DebugInfoItem[];
  cost: number;
}

export interface RunsDataTableProps {
  rows: ModelRunRow[];
  modelMapping: Record<string, ModelMappingWithPricing>;
  profileMapping: Record<string, string>;
  agentMapping: Record<string, string>;
  personaMapping: Record<string, string>;
  selectedModelIds: string[];
  selectedActorIds: string[]; // Combined agent/persona IDs
  selectedProfileIds: string[];
  setSelectedModelIds: (ids: string[]) => void;
  setSelectedActorIds: (ids: string[]) => void;
  setSelectedProfileIds: (ids: string[]) => void;
}

export function RunsDataTable({
  rows,
  modelMapping,
  profileMapping,
  agentMapping,
  personaMapping,
  selectedModelIds,
  selectedActorIds,
  selectedProfileIds,
  setSelectedModelIds,
  setSelectedActorIds,
  setSelectedProfileIds,
}: RunsDataTableProps) {
  const { effectiveProfile } = useProfile();
  const isSuperadmin = effectiveProfile?.role === "superadmin";
  const [runIdSearch, setRunIdSearch] = React.useState("");
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({
      actorId: false, // Hide the filter column
      modelIdFilter: false,
      profileIdFilter: false,
    });
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);

  const columns = React.useMemo<ColumnDef<ModelRunRow>[]>(() => {
    const cols: ColumnDef<ModelRunRow>[] = [
      {
        accessorKey: "createdAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Created" />
        ),
        cell: ({ row }) => (
          <div className="text-sm">
            {format(new Date(row.getValue("createdAt")), "yyyy-MM-dd HH:mm")}
          </div>
        ),
        enableSorting: true,
      },
      {
        accessorKey: "modelName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Model" />
        ),
        cell: ({ row }) => (
          <div className="text-sm">{row.getValue("modelName")}</div>
        ),
        enableHiding: true,
        filterFn: (row, _id, value) => {
          return (value as string[]).includes(row.original.modelId || "");
        },
      },
      // Hidden faceting column for Model (IDs)
      {
        id: "modelIdFilter",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: ModelRunRow) => row.modelId || "",
        filterFn: (row, _id, value: string[]) => {
          if (!value || value.length === 0) return true;
          const modelId = row.original.modelId || "";
          // Additive filtering: keep row if modelId is in selected values
          return value.includes(modelId);
        },
      },
      {
        accessorKey: "profileName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Person" />
        ),
        cell: ({ row }) => (
          <div className="text-sm">{row.getValue("profileName")}</div>
        ),
        enableHiding: true,
        filterFn: (row, _id, value) => {
          return (value as string[]).includes(row.original.profileId || "");
        },
      },
      // Hidden faceting column for Profile/Name (IDs)
      {
        id: "profileIdFilter",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: ModelRunRow) => row.profileId || "",
        filterFn: (row, _id, value: string[]) => {
          if (!value || value.length === 0) return true;
          const profileId = row.original.profileId || "";
          // Additive filtering: keep row if profileId is in selected values
          return value.includes(profileId);
        },
      },
      {
        id: "actorId",
        accessorFn: (r) => r.agentId || r.personaId || "",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Agent/Persona" />
        ),
        cell: ({ row }) => {
          const label =
            row.original.agentName || row.original.personaName || "";
          return <div className="text-sm">{label}</div>;
        },
        enableHiding: true,
        filterFn: (row, _id, value) => {
          const selected = (value as string[] | undefined) ?? [];
          const { agentId, personaId } = row.original;
          if (!selected?.length) return true;
          // Additive filtering: keep row if agentId or personaId is in selected values
          if (agentId && selected.includes(agentId)) return true;
          if (personaId && selected.includes(personaId)) return true;
          return false;
        },
      },
      // Hidden faceting column for Actor (Agent/Persona IDs)
      {
        id: "actorIdFilter",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        accessorFn: (row: ModelRunRow) => {
          // Return array of IDs that this row matches (agentId and/or personaId)
          const ids: string[] = [];
          if (row.agentId) ids.push(row.agentId);
          if (row.personaId) ids.push(row.personaId);
          return ids;
        },
        filterFn: (row, _id, value: string[]) => {
          const rowIds = (row.getValue("actorIdFilter") as string[]) ?? [];
          if (!value || value.length === 0) return true;
          // Additive filtering: keep row if it contains ANY selected actor ID
          return value.some((v) => rowIds.includes(v));
        },
      },
      {
        accessorKey: "inputTokens",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Input Tokens" />
        ),
        cell: ({ row }) => (
          <div className="text-sm tabular-nums">
            {row.getValue("inputTokens")}
          </div>
        ),
        enableSorting: true,
      },
      {
        accessorKey: "outputTokens",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Output Tokens" />
        ),
        cell: ({ row }) => (
          <div className="text-sm tabular-nums">
            {row.getValue("outputTokens")}
          </div>
        ),
        enableSorting: true,
      },
      {
        accessorKey: "cost",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Cost" />
        ),
        cell: ({ row }) => (
          <div className="text-sm tabular-nums font-medium">
            {currency(row.getValue("cost") as number)}
          </div>
        ),
        enableSorting: true,
      },
    ];

    if (isSuperadmin) {
      cols.push({
        id: "debug",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Debug" />
        ),
        cell: ({ row }) => {
          const d = row.original.debugInfo || [];
          const has = d.length > 0;
          const content = d[0]?.content ?? null; // display first entry content
          return (
            <HoverCard>
              <HoverCardTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={!has}
                >
                  <Bug
                    className={`h-4 w-4 ${has ? "text-amber-600" : "text-muted-foreground"}`}
                  />
                </Button>
              </HoverCardTrigger>
              <HoverCardContent align="start" className="max-w-[480px]">
                {content ? (
                  <pre className="text-xs whitespace-pre-wrap break-words">
                    {content}
                  </pre>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    No debug info
                  </span>
                )}
              </HoverCardContent>
            </HoverCard>
          );
        },
      });
    }

    return cols;
  }, [isSuperadmin]);

  // Filter rows by search
  const filteredRows = React.useMemo(() => {
    if (!runIdSearch) return rows;
    return rows.filter((r) =>
      r.id.toLowerCase().includes(runIdSearch.toLowerCase()),
    );
  }, [rows, runIdSearch]);

  const table = useReactTable({
    data: filteredRows,
    columns,
    state: {
      sorting,
      columnVisibility,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
      columnVisibility: {
        actorIdFilter: false,
        modelIdFilter: false,
        profileIdFilter: false,
      },
    },
  });

  // Build filter options from mappings
  const modelOptions = React.useMemo(() => {
    return Object.entries(modelMapping).map(([id, data]) => ({
      value: id,
      label: data.name,
    }));
  }, [modelMapping]);

  const profileOptions = React.useMemo(() => {
    return Object.entries(profileMapping).map(([id, name]) => ({
      value: id,
      label: name,
    }));
  }, [profileMapping]);

  // Combine agent and persona mappings into single actor options
  const actorOptions = React.useMemo(() => {
    const options: { value: string; label: string }[] = [];
    // Add agents
    Object.entries(agentMapping).forEach(([id, name]) => {
      options.push({ value: id, label: name });
    });
    // Add personas
    Object.entries(personaMapping).forEach(([id, name]) => {
      options.push({ value: id, label: name });
    });
    return options;
  }, [agentMapping, personaMapping]);

  // Initialize table filter from props (only on mount or when props change externally)
  React.useEffect(() => {
    const actorIdFilterColumn = table.getColumn("actorIdFilter");
    if (actorIdFilterColumn) {
      const currentFilter = actorIdFilterColumn.getFilterValue() as string[] | undefined;
      const currentIds = currentFilter || [];
      const selectedIds = selectedActorIds || [];
      // Only update if they're different (avoid unnecessary updates)
      if (
        currentIds.length !== selectedIds.length ||
        !currentIds.every((id) => selectedIds.includes(id)) ||
        !selectedIds.every((id) => currentIds.includes(id))
      ) {
        actorIdFilterColumn.setFilterValue(
          selectedActorIds.length > 0 ? selectedActorIds : undefined
        );
      }
    }
  }, [selectedActorIds, table]);

  // Sync table filter changes back to selectedActorIds when user interacts with filter
  React.useEffect(() => {
    const actorIdFilterColumn = table.getColumn("actorIdFilter");
    if (actorIdFilterColumn) {
      const filterValue = actorIdFilterColumn.getFilterValue() as string[] | undefined;
      const newActorIds = filterValue || [];
      const currentIds = selectedActorIds || [];
      // Only update if they're different (avoid circular updates)
      if (
        newActorIds.length !== currentIds.length ||
        !newActorIds.every((id) => currentIds.includes(id)) ||
        !currentIds.every((id) => newActorIds.includes(id))
      ) {
        setSelectedActorIds(newActorIds);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table.getState().columnFilters]);

  // Sync selectedModelIds with table filter
  React.useEffect(() => {
    const modelIdFilterColumn = table.getColumn("modelIdFilter");
    if (modelIdFilterColumn) {
      const currentFilter = modelIdFilterColumn.getFilterValue() as string[] | undefined;
      const currentIds = currentFilter || [];
      const selectedIds = selectedModelIds || [];
      if (
        currentIds.length !== selectedIds.length ||
        !currentIds.every((id) => selectedIds.includes(id)) ||
        !selectedIds.every((id) => currentIds.includes(id))
      ) {
        modelIdFilterColumn.setFilterValue(
          selectedModelIds.length > 0 ? selectedModelIds : undefined
        );
      }
    }
  }, [selectedModelIds, table]);

  // Sync table filter changes back to selectedModelIds
  React.useEffect(() => {
    const modelIdFilterColumn = table.getColumn("modelIdFilter");
    if (modelIdFilterColumn) {
      const filterValue = modelIdFilterColumn.getFilterValue() as string[] | undefined;
      const newModelIds = filterValue || [];
      const currentIds = selectedModelIds || [];
      if (
        newModelIds.length !== currentIds.length ||
        !newModelIds.every((id) => currentIds.includes(id)) ||
        !currentIds.every((id) => newModelIds.includes(id))
      ) {
        setSelectedModelIds(newModelIds);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table.getState().columnFilters]);

  // Sync selectedProfileIds with table filter
  React.useEffect(() => {
    const profileIdFilterColumn = table.getColumn("profileIdFilter");
    if (profileIdFilterColumn) {
      const currentFilter = profileIdFilterColumn.getFilterValue() as string[] | undefined;
      const currentIds = currentFilter || [];
      const selectedIds = selectedProfileIds || [];
      if (
        currentIds.length !== selectedIds.length ||
        !currentIds.every((id) => selectedIds.includes(id)) ||
        !selectedIds.every((id) => currentIds.includes(id))
      ) {
        profileIdFilterColumn.setFilterValue(
          selectedProfileIds.length > 0 ? selectedProfileIds : undefined
        );
      }
    }
  }, [selectedProfileIds, table]);

  // Sync table filter changes back to selectedProfileIds
  React.useEffect(() => {
    const profileIdFilterColumn = table.getColumn("profileIdFilter");
    if (profileIdFilterColumn) {
      const filterValue = profileIdFilterColumn.getFilterValue() as string[] | undefined;
      const newProfileIds = filterValue || [];
      const currentIds = selectedProfileIds || [];
      if (
        newProfileIds.length !== currentIds.length ||
        !newProfileIds.every((id) => currentIds.includes(id)) ||
        !currentIds.every((id) => newProfileIds.includes(id))
      ) {
        setSelectedProfileIds(newProfileIds);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table.getState().columnFilters]);

  const actorIdFilterColumn = table.getColumn("actorIdFilter");
  const modelIdFilterColumn = table.getColumn("modelIdFilter");
  const profileIdFilterColumn = table.getColumn("profileIdFilter");
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="space-y-3">
      {/* Filters + Search */}
      <div className="flex items-center justify-between">
        <div className="flex flex-1 items-center space-x-2">
          {/* Search bar */}
          <Input
            placeholder="Search by run ID..."
            value={runIdSearch}
            onChange={(e) => setRunIdSearch(e.target.value)}
            className="h-8 w-[200px]"
          />

          {/* Model filter */}
          {modelIdFilterColumn && modelOptions.length > 0 && (
            <DataTableFacetedFilter
              column={modelIdFilterColumn}
              title="Model"
              options={modelOptions}
            />
          )}

          {/* Agent/Persona filter - merged */}
          {actorIdFilterColumn && actorOptions.length > 0 && (
            <DataTableFacetedFilter
              column={actorIdFilterColumn}
              title="Agent/Persona"
              options={actorOptions}
            />
          )}

          {/* Name filter */}
          {profileIdFilterColumn && profileOptions.length > 0 && (
            <DataTableFacetedFilter
              column={profileIdFilterColumn}
              title="Name"
              options={profileOptions}
            />
          )}
        </div>
        <div className="flex items-center space-x-2">
          {isFiltered && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 lg:px-3"
              onClick={() => {
                table.resetColumnFilters();
                setSelectedModelIds([]);
                setSelectedActorIds([]);
                setSelectedProfileIds([]);
                setRunIdSearch("");
              }}
            >
              Reset
              <X className="ml-2 h-4 w-4" />
            </Button>
          )}
          <DataTableViewOptions table={table} />
        </div>
      </div>

      <div className="border rounded-lg">
        <table className="w-full">
          <thead className="bg-muted/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-sm font-medium"
                  >
                    {header.isPlaceholder
                      ? null
                      : typeof header.column.columnDef.header === "string"
                        ? header.column.columnDef.header
                        : header.column.columnDef.header?.(header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b hover:bg-muted/50 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 text-sm">
                      {typeof cell.column.columnDef.cell === "function"
                        ? cell.column.columnDef.cell(cell.getContext())
                        : cell.getValue()}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={table.getVisibleLeafColumns().length || 1}
                  className="h-24 text-center text-muted-foreground"
                >
                  No runs match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <DataTablePagination table={table} />
    </div>
  );
}
