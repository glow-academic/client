/**
 * Profiles.tsx
 * Resource component for profiles selection
 * Uses SelectableGrid for horizontal grid card layout (like Simulations.tsx)
 * Manages profile_ids array and reports to parent
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

export interface ProfileResourceItem {
  profile_id?: string | null;
  name?: string | null;
  description?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  pending?: boolean | null;
}

export interface ProfilesItem {
  id: string;
  name: string;
  description?: string;
}

export interface ProfilesProps {
  profile_ids?: string[]; // Current profiles artifact IDs (standardized prop name)
  profile_resources?: ProfileResourceItem[]; // Selected profiles resources (each includes generated field)
  show_profiles?: boolean; // Whether to show this resource picker
  profiles?: ProfileResourceItem[]; // All available profiles from API (each includes generated and suggested fields)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update profile_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  searchTerm?: string; // Search term for filtering profiles
  showSelectedFilter?: boolean; // Whether to show only selected profiles
}

export function Profiles({
  profile_ids,
  profile_resources: _profile_resources,
  show_profiles = false,
  profiles,
  disabled = false,
  onChange,
  label = "Profiles",
  id = "profiles",
  required = false,
  description,
  searchTerm = "",
  showSelectedFilter = false,
}: ProfilesProps) {
  const ids = useMemo(() => profile_ids ?? [], [profile_ids]);
  const show = show_profiles ?? false;
  const allProfiles = useMemo(() => profiles ?? [], [profiles]);
  // Pending state: items with pending=true from soft draft connections
  const pendingItems = useMemo(() => {
    return allProfiles.filter((p) => p.pending && p.profile_id);
  }, [allProfiles]);
  const pendingIds = useMemo(
    () =>
      new Set(
        pendingItems.map((p) => p.profile_id).filter(Boolean) as string[]
      ),
    [pendingItems]
  );
  const showDiff = pendingItems.length > 0;

  // Convert profiles array to ProfilesItem format for SelectableGrid
  const profileItems = useMemo(() => {
    return allProfiles
      .filter((p) => p.profile_id && p.name) // Filter out nulls
      .map((p) => ({
        id: p.profile_id!,
        name: p.name!,
        ...(p.description?.trim()
          ? { description: p.description.trim() }
          : {}),
      }));
  }, [allProfiles]);

  // Filter profiles based on search term and show selected filter
  const filteredProfileItems = useMemo(() => {
    let filtered = profileItems;

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((profile) => {
        const searchText =
          `${profile.name} ${profile.description || ""}`.toLowerCase();
        return searchText.includes(searchLower);
      });
    }

    // Apply show selected filter
    if (showSelectedFilter) {
      filtered = filtered.filter((profile) => ids.includes(profile.id));
    }

    return filtered;
  }, [profileItems, searchTerm, showSelectedFilter, ids]);

  // Check if a profile is suggested (derived from item.suggested field)
  const isSuggested = useCallback(
    (profileId: string) => {
      const profile = allProfiles.find((p) => p.profile_id === profileId);
      return profile?.suggested === true;
    },
    [allProfiles]
  );

  const handleSelect = useCallback(
    (profileId: string) => {
      const isSelected = ids.includes(profileId);
      const newIds = isSelected
        ? ids.filter((id) => id !== profileId)
        : [...ids, profileId];

      onChange(newIds);
    },
    [ids, onChange]
  );

  // Accept pending — keep pending profiles in selection
  const handleAccept = useCallback(() => {
    // Pending items are already in ids (selected=true), just confirm
    // The next draft save will persist them as active
    // Nothing to change in form state — they're already included
  }, []);

  // Reject pending — remove pending profiles from selection
  const handleReject = useCallback(() => {
    const newIds = ids.filter((id) => !pendingIds.has(id));
    onChange(newIds);
  }, [ids, pendingIds, onChange]);

  // Don't render if show_profiles is false (AFTER all hooks)
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
      <SelectableGrid<ProfilesItem>
        horizontal
        items={filteredProfileItems}
        selectedId={null}
        selectedIds={ids}
        onSelect={handleSelect}
        getId={(item) => item.id}
        renderItem={(item, isSelected) => {
          const isPending = showDiff && pendingIds.has(item.id);

          return (
            <div
              className={cn(
                "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                "hover:shadow-md hover:bg-accent/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isSelected && !isPending && "ring-2 ring-primary bg-accent",
                isPending && "ring-2 ring-success bg-success/10",
              )}
            >
              {/* Check icon - top right */}
              {isSelected && !isPending && (
                <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                  <Check className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
              )}

              {/* Pending badge - top right */}
              {isPending && (
                <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                  Pending
                </div>
              )}

              {/* Suggested dot indicator - top right */}
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

              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm leading-tight">
                  {item.name}
                </h3>
                {item.description && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <p className="truncate">{item.description}</p>
                  </div>
                )}
              </div>
            </div>
          );
        }}
        emptyMessage="No profiles found."
        disabled={disabled}
      />
    </div>
  );
}
