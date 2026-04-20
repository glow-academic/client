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

export interface SystemResourceItem {
  system_id?: string | null;
  name?: string | null;
  description?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  pending?: boolean | null;
}

type SystemItem = {
  id: string;
  name: string;
  description?: string;
};

export interface SystemsProps {
  system_ids?: string[];
  system_resources?: SystemResourceItem[];
  systems?: SystemResourceItem[];
  show_systems?: boolean;
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  label?: string;
  id?: string;
  required?: boolean;
  description?: string;
  searchTerm?: string;
  showSelectedFilter?: boolean;
}

export function Systems({
  system_ids,
  system_resources: _system_resources,
  systems,
  show_systems = false,
  disabled = false,
  onChange,
  label = "Systems",
  id = "systems",
  required = false,
  description,
  searchTerm = "",
  showSelectedFilter = false,
}: SystemsProps) {
  const ids = useMemo(() => system_ids ?? [], [system_ids]);
  const show = show_systems ?? false;
  const allSystems = useMemo(() => systems ?? [], [systems]);

  const pendingItems = useMemo(
    () => allSystems.filter((item) => item.pending && item.system_id),
    [allSystems]
  );
  const pendingIds = useMemo(
    () => new Set(pendingItems.map((item) => item.system_id).filter(Boolean) as string[]),
    [pendingItems]
  );
  const showDiff = pendingItems.length > 0;

  const systemItems = useMemo<SystemItem[]>(
    () =>
      allSystems
        .filter((item) => item.system_id && item.name)
        .map((item) => ({
          id: item.system_id!,
          name: item.name!,
          ...(item.description?.trim() ? { description: item.description.trim() } : {}),
        })),
    [allSystems]
  );

  const filteredSystemItems = useMemo(() => {
    let filtered = systemItems;
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((item) =>
        `${item.name} ${item.description ?? ""}`.toLowerCase().includes(searchLower)
      );
    }
    if (showSelectedFilter) {
      filtered = filtered.filter((item) => ids.includes(item.id));
    }
    return filtered;
  }, [ids, searchTerm, showSelectedFilter, systemItems]);

  const isSuggested = useCallback(
    (systemId: string) =>
      allSystems.find((item) => item.system_id === systemId)?.suggested === true,
    [allSystems]
  );

  const handleSelect = useCallback(
    (systemId: string) => {
      const isSelected = ids.includes(systemId);
      const nextIds = isSelected
        ? ids.filter((id) => id !== systemId)
        : [...ids, systemId];
      onChange(nextIds);
    },
    [ids, onChange]
  );

  const handleAccept = useCallback(() => {
    // Pending systems remain selected; the next non-pending draft save confirms them.
  }, []);

  const handleReject = useCallback(() => {
    onChange(ids.filter((itemId) => !pendingIds.has(itemId)));
  }, [ids, onChange, pendingIds]);

  if (!show) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label htmlFor={id} className="flex items-center gap-1">
          {label}
          {required && <span className="text-destructive">*</span>}
          {description && (
            <span className="text-xs text-muted-foreground ml-2">{description}</span>
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
      <SelectableGrid
        items={filteredSystemItems}
        selectedId={null}
        selectedIds={ids}
        onSelect={handleSelect}
        getId={(item) => item.id}
        renderItem={(item, isSelected) => (
          <div
            className={cn(
              "rounded-md border p-3 transition-colors",
              isSelected && "border-primary bg-primary/5",
              pendingIds.has(item.id) && "border-amber-500 bg-amber-50/60"
            )}
          >
            <div className="font-medium text-sm">{item.name}</div>
            {item.description ? (
              <div className="text-xs text-muted-foreground mt-1">
                {item.description}
              </div>
            ) : null}
            {isSuggested(item.id) ? (
              <div className="text-[10px] uppercase tracking-wide text-primary mt-2">
                Suggested
              </div>
            ) : null}
          </div>
        )}
        disabled={disabled}
      />
    </div>
  );
}
