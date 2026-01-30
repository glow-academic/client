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
import dynamic from "next/dynamic";

// Dynamically import Monaco to avoid SSR issues
const Monaco = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="min-h-[360px] flex items-center justify-center border rounded-md bg-muted/30">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
    </div>
  ),
});
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

export interface TemplateItem {
  id: string;
  name: string;
  description?: string | null;
}

export interface TemplatesProps {
  template_ids?: string[]; // Current template resource IDs (standardized prop name)
  template_resources?: Array<{
    id?: string | null;
    name?: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>; // Selected template resources (each includes generated field)
  show_templates?: boolean; // Whether to show this resource picker
  template_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  templates?: Array<{
    id?: string | null;
    template_id?: string | null;
    name?: string | null;
    description?: string | null;
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
  /** When false, skip automatic resource creation (manual save mode) */
  isAutosaveEnabled?: boolean;
  /** Register a flush callback with parent for manual save - returns created IDs */
  registerFlush?: (flush: () => Promise<{ template_ids: string[] } | void>) => void;
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
  placeholder: _placeholder = "Select templates...",
  description,
  group_id,
  templates_agent_id,
  createTemplatesAction,
  onGenerate,
  isGenerating = false,
  searchTerm = "",
  showSelectedFilter = false,
  isAutosaveEnabled = true,
  registerFlush,
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
  const flushRef = useRef<(() => Promise<{ template_ids: string[] } | void>) | undefined>(undefined);

  // Initialize createdTemplateIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdTemplateIdsRef.current.add(id));
  }, [ids]);

  // Convert templates array to TemplateItem format for SelectableGrid
  // API returns template_id, not id
  const templateItems = useMemo<TemplateItem[]>(() => {
    return allTemplates
      .filter((t) => (t.template_id || t.id) && t.name) // Filter out nulls
      .map((t) => ({
        id: (t.template_id ?? t.id)!,
        name: t.name!,
        description: t.description ?? null,
      }));
  }, [allTemplates]);

  const [createdTemplates, setCreatedTemplates] = useState<TemplateItem[]>([]);

  // Track pending template edits (for manual save mode)
  // Maps templateId -> { name, description, html } for templates edited but not yet flushed
  const [pendingTemplates, setPendingTemplates] = useState<
    Map<string, { name: string; description: string; html: string; isNew: boolean }>
  >(new Map());

  const mergedTemplates = useMemo<TemplateItem[]>(() => {
    const map = new Map<string, TemplateItem>();
    templateItems.forEach((item) => map.set(item.id, item));
    createdTemplates.forEach((item) => {
      if (!map.has(item.id)) {
        map.set(item.id, item);
      }
    });
    // Include pending templates for display (before they're flushed)
    pendingTemplates.forEach((pending, id) => {
      map.set(id, {
        id,
        name: pending.name,
        description: pending.description || null,
      });
    });
    return Array.from(map.values());
  }, [templateItems, createdTemplates, pendingTemplates]);

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

