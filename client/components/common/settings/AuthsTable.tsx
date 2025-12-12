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
import { Key, Lock, Power, Tag } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export interface AuthTableItem {
  auth_id: string;
  auth_name: string;
  auth_description: string;
  auth_slug: string | null;
  auth_item_id: string;
  auth_item_name: string;
  auth_item_description: string;
  selected_key_id: string | null;
  value: string | null; // For non-encrypted items
  encrypted: boolean;
  enabled: boolean;
}

export interface AuthsTableProps {
  data: AuthTableItem[];
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
  onKeyChange: (
    authId: string,
    authItemId: string,
    keyId: string | null
  ) => void;
  onValueChange: (
    authId: string,
    authItemId: string,
    value: string
  ) => void;
  onEnabledChange: (authId: string, enabled: boolean) => void;
  readonly?: boolean;
}

export function AuthsTable({
  data,
  keyMapping,
  validKeyIds,
  onKeyChange,
  onValueChange,
  onEnabledChange,
  readonly = false,
}: AuthsTableProps) {
  // Columns definition
  const columns: ColumnDef<AuthTableItem>[] = React.useMemo(
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
              <p>Enable or disable this auth method</p>
            </TooltipContent>
          </Tooltip>
        ),
        cell: ({ row, table }) => {
          const item = row.original;
          // Only show switch for first row of each auth (group by auth_id)
          // Use data array index to check previous row
          const rowIndex = data.findIndex((d) => d.auth_id === item.auth_id && d.auth_item_id === item.auth_item_id);
          const isFirstRowForAuth = 
            rowIndex === 0 || 
            (rowIndex > 0 && data[rowIndex - 1]?.auth_id !== item.auth_id);
          
          if (!isFirstRowForAuth) {
            return <div className="flex items-center justify-center">—</div>;
          }
          
          return (
            <div className="flex items-center justify-center">
              <Switch
                checked={item.enabled}
                onCheckedChange={(checked) =>
                  onEnabledChange(item.auth_id, checked)
                }
                disabled={readonly}
              />
            </div>
          );
        },
      },
      {
        accessorKey: "auth_name",
        header: () => (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex flex-col items-center gap-1 cursor-help">
                <Key className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs">Auth Name</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Authentication method name</p>
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
                {item.auth_name}
              </span>
              {item.auth_description && (
                <span className="text-xs text-muted-foreground mt-1 truncate">
                  {item.auth_description}
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "auth_item_name",
        header: () => (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex flex-col items-center gap-1 cursor-help">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs">Item Name</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Encrypted auth item name</p>
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
                {item.auth_item_name}
              </span>
              {item.auth_item_description && (
                <span className="text-xs text-muted-foreground mt-1 truncate">
                  {item.auth_item_description}
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "auth_slug",
        header: () => (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex flex-col items-center gap-1 cursor-help">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs">Slug</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Authentication method slug</p>
            </TooltipContent>
          </Tooltip>
        ),
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="flex items-center justify-center">
              {item.auth_slug ? (
                <span className="text-sm font-mono text-muted-foreground">
                  {item.auth_slug}
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
                <span className="text-xs">API Key / Value</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>API key picker for encrypted items, text field for non-encrypted items</p>
            </TooltipContent>
          </Tooltip>
        ),
        cell: ({ row }) => {
          const item = row.original;
          // Only show when auth is enabled and has an item_id
          if (!item.enabled || !item.auth_item_id) {
            return (
              <div className="flex items-center justify-center px-2">
                <span className="text-sm text-muted-foreground">—</span>
              </div>
            );
          }
          
          // Show API key picker for encrypted items
          if (item.encrypted) {
            return (
              <div className="flex items-center justify-center px-2">
                <GenericPicker
                  items={keyMapping}
                  itemIds={validKeyIds}
                  selectedIds={item.selected_key_id ? [item.selected_key_id] : []}
                  onSelect={(ids: string[]) => {
                    onKeyChange(item.auth_id, item.auth_item_id, ids[0] || null);
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
          }
          
          // Show text input for non-encrypted items
          return (
            <div className="flex items-center justify-center px-2">
              <input
                type="text"
                value={item.value || ""}
                onChange={(e) => {
                  onValueChange(item.auth_id, item.auth_item_id, e.target.value);
                }}
                disabled={readonly}
                placeholder="Enter value..."
                className="h-7 px-2 text-xs border rounded-md w-full bg-background disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          );
        },
      },
    ],
    [keyMapping, validKeyIds, onKeyChange, onValueChange, onEnabledChange, readonly, data]
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
                      No authentication methods with encrypted items found.
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
