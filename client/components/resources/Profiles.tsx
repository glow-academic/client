/**
 * Profiles.tsx
 * Resource component for profiles selection
 * Uses GenericPicker to select existing profiles artifacts
 * Manages profile_ids array and reports to parent
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
import { useResourceAi } from "@/hooks/use-resource-ai";
import type { OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useMemo } from "react";

// Derive resource item type from the GET endpoint response
type ProfileGetResponse = OutputOf<"/api/v4/resources/profiles/get", "post">;
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
  isGenerating?: boolean;
  // AI diff view props
  aiProfileResources?: Array<{
    profile_id?: string | null;
    name?: string | null;
  }> | null;
  onAccept?: () => void;
  onReject?: () => void;
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
  placeholder = "Select profiles...",
  description,
  group_id,
  onGenerate,
  showAiGenerate = false,
}: ProfilesProps) {
  const ids = useMemo(() => profile_ids ?? [], [profile_ids]);
  const show = show_profiles ?? false;
  const allProfiles = useMemo(() => profiles ?? [], [profiles]);

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
          .map((p) => p.profile_id)
          .filter(Boolean) as string[]
      ),
    [aiSuggestions]
  );

  // Accept AI suggestion - add AI-suggested profiles to selection
  const handleAccept = useCallback(() => {
    if (aiSuggestions.length === 0) return;
    const newIds = aiSuggestions
      .map((p) => p.profile_id)
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

  const suggestionsList = useMemo(
    () => profile_suggestions ?? [],
    [profile_suggestions]
  );

  // Convert profiles array to ProfilesItem format for GenericPicker
  const profilesItems = useMemo(() => {
    return allProfiles
      .filter((p) => p.profile_id && p.name) // Filter out nulls
      .map((p) => ({
        id: p.profile_id!,
        name: p.name!,
        ...(p.description ? { description: p.description } : {}),
      }));
  }, [allProfiles]);

  // Check if a profiles is suggested
  const isSuggested = useCallback(
    (profilesId: string) => suggestionsList.includes(profilesId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    (selectedIds: string[]) => {
      // Update parent state
      onChange(selectedIds);
    },
    [onChange]
  );

  // Check if any profiles resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return profile_resources?.some((p) => p.generated) ?? false;
  }, [profile_resources]);

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
      <GenericPicker<ProfilesItem>
        items={profilesItems}
        itemIds={allProfiles
          .map((p) => p.profile_id)
          .filter((id): id is string => id !== null)} // All profiles IDs from array, filter nulls
        selectedIds={ids}
        onSelect={handleSelect}
        multiSelect={true}
        getId={(item) => item.id}
        getLabel={(item) => item.name}
        renderItem={(item, isSelected) => {
          const isAiSuggested = showDiff && aiSuggestedIds.has(item.id);

          return (
            <div className={cn(
              "flex items-center justify-between w-full",
              isAiSuggested && !isSelected && "ring-2 ring-success bg-success/10 rounded"
            )}>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {isAiSuggested && !isSelected && (
                  <span className="px-1.5 py-0.5 bg-success/20 text-success text-xs rounded shrink-0">
                    AI Suggested
                  </span>
                )}
                {isSuggested(item.id) && !isSelected && !isAiSuggested && (
                  <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded shrink-0">
                    Suggested
                  </span>
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
              <Check
                className={cn(
                  "ml-auto flex-shrink-0 h-4 w-4",
                  isSelected ? "opacity-100" : "opacity-0"
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
