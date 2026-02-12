/**
 * Slugs.tsx
 * Resource component for slug selection
 * Uses GenericPicker to select existing slug resources
 * Manages slug_ids array and reports to parent
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
import type { InputOf, OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";

type CreateDraftSlugsIn = InputOf<"/api/v4/resources/slugs", "post">;
type CreateDraftSlugsOut = OutputOf<"/api/v4/resources/slugs", "post">;

export interface SlugItem {
  id: string;
  value: string;
}

export interface SlugsProps {
  slug_ids?: string[]; // Current slug resource IDs (standardized prop name)
  slug_resources?: Array<{
    id: string | null;
    value: string | null;
    generated?: boolean | null;
  }>; // Selected slug resources (each includes generated field)
  show_slugs?: boolean; // Whether to show this resource picker
  slug_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  slugs?: Array<{
    id: string | null;
    value: string | null;
    generated?: boolean | null;
  }>; // All available slugs from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update slug_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  create_tool_id?: string | null; // Tool ID for AI generation/creation
  createSlugsAction?:
    | ((input: CreateDraftSlugsIn) => Promise<CreateDraftSlugsOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
  showAiGenerate?: boolean; // Whether to show AI generate button (computed server-side)
  // AI diff view props
  aiSlugResources?: Array<{ id?: string | null; value?: string | null }> | null;
  onAccept?: () => void;
  onReject?: () => void;
  /** When false, skip automatic resource creation (manual save mode) */
  isAutosaveEnabled?: boolean;
  /** Register a flush callback with parent for manual save - returns created IDs */
  registerFlush?: (flush: () => Promise<{ slug_ids: string[] | null } | void>) => void;
}

