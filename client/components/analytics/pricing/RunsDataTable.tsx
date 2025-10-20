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

import { DataTableColumnHeader } from "@/components/common/history/DataTableColumnHeader";
import { DataTablePagination } from "@/components/common/history/DataTablePagination";
import { DataTableViewOptions } from "@/components/common/history/DataTableViewOptions";
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
import { useProfile } from "@/contexts/profile-context";
import type {
  DebugInfoItem,
  ModelMappingWithPricing,
} from "@/lib/api/v2/schemas/pricing";
import { format } from "date-fns";

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
  selectedAgentIds: string[];
  selectedPersonaIds: string[];
  selectedProfileIds: string[];
  setSelectedModelIds: (ids: string[]) => void;
  setSelectedAgentIds: (ids: string[]) => void;
  setSelectedPersonaIds: (ids: string[]) => void;
  setSelectedProfileIds: (ids: string[]) => void;
}

export function RunsDataTable({
  rows,
  modelMapping,
  profileMapping,
  agentMapping,
  personaMapping,
  selectedModelIds,
  selectedAgentIds,
  selectedPersonaIds,
  selectedProfileIds,
  setSelectedModelIds,
  setSelectedAgentIds,
  setSelectedPersonaIds,
  setSelectedProfileIds,
}: RunsDataTableProps) {
  const { effectiveProfile } = useProfile();
  const isSuperadmin = effectiveProfile?.role === "superadmin";
  const [runIdSearch, setRunIdSearch] = React.useState("");
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
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
        filterFn: (row, _id, value) => {
          return (value as string[]).includes(row.original.modelId || "");
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
        filterFn: (row, _id, value) => {
          return (value as string[]).includes(row.original.profileId || "");
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
        filterFn: (row, _id, value) => {
          const selected = (value as string[] | undefined) ?? [];
          const { agentId, personaId } = row.original;
          if (!selected?.length) return true;
          if (agentId && selected.includes(agentId)) return true;
          if (personaId && selected.includes(personaId)) return true;
          return false;
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
      r.id.toLowerCase().includes(runIdSearch.toLowerCase())
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

  return (
    <div className="space-y-3">
      {/* Filters + Search */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search bar */}
          <Input
            placeholder="Search by run ID..."
            value={runIdSearch}
            onChange={(e) => setRunIdSearch(e.target.value)}
            className="h-8 w-[200px]"
          />

          {/* Model filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 border-dashed">
                Models{" "}
                {selectedModelIds.length > 0 && `(${selectedModelIds.length})`}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-0">
              <Command>
                <CommandInput placeholder="Search models..." />
                <CommandEmpty>No models found.</CommandEmpty>
                <CommandList>
                  {modelOptions.map((m) => {
                    const checked = selectedModelIds.includes(m.value);
                    return (
                      <CommandItem
                        key={m.value}
                        onSelect={() => {
                          const next = new Set(selectedModelIds);
                          if (checked) next.delete(m.value);
                          else next.add(m.value);
                          setSelectedModelIds(Array.from(next));
                        }}
                      >
                        <Checkbox checked={checked} className="mr-2" />
                        <span className="truncate">{m.label}</span>
                      </CommandItem>
                    );
                  })}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* Agent filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 border-dashed">
                Agents{" "}
                {selectedAgentIds.length > 0 && `(${selectedAgentIds.length})`}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-0">
              <Command>
                <CommandInput placeholder="Search agents..." />
                <CommandEmpty>No agents found.</CommandEmpty>
                <CommandList>
                  {Object.entries(agentMapping).map(([id, name]) => {
                    const checked = selectedAgentIds.includes(id);
                    return (
                      <CommandItem
                        key={id}
                        onSelect={() => {
                          const next = new Set(selectedAgentIds);
                          if (checked) next.delete(id);
                          else next.add(id);
                          setSelectedAgentIds(Array.from(next));
                        }}
                      >
                        <Checkbox checked={checked} className="mr-2" />
                        <span className="truncate">{name}</span>
                      </CommandItem>
                    );
                  })}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* Persona filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 border-dashed">
                Personas{" "}
                {selectedPersonaIds.length > 0 &&
                  `(${selectedPersonaIds.length})`}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-0">
              <Command>
                <CommandInput placeholder="Search personas..." />
                <CommandEmpty>No personas found.</CommandEmpty>
                <CommandList>
                  {Object.entries(personaMapping).map(([id, name]) => {
                    const checked = selectedPersonaIds.includes(id);
                    return (
                      <CommandItem
                        key={id}
                        onSelect={() => {
                          const next = new Set(selectedPersonaIds);
                          if (checked) next.delete(id);
                          else next.add(id);
                          setSelectedPersonaIds(Array.from(next));
                        }}
                      >
                        <Checkbox checked={checked} className="mr-2" />
                        <span className="truncate">{name}</span>
                      </CommandItem>
                    );
                  })}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* Profile filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 border-dashed">
                People{" "}
                {selectedProfileIds.length > 0 &&
                  `(${selectedProfileIds.length})`}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-0">
              <Command>
                <CommandInput placeholder="Search people..." />
                <CommandEmpty>No people found.</CommandEmpty>
                <CommandList>
                  {profileOptions.map((p) => {
                    const checked = selectedProfileIds.includes(p.value);
                    return (
                      <CommandItem
                        key={p.value}
                        onSelect={() => {
                          const next = new Set(selectedProfileIds);
                          if (checked) next.delete(p.value);
                          else next.add(p.value);
                          setSelectedProfileIds(Array.from(next));
                        }}
                      >
                        <Checkbox checked={checked} className="mr-2" />
                        <span className="truncate">{p.label}</span>
                      </CommandItem>
                    );
                  })}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Table toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {(selectedModelIds.length > 0 ||
            selectedAgentIds.length > 0 ||
            selectedPersonaIds.length > 0 ||
            selectedProfileIds.length > 0 ||
            runIdSearch) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              onClick={() => {
                setSelectedModelIds([]);
                setSelectedAgentIds([]);
                setSelectedPersonaIds([]);
                setSelectedProfileIds([]);
                setRunIdSearch("");
              }}
            >
              Reset filters
            </Button>
          )}
        </div>
        <DataTableViewOptions table={table} />
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