      // Create resources for newly selected templates (only if autosave is enabled)
      if (
        isAutosaveEnabled &&
        newlySelected.length > 0 &&
        createTemplatesAction &&
        templates_agent_id &&
        group_id
      ) {
        for (const templateId of newlySelected) {
          try {
            const templateItem = mergedTemplates.find((t) => t.id === templateId);
            await createTemplatesAction({
              body: {
                agent_id: templates_agent_id,
                group_id: group_id,
                name: templateItem?.name ?? "",
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
    [ids, onChange, createTemplatesAction, templates_agent_id, group_id, mergedTemplates, isAutosaveEnabled]
  );

  // Flush function for manual save mode - creates pending resources and returns all IDs
  flushRef.current = async (): Promise<{ template_ids: string[] } | void> => {
    if (!createTemplatesAction || !templates_agent_id || !group_id) {
      return { template_ids: ids };
    }

    const allIds: string[] = [...ids];
    const newIdsMap = new Map<string, string>(); // old temp ID -> new real ID

    // First, create resources for pending templates (newly created/edited)
    for (const [templateId, pending] of pendingTemplates.entries()) {
      try {
        const createResult = await createTemplatesAction({
          body: {
            agent_id: templates_agent_id,
            group_id: group_id,
            name: pending.name || "Untitled Template",
            html: pending.html || "",
            description: pending.description || null,
            mcp: false,
          },
        });
        if (createResult?.template_id) {
          const newTemplateId = createResult.template_id;
          createdTemplateIdsRef.current.add(newTemplateId);
          newIdsMap.set(templateId, newTemplateId);

          // Cache the HTML locally for immediate access (now saved to backend)
          setHtmlCache((prev) => ({
            ...prev,
            [newTemplateId]: pending.html,
          }));

          // Add to created templates for display
          setCreatedTemplates((prev) => [
            ...prev.filter((t) => t.id !== templateId), // Remove temp entry if exists
            {
              id: newTemplateId,
              name: pending.name || "Untitled Template",
              description: pending.description || null,
            },
          ]);
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`Failed to create pending template ${templateId}:`, error);
      }
    }

    // Update IDs array, replacing temp IDs with real ones
    const finalIds = allIds.map((id) => newIdsMap.get(id) ?? id);

    // Create resources for any selected templates that haven't been created yet
    for (const templateId of finalIds) {
      if (!createdTemplateIdsRef.current.has(templateId) && !newIdsMap.has(templateId)) {
        try {
          const templateItem = mergedTemplates.find((t) => t.id === templateId);
          await createTemplatesAction({
            body: {
              agent_id: templates_agent_id,
              group_id: group_id,
              name: templateItem?.name ?? "",
              mcp: false,
            },
          });
          createdTemplateIdsRef.current.add(templateId);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error(`Failed to create template resource for ${templateId}:`, error);
        }
      }
    }

    // Clear pending templates after flush
    setPendingTemplates(new Map());

    return { template_ids: finalIds };
  };

  // Register flush callback with parent
  useEffect(() => {
    if (registerFlush) {
      registerFlush(() => flushRef.current?.() ?? Promise.resolve());
    }
  }, [registerFlush]);

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
  const [htmlCache, setHtmlCache] = useState<Record<string, string>>({});
  const [htmlLoading, setHtmlLoading] = useState(false);
  const [editorTheme, setEditorTheme] = useState<"vs-dark" | "light">("vs-dark");

  // Detect dark mode for Monaco theme
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      setEditorTheme("vs-dark");
    } else {
      setEditorTheme("light");
    }
  }, []);
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

  const fetchTemplateHtml = useCallback(
    async (templateId: string): Promise<string> => {
      // Check htmlOverrides (user edits) first
      if (htmlOverrides[templateId] !== undefined) {
        return htmlOverrides[templateId];
      }
      // Check htmlCache second
      if (htmlCache[templateId] !== undefined) {
        return htmlCache[templateId];
      }
      // Fetch from BFF endpoint /api/templates/html
      try {
        const response = await fetch("/api/templates/html", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: templateId }),
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const result = await response.json();
        const html = result?.html ?? "";
        setHtmlCache((prev) => ({ ...prev, [templateId]: html }));
        return html;
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to fetch template HTML:", error);
        return "";
      }
    },
    [htmlOverrides, htmlCache]
  );

  const openEditor = useCallback(
    async (templateId: string) => {
      // Check pending templates first (for manual save mode)
      const pending = pendingTemplates.get(templateId);
      if (pending) {
        setEditorTemplateId(templateId);
        setEditorName(pending.name);
        setEditorDescription(pending.description);
        setEditorValue(pending.html);
        editorOriginalNameRef.current = pending.name;
        editorOriginalDescriptionRef.current = pending.description;
        editorOriginalValueRef.current = pending.html;
        setIsNewTemplate(false);
        setEditorOpen(true);
        return;
      }

      const template = templatesById[templateId];
      // Open dialog immediately with name/description
      setEditorTemplateId(templateId);
      setEditorName(template?.name ?? "");
      setEditorDescription(template?.description ?? "");
      editorOriginalNameRef.current = template?.name ?? "";
      editorOriginalDescriptionRef.current = template?.description ?? "";
      setIsNewTemplate(false);
      setEditorOpen(true);

      // Check for local overrides first (no loading needed)
      if (htmlOverrides[templateId] !== undefined) {
        const html = htmlOverrides[templateId];
        setEditorValue(html);
        editorOriginalValueRef.current = html;
        return;
      }

      // Check htmlCache
      if (htmlCache[templateId] !== undefined) {
        const html = htmlCache[templateId];
        setEditorValue(html);
        editorOriginalValueRef.current = html;
        return;
      }

      // Fetch HTML asynchronously
      setHtmlLoading(true);
      setEditorValue(""); // Clear while loading
      try {
        const html = await fetchTemplateHtml(templateId);
        setEditorValue(html);
        editorOriginalValueRef.current = html;
      } finally {
        setHtmlLoading(false);
      }
    },
    [templatesById, pendingTemplates, htmlOverrides, htmlCache, fetchTemplateHtml]
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

  const saveTemplate = useCallback(async () => {
    const nextName = editorName.trim() || "Untitled Template";
    const nextDescription = editorDescription.trim();
    const hasContent = editorValue.trim() || nextName || nextDescription;

    if (!hasContent) return;

    // For existing templates, check if there are actual changes
    if (!isNewTemplate && editorTemplateId) {
      const hasChanges =
        editorValue !== editorOriginalValueRef.current ||
        nextName !== editorOriginalNameRef.current ||
        nextDescription !== editorOriginalDescriptionRef.current;
      if (!hasChanges) {
        setEditorOpen(false);
        return;
      }
    }

    // If autosave is disabled, store changes locally and defer to flush
    if (!isAutosaveEnabled) {
      // Generate a temporary ID for new templates
      const tempId = isNewTemplate
        ? `temp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
        : editorTemplateId!;

      // Store pending template data
      setPendingTemplates((prev) => {
        const newMap = new Map(prev);
        newMap.set(tempId, {
          name: nextName,
          description: nextDescription,
          html: editorValue,
          isNew: isNewTemplate,
        });
        return newMap;
      });

      // Update local display state
      setCreatedTemplates((prev) => {
        const filtered = prev.filter((t) => t.id !== tempId && t.id !== editorTemplateId);
        return [
          ...filtered,
          {
            id: tempId,
            name: nextName,
            description: nextDescription || null,
          },
        ];
      });

      // Store HTML override locally
      setHtmlOverrides((prev) => ({
        ...prev,
        [tempId]: editorValue,
      }));

      // Update IDs in selection
      if (isNewTemplate) {
        onChange([...ids, tempId]);
      } else if (editorTemplateId && tempId !== editorTemplateId) {
        onChange(ids.map((id) => (id === editorTemplateId ? tempId : id)));
      }

      // Update editor state
      setIsNewTemplate(false);
      setEditorTemplateId(tempId);
      editorOriginalValueRef.current = editorValue;
      editorOriginalNameRef.current = nextName;
      editorOriginalDescriptionRef.current = nextDescription;

      setEditorOpen(false);
      return;
    }

    // Autosave mode: create resource immediately
    if (!createTemplatesAction || !templates_agent_id || !group_id) {
      return;
    }

    setIsSaving(true);
    try {
      // Always create a new template resource
      const createResult = await createTemplatesAction({
        body: {
          agent_id: templates_agent_id,
          group_id: group_id,
          name: nextName,
          html: editorValue,
          description: nextDescription || null,
          mcp: false,
        },
      });
      if (createResult?.template_id) {
        const newTemplateId = createResult.template_id;
        createdTemplateIdsRef.current.add(newTemplateId);
        setCreatedTemplates((prev) => [
          ...prev,
          {
            id: newTemplateId,
            name: nextName,
            description: nextDescription || null,
          },
        ]);
        // Cache the HTML locally for immediate access
        setHtmlCache((prev) => ({
          ...prev,
          [newTemplateId]: editorValue,
        }));

        // Replace old template ID with new one in selection
        const newIds = isNewTemplate
          ? [...ids, newTemplateId]
          : ids.map((id) => (id === editorTemplateId ? newTemplateId : id));
        onChange(newIds);

        setIsNewTemplate(false);
        setEditorTemplateId(newTemplateId);
        editorOriginalValueRef.current = editorValue;
        editorOriginalNameRef.current = nextName;
        editorOriginalDescriptionRef.current = nextDescription;
      }
      setEditorOpen(false);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to create template:", error);
    } finally {
      setIsSaving(false);
    }
  }, [editorTemplateId, editorValue, editorName, editorDescription, isNewTemplate, isAutosaveEnabled, createTemplatesAction, templates_agent_id, group_id, ids, onChange]);

  const handleEditorOpenChange = useCallback((open: boolean) => {
    setEditorOpen(open);
  }, []);

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
        horizontal
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
                <h3 className="font-medium text-base leading-tight">
                  {item.name}
                </h3>
                {item.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {item.description}
                  </p>
                )}
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
                {htmlLoading ? (
                  <div className="min-h-[360px] flex items-center justify-center border rounded-md bg-muted/30">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="border rounded-md overflow-hidden min-h-[360px]">
                    <Monaco
                      height="360px"
                      defaultLanguage="html"
                      value={editorValue}
                      onChange={(value) => setEditorValue(value ?? "")}
                      theme={editorTheme}
                      options={{
                        readOnly: disabled || isSaving,
                        wordWrap: "on",
                        minimap: { enabled: false },
                        fontSize: 13,
                        lineNumbers: "on",
                        scrollBeyondLastLine: false,
                        folding: true,
                        lineDecorationsWidth: 10,
                        lineNumbersMinChars: 3,
                        renderLineHighlight: "all",
                        automaticLayout: true,
                        scrollbar: {
                          vertical: "visible",
                          horizontal: "visible",
                          verticalScrollbarSize: 8,
                          horizontalScrollbarSize: 8,
                        },
                      }}
                    />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Preview</Label>
                <div className="border rounded-md overflow-hidden bg-background min-h-[360px]">
                  {htmlLoading ? (
                    <div className="h-[360px] flex items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : editorValue ? (
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
          <DialogFooter className="gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleEditorOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={saveTemplate}
              disabled={disabled || isSaving || htmlLoading}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : isNewTemplate ? (
                "Create"
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