export function Slugs({
  slug_ids,
  slug_resources,
  show_slugs = false,
  slug_suggestions,
  slugs,
  disabled = false,
  onChange,
  label = "Slugs",
  id = "slugs",
  required = false,
  placeholder = "Select slugs...",
  description,
  group_id,
  create_tool_id,
  createSlugsAction,
  onGenerate,
  isGenerating = false,
  showAiGenerate = false,
  // AI diff view props
  aiSlugResources,
  onAccept,
  onReject,
  isAutosaveEnabled = true,
  registerFlush,
}: SlugsProps) {
  const ids = useMemo(() => slug_ids ?? [], [slug_ids]);
  const show = show_slugs ?? false;
  const allSlugs = useMemo(() => slugs ?? [], [slugs]);
  const suggestionsList = useMemo(
    () => slug_suggestions ?? [],
    [slug_suggestions]
  );

  // Track which slug IDs have already had resources created
  const createdSlugIdsRef = useRef<Set<string>>(new Set());

  // Initialize createdSlugIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdSlugIdsRef.current.add(id));
  }, [ids]);

  // Ref for flush function (stable reference for registerFlush)
  const flushRef = useRef<(() => Promise<{ slug_ids: string[] | null } | void>) | undefined>(undefined);

  // Update flush function when dependencies change
  flushRef.current = async (): Promise<{ slug_ids: string[] | null } | void> => {
    // Skip if no action available
    if (!createSlugsAction || !group_id) {
      return;
    }

    // Find IDs that haven't been created yet
    const uncreatedIds = ids.filter((id) => !createdSlugIdsRef.current.has(id));

    if (uncreatedIds.length === 0) {
      return { slug_ids: ids };
    }

    try {
      for (const slugId of uncreatedIds) {
        await createSlugsAction({
          body: {
            group_id: group_id,
            slug_id: slugId,
            mcp: false,
          },
        });
        createdSlugIdsRef.current.add(slugId);
      }
      return { slug_ids: ids };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to create slug resources:", error);
      throw error;
    }
  };

  // Register flush callback with parent
  useEffect(() => {
    if (registerFlush) {
      registerFlush(() => flushRef.current?.() ?? Promise.resolve());
    }
  }, [registerFlush]);

  // Convert slugs array to SlugItem format for GenericPicker
  const slugItems = useMemo(() => {
    return allSlugs
      .filter((s) => s.id && s.value) // Filter out nulls
      .map((s) => ({
        id: s.id!,
        value: s.value!,
      }));
  }, [allSlugs]);

  // Check if a slug is suggested
  const isSuggested = useCallback(
    (slugId: string) => suggestionsList.includes(slugId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    async (selectedIds: string[]) => {
      // Find newly selected IDs
      const newlySelected = selectedIds.filter(
        (id) => !ids.includes(id) && !createdSlugIdsRef.current.has(id)
      );

      // Create resources for newly selected slugs - only when autosave is enabled
      if (
        isAutosaveEnabled &&
        newlySelected.length > 0 &&
        createSlugsAction &&
        create_tool_id &&
        group_id
      ) {
        for (const slugId of newlySelected) {
          try {
            await createSlugsAction({
              body: {
                group_id: group_id,
                slug_id: slugId,
                mcp: false,
              },
            });
            createdSlugIdsRef.current.add(slugId);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(
              `Failed to create slug resource for ${slugId}:`,
              error
            );
            // Don't block UI - still update selection
          }
        }
      }

      // Update parent state
      onChange(selectedIds);
    },
    [ids, onChange, createSlugsAction, create_tool_id, group_id, isAutosaveEnabled]
  );

  // Check if any slug resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return slug_resources?.some((s) => s.generated) ?? false;
  }, [slug_resources]);

  // AI suggestion state
  const showDiff = !!aiSlugResources?.length;

  // Get AI-suggested IDs (kept for potential future use)
  const _aiSuggestedIds = useMemo(
    () => new Set(aiSlugResources?.map((r) => r.id).filter(Boolean) as string[]),
    [aiSlugResources]
  );

  // Accept AI suggestion - add AI-suggested slugs to selection
  const handleAccept = useCallback(() => {
    if (!aiSlugResources?.length) return;
    const newIds = aiSlugResources
      .map((s) => s.id)
      .filter((id): id is string => !!id);
    if (newIds.length > 0) {
      onChange([...ids, ...newIds]);
    }
    onAccept?.();
  }, [aiSlugResources, ids, onChange, onAccept]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    onReject?.();
  }, [onReject]);

  // Don't render if show_slugs is false (AFTER all hooks)
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
          {onGenerate && showAiGenerate && create_tool_id && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onGenerate}
                    disabled={disabled || isGenerating || showDiff}
                  >
                    {isGenerating ? (
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
      {/* AI-suggested slugs preview */}
      {showDiff && aiSlugResources && aiSlugResources.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-sm font-medium text-success">AI Suggested Slugs</p>
          <div className="space-y-2">
            {aiSlugResources.map((item, idx) => (
              <div
                key={item.id || idx}
                className={cn(
                  "p-3 rounded-lg border-2 border-success bg-success/10",
                  "text-sm"
                )}
              >
                {item.value || ""}
              </div>
            ))}
          </div>
        </div>
      )}
      <GenericPicker<SlugItem>
        items={slugItems}
        itemIds={allSlugs
          .map((s) => s.id)
          .filter((id): id is string => id !== null)} // All slug IDs from array, filter nulls
        selectedIds={ids}
        onSelect={handleSelect}
        multiSelect={true}
        getId={(item) => item.id}
        getLabel={(item) => item.value}
        renderItem={(item, isSelected) => (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {isSuggested(item.id) && !isSelected && (
                <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded shrink-0">
                  Suggested
                </span>
              )}
              <div className="flex-1 min-w-0">
                <div className="truncate">{item.value}</div>
              </div>
            </div>
            <Check
              className={cn(
                "ml-auto flex-shrink-0 h-4 w-4",
                isSelected ? "opacity-100" : "opacity-0"
              )}
            />
          </div>
        )}
        placeholder={placeholder}
        disabled={disabled}
        showLabel={false}
        hideSelectedChips={false}
        showClearAll={true}
      />
    </div>
  );
}
