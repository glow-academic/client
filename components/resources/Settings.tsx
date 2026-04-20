/**
 * Settings.tsx
 * Resource component for settings selection.
 */

"use client";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";
import { useCallback, useMemo } from "react";

export interface SettingResourceItem {
  id?: string | null;
  name?: string | null;
  description?: string | null;
  department_ids?: string[] | null;
  provider_key_ids?: string[] | null;
  auth_ids?: string[] | null;
  system_ids?: string[] | null;
  active?: boolean | null;
  mcp?: boolean | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  selected?: boolean | null;
  pending?: boolean | null;
}

type SettingPickerItem = {
  id: string;
  name: string;
  description?: string;
  suggested: boolean | null | undefined;
  pending: boolean | null | undefined;
};

export interface SettingsProps {
  settings_ids?: string[];
  settings?: SettingResourceItem[];
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
}

export function Settings({
  settings_ids,
  settings,
  disabled = false,
  onChange,
  label = "Settings",
  id = "settings",
  required = false,
  placeholder = "Select settings...",
  description,
}: SettingsProps) {
  const ids = useMemo(() => settings_ids ?? [], [settings_ids]);
  const allSettings = useMemo(() => settings ?? [], [settings]);

  const hasPending = useMemo(
    () => allSettings.some((item) => item.pending),
    [allSettings],
  );

  const pendingIds = useMemo(
    () =>
      allSettings
        .filter((item) => item.pending && item.id)
        .map((item) => item.id!) ?? [],
    [allSettings],
  );

  const pickerItems = useMemo<SettingPickerItem[]>(
    () =>
      allSettings
        .filter((item): item is SettingResourceItem & { id: string } => !!item.id)
        .map((item) => {
          const itemDescription =
            item.description ||
            (item.department_ids?.length
              ? `${item.department_ids.length} departments`
              : undefined);
          return {
            id: item.id,
            name: item.name || `Setting ${item.id.slice(0, 8)}...`,
            ...(itemDescription ? { description: itemDescription } : {}),
            suggested: item.suggested,
            pending: item.pending,
          };
        }),
    [allSettings],
  );

  const itemIds = useMemo(
    () => pickerItems.map((item) => item.id),
    [pickerItems],
  );

  const handleReject = useCallback(() => {
    if (pendingIds.length === 0) return;
    onChange(ids.filter((itemId) => !pendingIds.includes(itemId)));
  }, [ids, onChange, pendingIds]);

  const handleAccept = useCallback(() => {
    // Pending selections are already reflected in selected ids.
    // The next draft save promotes them.
  }, []);

  if (allSettings.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label htmlFor={id} className="flex items-center gap-1">
          {label}
          {required && <span className="text-destructive">*</span>}
          {description && (
            <span className="ml-2 text-xs text-muted-foreground">
              {description}
            </span>
          )}
        </Label>
        {hasPending && (
          <>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-success hover:text-success"
                    onClick={handleAccept}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Accept</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={handleReject}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reject</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </>
        )}
      </div>

      <GenericPicker<SettingPickerItem>
        items={pickerItems}
        itemIds={itemIds}
        selectedIds={ids}
        onSelect={onChange}
        multiSelect={true}
        getId={(item) => item.id}
        getLabel={(item) => item.name}
        renderItem={(item, isSelected) => (
          <div
            className={cn(
              "flex w-full items-center justify-between",
              item.pending && "rounded ring-2 ring-success bg-success/10",
              item.suggested && !isSelected && "text-primary",
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{item.name}</div>
              {item.description && (
                <div className="truncate text-xs text-muted-foreground">
                  {item.description}
                </div>
              )}
            </div>
            <div className="ml-2 flex items-center gap-2 text-xs">
              {item.pending && <span className="text-success">Pending</span>}
              {item.suggested && !item.pending && (
                <span className="text-primary">Suggested</span>
              )}
            </div>
          </div>
        )}
        disabled={disabled}
        placeholder={placeholder}
      />
    </div>
  );
}
