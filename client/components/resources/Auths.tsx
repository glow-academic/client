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
import { useResourceAi } from "@/hooks/use-resource-ai";
import type { OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useMemo } from "react";

// Derive resource item type from the GET endpoint response
type AuthsGetResponse = OutputOf<"/api/v4/resources/auths/get", "post">;
export type AuthsResourceItem = NonNullable<AuthsGetResponse["items"]>[number];

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
  auth_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  auths?: AuthsResourceItem[]; // All available auths from API
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update auth_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
  showAiGenerate?: boolean; // Whether to show AI generate button (computed server-side)
  // AI diff view props
  aiAuthResources?: Pick<AuthsResourceItem, "id" | "name">[] | null;
  onAccept?: () => void;
  onReject?: () => void;
}

export function Auths({
  auth_ids,
  auth_resources,
  show_auths = false,
  auth_suggestions,
  auths,
  disabled = false,
  onChange,
  label = "Auths",
  id = "auths",
  required = false,
  placeholder = "Select auths...",
  description,
  group_id,
  onGenerate,
  showAiGenerate = false,
}: AuthsProps) {
  const ids = useMemo(() => auth_ids ?? [], [auth_ids]);
  const show = show_auths ?? false;
  const allAuths = useMemo(() => auths ?? [], [auths]);

  // Socket-based AI suggestion handling via shared hook
  const { isGenerating: aiIsGenerating, aiSuggestions, clear: clearAi } = useResourceAi({
    resourceType: "auths",
    groupId: group_id,
    accumulate: true,
  });

  // AI suggestion state
  const showDiff = aiSuggestions.length > 0;
  const aiSuggestedIds = useMemo(
    () =>
      new Set(
        aiSuggestions
          .map((a) => a.id)
          .filter(Boolean) as string[]
      ),
    [aiSuggestions]
  );

  // Accept AI suggestion - add AI-suggested auths to selection
  const handleAccept = useCallback(() => {
    if (aiSuggestions.length === 0) return;
    const newIds = aiSuggestions
      .map((a) => a.id)
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
    () => auth_suggestions ?? [],
    [auth_suggestions]
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

  // Check if an auth is suggested
  const isSuggested = useCallback(
    (authId: string) => suggestionsList.includes(authId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    (selectedIds: string[]) => {
      // Update parent state
      onChange(selectedIds);
    },
    [onChange]
  );

  // Check if any auth resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return auth_resources?.some((a) => a.generated) ?? false;
  }, [auth_resources]);

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
