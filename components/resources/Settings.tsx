/**
 * Settings.tsx
 * Multi-select settings picker. Card grid (SelectableGrid horizontal) with
 * suggested dot, pending badge, and accept/reject affordances — mirrors
 * Departments.tsx.
 */

"use client";

import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
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
  setting_id?: string | null;
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

interface SettingsGridItem {
  id: string;
  name: string;
  description?: string;
}

export interface SettingsProps {
  settings_ids?: string[];
  settings?: SettingResourceItem[];
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  label?: string;
  id?: string;
  required?: boolean;
  description?: string;
  /** Per-field pending lifecycle (multi-select). See Departments.tsx. */
  onAcceptPending?: (pendingIds: string[]) => void;
  onRejectPending?: (pendingIds: string[]) => void;
}

export function Settings({
  settings_ids,
  settings,
  disabled = false,
  onChange,
  label = "Settings",
  id = "settings",
  required = false,
  description,
  onAcceptPending,
  onRejectPending,
}: SettingsProps) {
  const ids = useMemo(() => settings_ids ?? [], [settings_ids]);
  const allSettings = useMemo(() => settings ?? [], [settings]);

  const pendingItems = useMemo(
    () => allSettings.filter((s) => s.pending && (s.setting_id ?? s.id)),
    [allSettings],
  );
  const showDiff = pendingItems.length > 0;
  const pendingIds = useMemo(
    () =>
      new Set(
        pendingItems
          .map((s) => s.setting_id ?? s.id)
          .filter(Boolean) as string[],
      ),
    [pendingItems],
  );

  const items = useMemo<SettingsGridItem[]>(
    () =>
      allSettings
        .filter((s) => s.id)
        .map((s) => {
          const fallbackDescription = s.department_ids?.length
            ? `${s.department_ids.length} department${
                s.department_ids.length === 1 ? "" : "s"
              }`
            : undefined;
          const desc = s.description || fallbackDescription;
          return {
            id: s.id!,
            name: s.name || `Setting ${s.id!.slice(0, 8)}`,
            ...(desc ? { description: desc } : {}),
          };
        }),
    [allSettings],
  );

  const isSuggested = useCallback(
    (settingId: string) => {
      const item = allSettings.find((x) => x.id === settingId);
      return item?.suggested === true;
    },
    [allSettings],
  );

  const handleSelect = useCallback(
    (itemId: string) => {
      onChange(
        ids.includes(itemId) ? ids.filter((x) => x !== itemId) : [...ids, itemId],
      );
    },
    [ids, onChange],
  );

  const handleAccept = useCallback(() => {
    if (onAcceptPending && pendingIds.size > 0) {
      onAcceptPending(Array.from(pendingIds));
    }
    // Pending items are already in selection — next save persists them.
  }, [onAcceptPending, pendingIds]);

  const handleReject = useCallback(() => {
    if (onRejectPending && pendingIds.size > 0) {
      onRejectPending(Array.from(pendingIds));
      return;
    }
    onChange(ids.filter((x) => !pendingIds.has(x)));
  }, [ids, pendingIds, onChange, onRejectPending]);

  if (allSettings.length === 0) return null;

  return (
    <div className="space-y-3 min-w-0 w-full">
      <div className="flex items-center gap-2">
        <Label htmlFor={id} className="flex items-center gap-1">
          {label}
          {required && <span className="text-destructive">*</span>}
          {description && (
            <span className="text-xs text-muted-foreground ml-2">
              {description}
            </span>
          )}
        </Label>
        {showDiff && (
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

      <SelectableGrid<SettingsGridItem>
        horizontal
        items={items}
        selectedId={null}
        selectedIds={ids}
        onSelect={handleSelect}
        getId={(item) => item.id}
        renderItem={(item, isSelected) => {
          const isPending = pendingIds.has(item.id);
          return (
            <div
              className={cn(
                "relative flex flex-col p-3 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left h-[88px]",
                "hover:shadow-md hover:bg-accent/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isSelected && !isPending && "ring-2 ring-primary bg-accent",
                isPending && "ring-2 ring-success bg-success/10",
              )}
            >
              {isSelected && !isPending && (
                <div className="absolute top-2 right-2 z-10 h-5 w-5 bg-primary rounded-full flex items-center justify-center">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </div>
              )}
              {isPending && (
                <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                  Pending
                </div>
              )}
              {isSuggested(item.id) && !isSelected && !isPending && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="absolute top-2 right-2 z-10 h-1.5 w-1.5 rounded-full bg-primary" />
                    </TooltipTrigger>
                    <TooltipContent side="top">Suggested</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <div className="flex flex-col justify-center flex-1 overflow-hidden">
                <span className="text-sm font-medium truncate">{item.name}</span>
                {item.description && (
                  <span className="text-xs text-muted-foreground line-clamp-2">
                    {item.description}
                  </span>
                )}
              </div>
            </div>
          );
        }}
        emptyMessage="No settings available."
        disabled={disabled}
      />
    </div>
  );
}
