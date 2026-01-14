/**
 * Templates.tsx
 * Resource component for template selection
 * Uses GenericPicker to select existing template resources
 * Manages template_ids array and reports to parent
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
import type { InputOf, OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Check, Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";

type CreateDraftTemplatesIn = InputOf<"/api/v4/resources/templates", "post">;
type CreateDraftTemplatesOut = OutputOf<"/api/v4/resources/templates", "post">;

export interface TemplateItem {
  id: string;
  name: string;
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
    name?: string | null;
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
  searchTerm?: string; // Search term for filtering templates
  showSelectedFilter?: boolean; // Whether to show only selected templates
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
  searchTerm = "",
  showSelectedFilter = false,
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

  // Convert templates array to TemplateItem format for SelectableGrid
  const templateItems = useMemo(() => {
    return allTemplates
      .filter((t) => t.template_id && t.name) // Filter out nulls
      .map((t) => ({
        id: t.template_id!,
        name: t.name!,
      }));
  }, [allTemplates]);

  // Filter templates based on search term
  const filteredTemplates = useMemo(() => {
    let filtered = templateItems;

    // Apply search filter
    if (searchTerm && searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((template) => {
        const searchText = `${template.name} ${template.id}`.toLowerCase();
        return searchText.includes(searchLower);
      });
    }

    // Apply show selected filter
    if (showSelectedFilter) {
      filtered = filtered.filter((template) => ids.includes(template.id));
    }

    return filtered;
  }, [templateItems, searchTerm, showSelectedFilter, ids]);

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
      <SelectableGrid<TemplateItem>
        items={filteredTemplates}
        selectedId={null}
        selectedIds={ids}
        onSelect={(templateId) => {
          const isSelected = ids.includes(templateId);
          const newIds = isSelected
            ? ids.filter((id) => id !== templateId)
            : [...ids, templateId];
          handleSelect(newIds);
        }}
        getId={(item) => item.id}
        renderItem={(item, isSelected) => (
          <div
            className={cn(
              "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
              "hover:shadow-md hover:bg-accent/50",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isSelected && "ring-2 ring-primary bg-accent"
            )}
          >
            {/* Check icon - top right */}
            {isSelected && (
              <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                <Check className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
            )}

            {/* Suggested badge - top right */}
            {isSuggested(item.id) && !isSelected && (
              <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded">
                Suggested
              </div>
            )}

            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-sm leading-tight">{item.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {item.id.slice(0, 8)}...
              </p>
            </div>
          </div>
        )}
        emptyMessage="No templates found."
        disabled={disabled}
      />
    </div>
  );
}
