/**
 * Templates.tsx
 * Resource component for template selection
 * Uses GenericPicker to select existing template resources
 * Manages template_ids array and reports to parent
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

type CreateDraftTemplatesIn = InputOf<"/api/v4/resources/templates", "post">;
type CreateDraftTemplatesOut = OutputOf<"/api/v4/resources/templates", "post">;

export interface TemplateItem {
  id: string;
  name?: string;
}

export interface TemplatesProps {
  template_ids?: string[]; // Current template resource IDs (standardized prop name)
  template_resources?: Array<{
    template_id: string | null;
    generated?: boolean | null;
  }>; // Selected template resources (each includes generated field)
  show_templates?: boolean; // Whether to show this resource picker
  template_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  templates?: Array<{
    template_id: string | null;
    generated?: boolean | null;
  }>; // All available templates from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update template_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  templates_agent_id?: string | null; // Agent ID for resource creation
  createTemplatesAction?:
    | ((input: CreateDraftTemplatesIn) => Promise<CreateDraftTemplatesOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
}

export function Templates({
  template_ids,
  template_resources,
  show_templates = false,
  template_suggestions,
  templates,
  disabled = false,
  onChange,
  label = "Templates",
  id = "templates",
  required = false,
  placeholder = "Select templates...",
  description,
  group_id,
  templates_agent_id,
  createTemplatesAction,
  onGenerate,
  isGenerating = false,
}: TemplatesProps) {
  const ids = useMemo(() => template_ids ?? [], [template_ids]);
  const show = show_templates ?? false;
  const allTemplates = useMemo(() => templates ?? [], [templates]);
  const suggestionsList = useMemo(
    () => template_suggestions ?? [],
    [template_suggestions]
  );

  // Track which template IDs have already had resources created
  const createdTemplateIdsRef = useRef<Set<string>>(new Set());

  // Initialize createdTemplateIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdTemplateIdsRef.current.add(id));
  }, [ids]);

  // Convert templates array to TemplateItem format for GenericPicker
  const templateItems = useMemo(() => {
    return allTemplates
      .filter((t) => t.template_id) // Filter out nulls
      .map((t) => ({
        id: t.template_id!,
      }));
  }, [allTemplates]);

  // Check if a template is suggested
  const isSuggested = useCallback(
    (templateId: string) => suggestionsList.includes(templateId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    async (selectedIds: string[]) => {
      // Find newly selected IDs
      const newlySelected = selectedIds.filter(
        (id) => !ids.includes(id) && !createdTemplateIdsRef.current.has(id)
      );

      // Create resources for newly selected templates
      if (
        newlySelected.length > 0 &&
        createTemplatesAction &&
        templates_agent_id &&
        group_id
      ) {
        for (const templateId of newlySelected) {
          try {
            await createTemplatesAction({
              body: {
                agent_id: templates_agent_id,
                group_id: group_id,
                template_id: templateId,
                mcp: false,
              },
            });
            createdTemplateIdsRef.current.add(templateId);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(
              `Failed to create template resource for ${templateId}:`,
              error
            );
            // Don't block UI - still update selection
          }
        }
      }

      // Update parent state
      onChange(selectedIds);
    },
    [ids, onChange, createTemplatesAction, templates_agent_id, group_id]
  );

  // Check if any template resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return template_resources?.some((t) => t.generated) ?? false;
  }, [template_resources]);

  // Don't render if show_templates is false (AFTER all hooks)
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
          {onGenerate && templates_agent_id && (
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
      <GenericPicker<TemplateItem>
        items={templateItems}
        itemIds={allTemplates
          .map((t) => t.template_id)
          .filter((id): id is string => id !== null)} // All template IDs from array, filter nulls
        selectedIds={ids}
        onSelect={handleSelect}
        multiSelect={true}
        getId={(item) => item.id}
        getLabel={(item) => item.name || item.id} // Use name if available, otherwise ID
        renderItem={(item, isSelected) => (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {isSuggested(item.id) && !isSelected && (
                <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded shrink-0">
                  Suggested
                </span>
              )}
              <div className="flex-1 min-w-0">
                <div className="truncate">{item.name || item.id}</div>
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
