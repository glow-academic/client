/**
 * Auths.tsx
 * Resource component for auth selection
 * Uses GenericPicker to select existing auth resources
 * Manages auth_ids array and reports to parent
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

export interface AuthsResourceItem {
  id?: string | null;
  name?: string | null;
  description?: string | null;
  slug?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  pending?: boolean | null;
}

export interface AuthItem {
  id: string;
  name: string;
  description?: string;
  slug?: string;
  active?: boolean;
}

export interface AuthsProps {
  auth_ids?: string[]; // Current auth resource IDs (standardized prop name)
  auth_resources?: AuthsResourceItem[]; // Selected auth resources
  show_auths?: boolean; // Whether to show this resource picker
  auths?: AuthsResourceItem[]; // All available auths from API (each includes generated and suggested fields)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update auth_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  aiAuthResources?: Pick<AuthsResourceItem, "id" | "name">[] | null;
}

export function Auths({
  auth_ids,
  auth_resources: _auth_resources,
  show_auths = false,
  auths,
  disabled = false,
  onChange,
  label = "Auths",
  id = "auths",
  required = false,
  placeholder = "Select auths...",
  description,
  aiAuthResources: _aiAuthResources,
}: AuthsProps) {
  const ids = useMemo(() => auth_ids ?? [], [auth_ids]);
  const show = show_auths ?? false;
  const allAuths = useMemo(() => auths ?? [], [auths]);

  // Pending state: items with pending=true from soft draft connections
  const pendingItems = useMemo(() => {
    return allAuths.filter((a) => a.pending && a.id);
  }, [allAuths]);
  const showDiff = pendingItems.length > 0;
  const pendingIds = useMemo(
    () => new Set(pendingItems.map((a) => a.id).filter(Boolean) as string[]),
    [pendingItems]
  );

  // Convert auths array to AuthItem format for GenericPicker
  const authItems = useMemo(() => {
    return allAuths
      .filter((a) => a.id && a.name) // Filter out nulls
      .map((a) => ({
        id: a.id!,
        name: a.name!,
        ...(a.description ? { description: a.description } : {}),
        ...(a.slug ? { slug: a.slug } : {}),
      }));
  }, [allAuths]);

  // Check if an auth is suggested (derived from item.suggested field)
  const isSuggested = useCallback(
    (authId: string) => {
      const auth = allAuths.find((a) => a.id === authId);
      return auth?.suggested === true;
    },
    [allAuths]
  );

  const handleSelect = useCallback(
    (selectedIds: string[]) => {
      onChange(selectedIds);
    },
    [onChange]
  );

  // Accept pending — keep pending auths in selection
  const handleAccept = useCallback(() => {
    // Pending items are already in ids (selected=true), just confirm
    // The next draft save will persist them as active
    // Nothing to change in form state — they're already included
  }, []);

  // Reject pending — remove pending auths from selection
  const handleReject = useCallback(() => {
    const newIds = ids.filter((id) => !pendingIds.has(id));
    onChange(newIds);
  }, [ids, pendingIds, onChange]);

  // Don't render if show_auths is false (AFTER all hooks)
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
      <GenericPicker<AuthItem>
        items={authItems}
        itemIds={allAuths
          .map((a) => a.id)
          .filter((id): id is string => id !== null)} // All auth IDs from array, filter nulls
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
              isPending && "ring-2 ring-success bg-success/10 rounded"
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
                  {item.slug && (
                    <div className="text-xs text-muted-foreground truncate">
                      {item.slug}
                    </div>
                  )}
                </div>
              </div>
              <Check
                className={cn(
                  "ml-auto flex-shrink-0 h-4 w-4",
                  isSelected && !isPending ? "opacity-100" : "opacity-0"
                )}
              />
            </div>
          );
        }}
        placeholder={placeholder}
        disabled={disabled}
        showLabel={false}
        hideSelectedChips={false}
        showClearAll={true}
      />
    </div>
  );
}
