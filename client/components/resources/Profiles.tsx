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
import { useResourceAi } from "@/hooks/use-resource-ai";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useMemo } from "react";

// Link types for tool call tracking
type LinkProfilesIn = InputOf<"/api/v5/resources/profiles/link", "post">;
type LinkProfilesOut = OutputOf<"/api/v5/resources/profiles/link", "post">;

// Derive resource item type from the GET endpoint response
type ProfileGetResponse = OutputOf<"/api/v5/resources/profiles/get", "post">;
export type ProfileResourceItem = NonNullable<ProfileGetResponse["items"]>[number];

export interface ProfilesItem {
  id: string;
  name: string;
  description?: string;
}

export interface ProfilesProps {
  profile_ids?: string[]; // Current profiles artifact IDs (standardized prop name)
  profile_resources?: Array<{
    profile_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>; // Selected profiles resources (each includes generated field)
  show_profiles?: boolean; // Whether to show this resource picker
  profile_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  profiles?: Array<{
    profile_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>; // All available profiles from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update profile_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  onGenerate?: () => void | Promise<void>;
  showAiGenerate?: boolean; // Whether to show AI generate button (computed server-side)
  searchTerm?: string; // Search term for filtering profiles
  showSelectedFilter?: boolean; // Whether to show only selected profiles
  // Link tool call tracking
  link_tool_id?: string | null;
  linkProfilesAction?: (input: LinkProfilesIn) => Promise<LinkProfilesOut>;
  aiProfileResources?: Array<{
    profile_id?: string | null;
    name?: string | null;
  }> | null;
}

export function Profiles({
  profile_ids,
  profile_resources,
  show_profiles = false,
  profile_suggestions,
  profiles,
  disabled = false,
  onChange,
  label = "Profiles",
  id = "profiles",
  required = false,
  description,
  group_id,
  onGenerate,
  showAiGenerate = false,
  searchTerm = "",
  showSelectedFilter = false,
  link_tool_id,
  linkProfilesAction,
}: ProfilesProps) {
  const ids = useMemo(() => profile_ids ?? [], [profile_ids]);
  const show = show_profiles ?? false;
  const allProfiles = useMemo(() => profiles ?? [], [profiles]);
  const suggestionsList = useMemo(
    () => profile_suggestions ?? [],
    [profile_suggestions]
  );

  // Socket-based AI suggestion handling via shared hook
  const { isGenerating: aiIsGenerating, aiSuggestions, clear: clearAi } = useResourceAi({
    resourceType: "profiles",
    groupId: group_id,
    accumulate: true,
  });

  // AI suggestion state
  const showDiff = aiSuggestions.length > 0;
  const aiSuggestedIds = useMemo(
    () =>
      new Set(
        aiSuggestions
          .map((p) => p.id)
          .filter(Boolean) as string[]
      ),
    [aiSuggestions]
  );

  // Convert profiles array to ProfilesItem format for SelectableGrid
  const profileItems = useMemo(() => {
    return allProfiles
      .filter((p) => p.profile_id && p.name) // Filter out nulls
      .map((p) => ({
        id: p.profile_id!,
        name: p.name!,
        ...(p.description?.trim() ? { description: p.description.trim() } : {}),
      }));
  }, [allProfiles]);

  // Filter profiles based on search term and show selected filter
  const filteredProfileItems = useMemo(() => {
    let filtered = profileItems;

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((profile) => {
        const searchText = `${profile.name} ${profile.description || ""}`.toLowerCase();
        return searchText.includes(searchLower);
      });
    }

    // Apply show selected filter
    if (showSelectedFilter) {
      filtered = filtered.filter((profile) => ids.includes(profile.id));
    }

    return filtered;
  }, [profileItems, searchTerm, showSelectedFilter, ids]);

  // Check if a profile is suggested
  const isSuggested = useCallback(
    (profileId: string) => suggestionsList.includes(profileId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    (profileId: string) => {
      const isSelected = ids.includes(profileId);
      const newIds = isSelected
        ? ids.filter((id) => id !== profileId)
        : [...ids, profileId];

      // Fire link tracking when adding (not removing)
      if (!isSelected && linkProfilesAction && group_id && link_tool_id) {
        linkProfilesAction({
          body: { resource_id: profileId, group_id, tool_id: link_tool_id },
        }).catch(() => {});
      }

      onChange(newIds);
    },
    [ids, onChange, linkProfilesAction, group_id, link_tool_id]
  );

  // Check if any profile resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return profile_resources?.some((p) => p.generated) ?? false;
  }, [profile_resources]);

  // Accept AI suggestion - add AI-suggested profiles to selection
  const handleAccept = useCallback(() => {
    if (aiSuggestions.length === 0) return;
    const newIds = aiSuggestions
      .map((p) => p.id)
      .filter((id): id is string => !!id && !ids.includes(id));
    if (newIds.length > 0) {
      onChange([...ids, ...newIds]);
    }
    clearAi();
  }, [aiSuggestions, ids, onChange, clearAi]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    clearAi();
  }, [clearAi]);

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
          {onGenerate && showAiGenerate && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onGenerate}
                    disabled={disabled || aiIsGenerating || showDiff}
                  >
                    {aiIsGenerating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {hasGenerated ? "Regenerate" : "Generate"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
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
          const isAiSuggested = showDiff && aiSuggestedIds.has(item.id);

          return (
            <div
              className={cn(
                "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                "hover:shadow-md hover:bg-accent/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isSelected && "ring-2 ring-primary bg-accent",
                isAiSuggested && !isSelected && "ring-2 ring-success bg-success/10"
              )}
            >
              {/* Check icon - top right */}
              {isSelected && (
                <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                  <Check className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
              )}

              {/* AI Suggested badge - top right */}
              {isAiSuggested && !isSelected && (
                <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                  AI Suggested
                </div>
              )}

              {/* Suggested badge - top right */}
              {isSuggested(item.id) && !isSelected && !isAiSuggested && (
                <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded">
                  Suggested
                </div>
              )}

              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm leading-tight">{item.name}</h3>
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
