/**
 * Modalities.tsx
 * Resource component for modality selection
 * Uses GenericPicker to select existing modality resources
 * Manages modality_ids array and reports to parent
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

export interface ModalityResourceItem {
  id?: string | null;
  modality_id?: string | null;
  modality?: string | null;
  name?: string | null;
  description?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  pending?: boolean | null;
}

export interface ModalityItem {
  id: string;
  name: string;
  description?: string;
}

export interface ModalitiesProps {
  modality_ids?: string[]; // Current modality resource IDs (standardized prop name)
  modality_resources?: ModalityResourceItem[]; // Selected modality resources (each includes generated field)
  show_modalities?: boolean; // Whether to show this resource picker
  modalities?: ModalityResourceItem[]; // All available modalities from API (each includes generated and suggested fields)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update modality_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
}

export function Modalities({
  modality_ids,
  show_modalities = false,
  modalities,
  disabled = false,
  onChange,
  label = "Modalities",
  id = "modalities",
  required = false,
  placeholder = "Select modalities...",
  description,
  searchTerm,
  onSearchChange,
}: ModalitiesProps) {
  const ids = useMemo(() => modality_ids ?? [], [modality_ids]);
  const show = show_modalities ?? false;
  const allModalities = useMemo(() => modalities ?? [], [modalities]);

  // Pending state: items with pending=true from soft draft connections
  const pendingItems = useMemo(() => {
    return allModalities.filter((m) => m.pending && m.modality_id);
  }, [allModalities]);
  const showDiff = pendingItems.length > 0;
  const pendingIds = useMemo(
    () => new Set(pendingItems.map((m) => m.modality_id).filter(Boolean) as string[]),
    [pendingItems]
  );

  const filteredModalities = useMemo(() => {
    if (!searchTerm?.trim()) {
      return allModalities;
    }
    const term = searchTerm.toLowerCase();
    return allModalities.filter((modality) => {
      const name = modality.name?.toLowerCase() ?? "";
      const desc = modality.description?.toLowerCase() ?? "";
      return name.includes(term) || desc.includes(term);
    });
  }, [allModalities, searchTerm]);

  // Convert modalities array to ModalityItem format for GenericPicker
  const modalityItems = useMemo(() => {
    return filteredModalities
      .filter((m) => m.modality_id && m.name) // Filter out nulls
      .map((m) => ({
        id: m.modality_id!,
        name: m.name!,
        ...(m.description ? { description: m.description } : {}),
      }));
  }, [filteredModalities]);

  // Check if a modality is suggested (derived from item.suggested field)
  const isSuggested = useCallback(
    (modalityId: string) => {
      const mod = allModalities.find((m) => m.modality_id === modalityId);
      return mod?.suggested === true;
    },
    [allModalities]
  );

  const handleSelect = useCallback(
    (selectedIds: string[]) => {
      onChange(selectedIds);
    },
    [onChange]
  );

  // Accept pending — keep pending modalities in selection
  const handleAccept = useCallback(() => {
    // Pending items are already in ids (selected=true), just confirm
    // The next draft save will persist them as active
    // Nothing to change in form state — they're already included
  }, []);

  // Reject pending — remove pending modalities from selection
  const handleReject = useCallback(() => {
    const newIds = ids.filter((id) => !pendingIds.has(id));
    onChange(newIds);
  }, [ids, pendingIds, onChange]);

  // Don't render if show_modalities is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  return (
    <div className="space-y-2">
      {label && (
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
      )}
      <GenericPicker<ModalityItem>
        items={modalityItems}
        itemIds={filteredModalities
          .map((m) => m.modality_id)
          .filter((id): id is string => id !== null)} // All modality IDs from array, filter nulls
        selectedIds={ids}
        onSelect={handleSelect}
        multiSelect={true}
        getId={(item) => item.id}
        getLabel={(item) => item.name}
        renderItem={(item, isSelected) => {
          const isPending = pendingIds.has(item.id);

          return (
            <div className={cn(
              "flex items-center justify-between w-full",
              isPending && "ring-2 ring-success bg-success/10 rounded px-2 py-1 -mx-2 -my-1"
            )}>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {isPending && (
                  <span className="px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium shrink-0">
                    Pending
                  </span>
                )}
                {isSuggested(item.id) && !isSelected && !isPending && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                      </TooltipTrigger>
                      <TooltipContent side="top">Suggested</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                <div className="flex-1 min-w-0">
                  <div className="truncate">{item.name}</div>
                  {item.description && (
                    <div className="text-xs text-muted-foreground truncate">
                      {item.description}
                    </div>
                  )}
                </div>
              </div>
              {!isPending && (
                <Check
                  className={cn(
                    "ml-auto flex-shrink-0 h-4 w-4",
                    isSelected ? "opacity-100" : "opacity-0"
                  )}
                />
              )}
            </div>
          );
        }}
        {...(searchTerm !== undefined ? { initialSearchTerm: searchTerm } : {})}
        {...(onSearchChange ? { onSearchChange } : {})}
        placeholder={placeholder}
        disabled={disabled}
        showLabel={false}
        hideSelectedChips={false}
        showClearAll={true}
      />
    </div>
  );
}
