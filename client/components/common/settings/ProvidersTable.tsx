"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import * as React from "react";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Bot, Key, Power, Tag } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export interface ProviderTableItem {
  provider_id: string;
  provider_name: string;
  provider_description: string;
  provider_value: string | null;
  selected_key_id: string | null;
  enabled: boolean;
}

export interface ProvidersTableProps {
  data: ProviderTableItem[];
  keyMapping: Record<
    string,
    {
      name: string;
      description: string;
      key_masked: string;
      active: boolean;
      department_ids: string[] | null;
    }
  >;
  validKeyIds: string[];
  onKeyChange: (providerId: string, keyId: string | null) => void;
  onEnabledChange: (providerId: string, enabled: boolean) => void;
  readonly?: boolean;
}

export function ProvidersTable({
  data,
  keyMapping,
  validKeyIds,
  onKeyChange,
  onEnabledChange,
  readonly = false,
}: ProvidersTableProps) {
  // Columns definition
  const columns: ColumnDef<ProviderTableItem>[] = React.useMemo(
    () => [
      {
        accessorKey: "enabled",
        header: () => (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex flex-col items-center gap-1 cursor-help">
                <Power className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs">Enabled</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Enable or disable this provider</p>
            </TooltipContent>
          </Tooltip>
        ),
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="flex items-center justify-center">
              <Switch
                checked={item.enabled}
                onCheckedChange={(checked) =>
                  onEnabledChange(item.provider_id, checked)
                }
                disabled={readonly}
              />
            </div>
          );
        },
      },
      {
        accessorKey: "provider_name",
        header: () => (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex flex-col items-center gap-1 cursor-help">
                <Bot className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs">Provider Name</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>AI provider name</p>
            </TooltipContent>
          </Tooltip>
        ),
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="flex flex-col w-[150px]">
              <span
                className="font-medium text-sm leading-tight whitespace-normal"
                style={{ wordBreak: "break-word", overflowWrap: "break-word" }}
              >
                {item.provider_name}
              </span>
              {item.provider_description && (
                <span className="text-xs text-muted-foreground mt-1 truncate">
                  {item.provider_description}
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "provider_value",
        header: () => (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex flex-col items-center gap-1 cursor-help">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs">Value</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Provider value/identifier</p>
            </TooltipContent>
          </Tooltip>
        ),
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="flex items-center justify-center">
              {item.provider_value ? (
                <span className="text-sm font-mono text-muted-foreground">
                  {item.provider_value}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "selected_key_id",
        header: () => (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex flex-col items-center gap-1 cursor-help">
                <Key className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs">API Key</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Select API key for this provider</p>
            </TooltipContent>
          </Tooltip>
        ),
        cell: ({ row }) => {
          const item = row.original;
          // Only show API key picker when provider is enabled
          if (!item.enabled) {
            return (
              <div className="flex items-center justify-center px-2">
                <span className="text-sm text-muted-foreground">—</span>
              </div>
            );
          }
          return (
            <div className="flex items-center justify-center px-2">
              <GenericPicker
                items={keyMapping}
                itemIds={validKeyIds}
                selectedIds={item.selected_key_id ? [item.selected_key_id] : []}
                onSelect={(ids: string[]) => {
                  onKeyChange(item.provider_id, ids[0] || null);
                }}
                getId={(item) => (item as unknown as { id: string }).id}
                getLabel={(item) => item["name"] || ""}
                getSearchText={(item) =>
                  `${item["name"]} ${item["description"] || ""}`
                }
                renderButton={(selectedItems) => {
                  if (selectedItems.length === 0) {
                    return "Select key...";
                  }
                  return selectedItems[0]?.["name"] || "Select key...";
                }}
                renderItem={(item, _isSelected) => (
                  <div className="flex items-center gap-3 w-full">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {item["name"] || "Unnamed Key"}
                      </div>
                      {item["description"] && (
                        <div className="text-sm text-muted-foreground truncate group-data-[selected=true]:text-primary-foreground group-data-[highlighted=true]:text-primary-foreground">
                          {item["description"]}
                        </div>
                      )}
                      {item["department_ids"] &&
                        Array.isArray(item["department_ids"]) &&
                        item["department_ids"].length > 0 && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {item["department_ids"].length} department
                            {item["department_ids"].length !== 1 ? "s" : ""}
                          </div>
                        )}
                      {!item["active"] && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Inactive
                        </div>
                      )}
                    </div>
                  </div>
                )}
                placeholder="Select key..."
                disabled={readonly}
                multiSelect={false}
                hideSelectedChips={true}
                compact={true}
                buttonClassName="h-7 px-2 text-xs justify-between w-full"
              />
            </div>
          );
        },
      },
    ],
    [keyMapping, validKeyIds, onKeyChange, onEnabledChange, readonly]
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const tableRows = React.useMemo(() => {
    return table.getRowModel().rows;
  }, [table, data.length]);

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="text-center whitespace-normal"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {tableRows?.length ? (
                tableRows.map((row) => {
                  const item = row.original;
                  return (
                  <TableRow
                    key={row.id}
                      className={`hover:bg-muted/30 transition-colors ${
                        !item.enabled ? "opacity-50" : ""
                      }`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className="border-r px-3 py-2 text-center min-h-[60px]"
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center px-6"
                  >
                    <p className="text-sm text-muted-foreground">
                      No AI providers available.
                    </p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </TooltipProvider>
  );
}
