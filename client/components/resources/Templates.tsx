/**
 * Templates.tsx
 * Resource component for template selection
 * Uses GenericPicker to select existing template resources
 * Manages template_ids array and reports to parent
 */

"use client";

import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Check, Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CreateDraftTemplatesIn = InputOf<"/api/v4/resources/templates", "post">;
type CreateDraftTemplatesOut = OutputOf<"/api/v4/resources/templates", "post">;
type UpdateTemplatesIn = {
  body: {
    template_id: string;
    html: string;
    name?: string | null;
    description?: string | null;
  };
};
type UpdateTemplatesOut = {
  template_id: string | null;
};

export interface TemplateItem {
  id: string;
  name: string;
  description?: string | null;
  html?: string | null;
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
    description?: string | null;
    html?: string | null;
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
  updateTemplatesAction?:
    | ((input: UpdateTemplatesIn) => Promise<UpdateTemplatesOut>)
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
  updateTemplatesAction,
  onGenerate,
  isGenerating = false,
  searchTerm = "",
  showSelectedFilter = false,
}: TemplatesProps) {
  const createCardId = "__create_template__";
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
  const templateItems = useMemo<TemplateItem[]>(() => {
    return allTemplates
      .filter((t) => t.template_id && t.name) // Filter out nulls
      .map((t) => ({
        id: t.template_id!,
        name: t.name!,
        description: t.description ?? null,
        html: t.html ?? null,
      }));
  }, [allTemplates]);

  const [createdTemplates, setCreatedTemplates] = useState<TemplateItem[]>([]);

  const mergedTemplates = useMemo<TemplateItem[]>(() => {
    const map = new Map<string, TemplateItem>();
    templateItems.forEach((item) => map.set(item.id, item));
    createdTemplates.forEach((item) => {
      if (!map.has(item.id)) {
        map.set(item.id, item);
      }
    });
    return Array.from(map.values());
  }, [templateItems, createdTemplates]);

  // Filter templates based on search term
  const filteredTemplates = useMemo(() => {
    let filtered = mergedTemplates;

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
  }, [mergedTemplates, searchTerm, showSelectedFilter, ids]);

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

  const templatesById = useMemo(() => {
    const mapping: Record<string, TemplateItem> = {};
    mergedTemplates.forEach((template) => {
      mapping[template.id] = template;
    });
    return mapping;
  }, [mergedTemplates]);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorTemplateId, setEditorTemplateId] = useState<string | null>(null);
  const [editorValue, setEditorValue] = useState("");
  const [editorName, setEditorName] = useState("");
  const [editorDescription, setEditorDescription] = useState("");
  const [isNewTemplate, setIsNewTemplate] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [htmlOverrides, setHtmlOverrides] = useState<Record<string, string>>(
    {}
  );
  const editorOriginalValueRef = useRef("");
  const editorOriginalNameRef = useRef("");
  const editorOriginalDescriptionRef = useRef("");

  const sanitizeHtml = useCallback((html: string): string => {
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
      .replace(/on\w+\s*=/gi, "data-removed=")
      .replace(/javascript:/gi, "data-removed:")
      .replace(/vbscript:/gi, "data-removed:");
  }, []);

  const openEditor = useCallback(
    (templateId: string) => {
      const template = templatesById[templateId];
      const nextValue =
        htmlOverrides[templateId] ?? template?.html ?? "";
      editorOriginalValueRef.current = nextValue;
      editorOriginalNameRef.current = template?.name ?? "";
      editorOriginalDescriptionRef.current = template?.description ?? "";
      setEditorTemplateId(templateId);
      setEditorValue(nextValue);
      setEditorName(template?.name ?? "");
      setEditorDescription(template?.description ?? "");
      setIsNewTemplate(false);
      setEditorOpen(true);
    },
    [templatesById, htmlOverrides]
  );

  const openCreateEditor = useCallback(() => {
    setEditorTemplateId(null);
    setEditorValue("");
    setEditorName("");
    setEditorDescription("");
    setIsNewTemplate(true);
    editorOriginalValueRef.current = "";
    editorOriginalNameRef.current = "";
    editorOriginalDescriptionRef.current = "";
    setEditorOpen(true);
  }, []);

  const commitTemplateEdit = useCallback(async () => {
    if (isNewTemplate) {
      if (!createTemplatesAction || !templates_agent_id || !group_id) {
        return;
      }
      const hasContent =
        editorValue.trim() ||
        editorName.trim() ||
        editorDescription.trim();
      if (!hasContent) {
        return;
      }
      setIsSaving(true);
      try {
        const createResult = await createTemplatesAction({
          body: {
            agent_id: templates_agent_id,
            group_id: group_id,
            name: editorName.trim() || "Untitled Template",
            mcp: false,
          },
        });
        if (createResult?.template_id) {
          const templateId = createResult.template_id;
          if (updateTemplatesAction) {
            await updateTemplatesAction({
              body: {
                template_id: templateId,
                html: editorValue,
                name: editorName.trim() || "Untitled Template",
                description: editorDescription.trim() || null,
              },
            });
          }
          createdTemplateIdsRef.current.add(templateId);
          setCreatedTemplates((prev) => [
            ...prev,
            {
              id: templateId,
              name: editorName.trim() || "Untitled Template",
              description: editorDescription.trim() || null,
              html: editorValue,
            },
          ]);
          setHtmlOverrides((prev) => ({
            ...prev,
            [templateId]: editorValue,
          }));
          onChange([...ids, templateId]);
          setIsNewTemplate(false);
          setEditorTemplateId(templateId);
          editorOriginalValueRef.current = editorValue;
          editorOriginalNameRef.current = editorName.trim() || "Untitled Template";
          editorOriginalDescriptionRef.current = editorDescription.trim() || "";
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to create template:", error);
      } finally {
        setIsSaving(false);
      }
      return;
    }

    if (!editorTemplateId) return;
    if (!updateTemplatesAction) return;
    const nextName = editorName.trim();
    const nextDescription = editorDescription.trim();
    const hasChanges =
      editorValue !== editorOriginalValueRef.current ||
      nextName !== editorOriginalNameRef.current ||
      nextDescription !== editorOriginalDescriptionRef.current;
    if (!hasChanges) return;

    setIsSaving(true);
    try {
      await updateTemplatesAction({
        body: {
          template_id: editorTemplateId,
          html: editorValue,
          name: nextName || null,
          description: nextDescription || null,
        },
      });
      setHtmlOverrides((prev) => ({
        ...prev,
        [editorTemplateId]: editorValue,
      }));
      editorOriginalValueRef.current = editorValue;
      editorOriginalNameRef.current = nextName;
      editorOriginalDescriptionRef.current = nextDescription;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to update template HTML:", error);
    } finally {
      setIsSaving(false);
    }
  }, [editorTemplateId, editorValue, updateTemplatesAction]);

  const handleEditorOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        void commitTemplateEdit();
      }
      setEditorOpen(open);
    },
    [commitTemplateEdit]
  );

  const canCreateTemplate =
    !!createTemplatesAction && !!templates_agent_id && !!group_id && !disabled;

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
        items={
          canCreateTemplate
            ? [
                ...filteredTemplates,
                { id: createCardId, name: "Create Template" },
              ]
            : filteredTemplates
        }
        selectedId={null}
        selectedIds={ids}
        onSelect={(templateId) => {
          if (templateId === createCardId) {
            openCreateEditor();
            return;
          }
          const isSelected = ids.includes(templateId);
          const newIds = isSelected
            ? ids.filter((id) => id !== templateId)
            : [...ids, templateId];
          handleSelect(newIds);
          openEditor(templateId);
        }}
        getId={(item) => item.id}
        renderItem={(item, isSelected) => {
          if (item.id === createCardId) {
            return (
              <div
                className={cn(
                  "relative flex flex-col items-center justify-center gap-3 p-5 rounded-xl border-2 border-dashed bg-muted/30 text-muted-foreground transition-all text-center",
                  "hover:bg-muted/50 hover:text-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                )}
              >
                <span className="text-sm font-medium">Create Template</span>
                <span className="text-xs">Add a new HTML template</span>
              </div>
            );
          }
          const displayHtml =
            htmlOverrides[item.id] ?? item.html ?? "";
          return (
            <div
              className={cn(
                "relative flex flex-col gap-3 p-5 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                "hover:shadow-md hover:bg-accent/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isSelected && "ring-2 ring-primary bg-accent"
              )}
            >
              {/* Check icon - top right */}
              {isSelected && (
                <div className="absolute top-3 right-3 z-10 h-7 w-7 bg-primary rounded-full flex items-center justify-center">
                  <Check className="h-4 w-4 text-primary-foreground" />
                </div>
              )}

              {/* Suggested badge - top right */}
              {isSuggested(item.id) && !isSelected && (
                <div className="absolute top-3 right-3 z-10 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded">
                  Suggested
                </div>
              )}

              <div className="flex-1 min-w-0 space-y-2">
                <div>
                  <h3 className="font-medium text-base leading-tight">
                    {item.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.id.slice(0, 8)}...
                  </p>
                </div>
                {item.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {item.description}
                  </p>
                )}
                <div className="rounded-md border bg-muted/40 p-2">
                  <p className="text-[11px] text-muted-foreground line-clamp-3 font-mono">
                    {displayHtml || "No HTML yet"}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">Click to edit</p>
              </div>
            </div>
          );
        }}
        emptyMessage="No templates found."
        disabled={disabled}
        className="grid-cols-1 lg:grid-cols-2"
        maxHeight="max-h-[520px]"
      />

      <Dialog open={editorOpen} onOpenChange={handleEditorOpenChange}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Template HTML</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="template-name">Name</Label>
                <Input
                  id="template-name"
                  value={editorName}
                  onChange={(e) => setEditorName(e.target.value)}
                  placeholder="Template name"
                  disabled={disabled || isSaving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-description">Description</Label>
                <Input
                  id="template-description"
                  value={editorDescription}
                  onChange={(e) => setEditorDescription(e.target.value)}
                  placeholder="Short description"
                  disabled={disabled || isSaving}
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="template-html-editor">HTML</Label>
                <Textarea
                  id="template-html-editor"
                  value={editorValue}
                  onChange={(e) => setEditorValue(e.target.value)}
                  className="min-h-[360px] font-mono text-xs"
                  placeholder="Paste template HTML here..."
                  disabled={disabled || isSaving}
                />
              </div>
              <div className="space-y-2">
                <Label>Preview</Label>
                <div className="border rounded-md overflow-hidden bg-background min-h-[360px]">
                  {editorValue ? (
                    <iframe
                      sandbox="allow-forms allow-pointer-lock allow-popups allow-same-origin"
                      className="w-full h-[360px] border-0"
                      srcDoc={sanitizeHtml(editorValue)}
                      title="Template preview"
                    />
                  ) : (
                    <div className="h-[360px] flex items-center justify-center text-xs text-muted-foreground">
                      No HTML to preview
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleEditorOpenChange(false)}
              disabled={isSaving}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
