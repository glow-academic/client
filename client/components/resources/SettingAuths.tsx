/**
 * SettingAuths.tsx
 * Multi-select resource component for auths in settings
 * Follows Departments.tsx pattern for multi-select resources
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
import { Check, Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";

type CreateDraftAuthsIn = InputOf<"/api/v4/resources/auths", "post">;
type CreateDraftAuthsOut = OutputOf<"/api/v4/resources/auths", "post">;

export interface SettingAuthItem {
  id: string;
  name: string;
  description?: string;
  slug?: string;
  active?: boolean;
}

export interface SettingAuthsProps {
  auth_ids?: string[]; // Current auth resource IDs (standardized prop name)
  auth_resources?: Array<{
    auth_id: string | null;
    name: string | null;
    description: string | null;
    slug: string | null;
    active: boolean | null;
    auth_items?: Array<{
      id: string | null;
      name: string | null;
      description: string | null;
      encrypted: boolean | null;
    }> | null;
    generated?: boolean | null;
  }>; // Selected auth resources (each includes generated field)
  show_auths?: boolean; // Whether to show this resource picker
  auth_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  auths?: Array<{
    auth_id: string | null;
    name: string | null;
    description: string | null;
    slug: string | null;
    active: boolean | null;
    auth_items?: Array<{
      id: string | null;
      name: string | null;
      description: string | null;
      encrypted: boolean | null;
    }> | null;
    generated?: boolean | null;
  }>; // All available auths from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update auth_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  agent_id?: string | null; // Agent ID for resource creation
  createAuthsAction?:
    | ((input: CreateDraftAuthsIn) => Promise<CreateDraftAuthsOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
}

export function SettingAuths({
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
  agent_id,
  createAuthsAction,
  onGenerate,
  isGenerating = false,
}: SettingAuthsProps) {
  const ids = useMemo(() => auth_ids ?? [], [auth_ids]);
  const show = show_auths ?? false;
  const allAuths = useMemo(() => auths ?? [], [auths]);
  const suggestionsList = useMemo(
    () => auth_suggestions ?? [],
    [auth_suggestions]
  );

  // Track which auth IDs have already had resources created
  const createdAuthIdsRef = useRef<Set<string>>(new Set());

  // Initialize createdAuthIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdAuthIdsRef.current.add(id));
  }, [ids]);

  // Convert auths array to SettingAuthItem format for GenericPicker
  const authItems = useMemo(() => {
    return allAuths
      .filter((a) => a.auth_id && a.name) // Filter out nulls
      .map((a) => ({
        id: a.auth_id!,
        name: a.name!,
        ...(a.description ? { description: a.description } : {}),
        ...(a.slug ? { slug: a.slug } : {}),
        ...(a.active !== null ? { active: a.active } : {}),
      }));
  }, [allAuths]);

  // Check if an auth is suggested
  const isSuggested = useCallback(
    (authId: string) => suggestionsList.includes(authId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    async (selectedIds: string[]) => {
      // Find newly selected IDs
      const newlySelected = selectedIds.filter(
        (id) => !ids.includes(id) && !createdAuthIdsRef.current.has(id)
      );

      // Create resources for newly selected auths
      if (
        newlySelected.length > 0 &&
        createAuthsAction &&
        agent_id &&
        group_id
      ) {
        for (const authId of newlySelected) {
          try {
            await createAuthsAction({
              body: {
                agent_id: agent_id,
                group_id: group_id,
                auth_id: authId,
                mcp: false,
              },
            });
            createdAuthIdsRef.current.add(authId);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(
              `Failed to create auth resource for ${authId}:`,
              error
            );
            // Don't block UI - still update selection
          }
        }
      }

      // Update parent state
      onChange(selectedIds);
    },
    [ids, onChange, createAuthsAction, agent_id, group_id]
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
          {onGenerate && agent_id && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onGenerate}
                    disabled={disabled || isGenerating}
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
        </div>
      )}
      <GenericPicker<SettingAuthItem>
        items={authItems}
        itemIds={allAuths
          .map((a) => a.auth_id)
          .filter((id): id is string => id !== null)} // All auth IDs from array, filter nulls
        selectedIds={ids}
        onSelect={handleSelect}
        multiSelect={true}
        getId={(item) => item.id}
        getLabel={(item) => item.name}
        renderItem={(item, isSelected) => (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {isSuggested(item.id) && !isSelected && (
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
