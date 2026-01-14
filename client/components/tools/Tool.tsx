/**
 * Tool.tsx
 * Implementation using modular resource components
 * Used to create and manage tools - supports both creation and editing
 */
"use client";

import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  GenericForm,
  type StepStatus,
} from "@/components/common/forms/GenericForm";
import { StepCard } from "@/components/common/forms/StepCard";
import { ReadOnlyBanner } from "@/components/common/ReadOnlyBanner";
import { SchemaFieldItems } from "@/components/resources/SchemaFieldItems";
import { Schemas } from "@/components/resources/Schemas";
import { TemplateArrayItems } from "@/components/resources/TemplateArrayItems";
import { Templates } from "@/components/resources/Templates";
import { TemplateValues } from "@/components/resources/TemplateValues";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useGenerationContext } from "@/contexts/generation-context";
import { useProfile } from "@/contexts/profile-context";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { ResourceType } from "@/lib/resources/types";
import { parseAsBoolean, parseAsString, type Parser } from "nuqs";

// Types defined inline using InputOf/OutputOf
type SaveToolIn = InputOf<"/api/v4/tools/save", "post">;
type SaveToolOut = OutputOf<"/api/v4/tools/save", "post">;
type CreateDraftSchemasIn = InputOf<"/api/v4/resources/schemas", "post">;
type CreateDraftSchemasOut = OutputOf<"/api/v4/resources/schemas", "post">;
type CreateDraftTemplatesIn = InputOf<"/api/v4/resources/templates", "post">;
type CreateDraftTemplatesOut = OutputOf<"/api/v4/resources/templates", "post">;
type CreateDraftSchemaFieldItemsIn = InputOf<
  "/api/v4/resources/schema_field_items",
  "post"
>;
type CreateDraftSchemaFieldItemsOut = OutputOf<
  "/api/v4/resources/schema_field_items",
  "post"
>;
type CreateDraftTemplateArrayItemsIn = InputOf<
  "/api/v4/resources/template_array_items",
  "post"
>;
type CreateDraftTemplateArrayItemsOut = OutputOf<
  "/api/v4/resources/template_array_items",
  "post"
>;
type CreateDraftTemplateValuesIn = InputOf<
  "/api/v4/resources/template_values",
  "post"
>;
type CreateDraftTemplateValuesOut = OutputOf<
  "/api/v4/resources/template_values",
  "post"
>;
type PatchToolDraftIn = InputOf<"/api/v4/tools/draft", "patch">;
type PatchToolDraftOut = OutputOf<"/api/v4/tools/draft", "patch">;

type ToolData = OutputOf<"/api/v4/tools/get", "post">;

export interface ToolProps {
  toolId?: string;
  // Server-provided data (for server-side rendering)
  toolData?: ToolData;
  toolDetail?: ToolData; // Legacy prop name for compatibility
  toolDetailDefault?: ToolData; // Legacy prop name for compatibility
  // Server actions (replaces useMutation)
  saveToolAction?: (input: SaveToolIn) => Promise<SaveToolOut>;
  patchToolDraftAction?: (
    input: PatchToolDraftIn
  ) => Promise<PatchToolDraftOut>;
  // Resource creation actions
  createSchemasAction?: (
    input: CreateDraftSchemasIn
  ) => Promise<CreateDraftSchemasOut>;
  createTemplatesAction?: (
    input: CreateDraftTemplatesIn
  ) => Promise<CreateDraftTemplatesOut>;
  createSchemaFieldItemsAction?: (
    input: CreateDraftSchemaFieldItemsIn
  ) => Promise<CreateDraftSchemaFieldItemsOut>;
  createTemplateArrayItemsAction?: (
    input: CreateDraftTemplateArrayItemsIn
  ) => Promise<CreateDraftTemplateArrayItemsOut>;
  createTemplateValuesAction?: (
    input: CreateDraftTemplateValuesIn
  ) => Promise<CreateDraftTemplateValuesOut>;
}

function ToolComponent({
  toolId,
  toolData: toolDataProp,
  toolDetail,
  toolDetailDefault,
  saveToolAction,
  patchToolDraftAction,
  createSchemasAction,
  createTemplatesAction,
  createSchemaFieldItemsAction,
  createTemplateArrayItemsAction,
  createTemplateValuesAction,
}: ToolProps) {
  // Support both new prop name (toolData) and legacy prop names (toolDetail, toolDetailDefault)
  const toolData = toolDataProp || toolDetail || toolDetailDefault;
  const router = useRouter();
  const isEditMode = !!toolId;
  const {
    effectiveProfile,
    selectedDraftId,
    setSelectedDraftId,
    socket,
    isConnected,
  } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const { setGenerationCapability, clearGenerationCapability } =
    useGenerationContext();

  // Generation state for AI workflows
  const [generatingResources, setGeneratingResources] = useState<
    Set<ResourceType>
  >(new Set());

  const isGenerating = useCallback(
    (resourceType: ResourceType) => generatingResources.has(resourceType),
    [generatingResources]
  );

  // nuqs parsers for URL-backed state (will be passed to GenericForm)
  const toolSearchParamsClient = useMemo(
    () => ({
      // Draft ID (URL-backed, updated when draft is created)
      draftId: parseAsString,
      // Search params (URL-backed, updated via debounced callback in StepCard)
      schemaSearch: parseAsString,
      templateSearch: parseAsString,
      schemaFieldItemSearch: parseAsString,
      templateArrayItemSearch: parseAsString,
      templateValueSearch: parseAsString,
      // Filter params (URL-backed)
      schemaShowSelected: parseAsBoolean,
      templateShowSelected: parseAsBoolean,
      schemaFieldItemShowSelected: parseAsBoolean,
      templateArrayItemShowSelected: parseAsBoolean,
      templateValueShowSelected: parseAsBoolean,
    }),
    []
  );

  // Local form state (not in URL) - stores only resource IDs
  const toolDataRef = React.useRef(toolData);
  React.useEffect(() => {
    toolDataRef.current = toolData;
  }, [toolData]);

  // Memoize toolData fields used in renderStep
  const stableToolDataFields = React.useMemo(() => {
    if (!toolData) return null;
    return {
      group_id: toolData.group_id,
      schema_resources: toolData.schema_resources,
      show_schemas: toolData.show_schemas,
      schema_suggestions: toolData.schema_suggestions,
      schemas: toolData.schemas,
      schemas_required: toolData.schemas_required,
      schemas_agent_id: toolData.schemas_agent_id,
      template_resources: toolData.template_resources,
      show_templates: toolData.show_templates,
      template_suggestions: toolData.template_suggestions,
      templates: toolData.templates,
      templates_required: toolData.templates_required,
      templates_agent_id: toolData.templates_agent_id,
      schema_field_item_ids: toolData.schema_field_item_ids,
      schema_field_item_resources: toolData.schema_field_item_resources,
      show_schema_field_items: toolData.show_schema_field_items,
      schema_field_item_suggestions: toolData.schema_field_item_suggestions,
      schema_field_items: toolData.schema_field_items,
      schema_field_items_required: toolData.schema_field_items_required,
      schema_field_items_agent_id: toolData.schema_field_items_agent_id,
      template_array_item_ids: toolData.template_array_item_ids,
      template_array_item_resources: toolData.template_array_item_resources,
      show_template_array_items: toolData.show_template_array_items,
      template_array_item_suggestions: toolData.template_array_item_suggestions,
      template_array_items: toolData.template_array_items,
      template_array_items_required: toolData.template_array_items_required,
      template_array_items_agent_id: toolData.template_array_items_agent_id,
      template_value_ids: toolData.template_value_ids,
      template_value_resources: toolData.template_value_resources,
      show_template_values: toolData.show_template_values,
      template_value_suggestions: toolData.template_value_suggestions,
      template_values: toolData.template_values,
      template_values_required: toolData.template_values_required,
      template_values_agent_id: toolData.template_values_agent_id,
    };
  }, [toolData]);

  const getInitialFormState = useCallback(() => {
    const data = toolDataRef.current;
    if (!data) {
      return {
        name: "",
        description: "",
        schema_ids: [] as string[],
        template_ids: [] as string[],
        schema_field_item_ids: [] as string[],
        template_array_item_ids: [] as string[],
        template_value_ids: [] as string[],
      };
    }
    return {
      name: data.name || "",
      description: data.description || "",
      schema_ids: data.schema_ids ?? [],
      template_ids: data.template_ids ?? [],
      schema_field_item_ids: data.schema_field_item_ids ?? [],
      template_array_item_ids: data.template_array_item_ids ?? [],
      template_value_ids: data.template_value_ids ?? [],
    };
  }, []);

  const [formState, setFormState] = useState(getInitialFormState);
  const formStateRef = React.useRef(formState);
  React.useEffect(() => {
    formStateRef.current = formState;
  }, [formState]);

  // Memoize stringified array dependencies
  const schemaIdsStr = React.useMemo(
    () => JSON.stringify(toolData?.schema_ids ?? []),
    [toolData?.schema_ids]
  );
  const templateIdsStr = React.useMemo(
    () => JSON.stringify(toolData?.template_ids ?? []),
    [toolData?.template_ids]
  );
  const schemaFieldItemIdsStr = React.useMemo(
    () => JSON.stringify(toolData?.schema_field_item_ids ?? []),
    [toolData?.schema_field_item_ids]
  );
  const templateArrayItemIdsStr = React.useMemo(
    () => JSON.stringify(toolData?.template_array_item_ids ?? []),
    [toolData?.template_array_item_ids]
  );
  const templateValueIdsStr = React.useMemo(
    () => JSON.stringify(toolData?.template_value_ids ?? []),
    [toolData?.template_value_ids]
  );

  // Update form state when server data changes
  useEffect(() => {
    const newState = getInitialFormState();
    setFormState((prev) => {
      if (
        prev.name !== newState.name ||
        prev.description !== newState.description ||
        JSON.stringify(prev.schema_ids) !==
          JSON.stringify(newState.schema_ids) ||
        JSON.stringify(prev.template_ids) !==
          JSON.stringify(newState.template_ids) ||
        JSON.stringify(prev.schema_field_item_ids) !==
          JSON.stringify(newState.schema_field_item_ids) ||
        JSON.stringify(prev.template_array_item_ids) !==
          JSON.stringify(newState.template_array_item_ids) ||
        JSON.stringify(prev.template_value_ids) !==
          JSON.stringify(newState.template_value_ids)
      ) {
        return newState;
      }
      return prev;
    });
  }, [
    toolData?.name,
    toolData?.description,
    schemaIdsStr,
    templateIdsStr,
    schemaFieldItemIdsStr,
    templateArrayItemIdsStr,
    templateValueIdsStr,
    getInitialFormState,
  ]);

  // Draft version tracking
  const [lastSavedVersion, setLastSavedVersion] = useState(0);
  const lastSavedVersionRef = React.useRef(0);
  React.useEffect(() => {
    lastSavedVersionRef.current = lastSavedVersion;
  }, [lastSavedVersion]);

  // Get draftId from GenericForm's URL state
  const [draftId, setDraftId] = useState<string | null>(null);
  const setUrlFormDataRef = React.useRef<
    null | ((updates: Record<string, unknown>) => void)
  >(null);

  const formDataRef = React.useRef<Record<string, unknown>>({});

  const onFormDataChange = React.useCallback((fd: Record<string, unknown>) => {
    formDataRef.current = fd;
    const next = (fd["draftId"] as string | undefined) ?? null;
    setDraftId((prev) => (prev === next ? prev : next));
  }, []);

  // Sync URL draftId to profile context
  useEffect(() => {
    if (draftId !== selectedDraftId) {
      setSelectedDraftId(draftId);
    }
  }, [draftId, selectedDraftId, setSelectedDraftId]);

  const patchToolDraftActionRef = React.useRef(patchToolDraftAction);
  React.useEffect(() => {
    patchToolDraftActionRef.current = patchToolDraftAction;
  }, [patchToolDraftAction]);

  // Build a stable key for "what would we patch"
  const draftPatchKey = React.useMemo(() => {
    return JSON.stringify({
      draftId: draftId || null,
      schema_ids: formState.schema_ids,
      template_ids: formState.template_ids,
      schema_field_item_ids: formState.schema_field_item_ids,
      template_array_item_ids: formState.template_array_item_ids,
      template_value_ids: formState.template_value_ids,
    });
  }, [
    draftId,
    formState.schema_ids,
    formState.template_ids,
    formState.schema_field_item_ids,
    formState.template_array_item_ids,
    formState.template_value_ids,
  ]);

  const lastPatchedKeyRef = React.useRef<string | null>(null);

  // Draft change listener - watches resource IDs and patches draft
  useEffect(() => {
    const hasResourceIds =
      formState.schema_ids.length > 0 ||
      formState.template_ids.length > 0 ||
      formState.schema_field_item_ids.length > 0 ||
      formState.template_array_item_ids.length > 0 ||
      formState.template_value_ids.length > 0;

    if (!hasResourceIds || !patchToolDraftActionRef.current) {
      return;
    }

    if (lastPatchedKeyRef.current === draftPatchKey) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        if (!patchToolDraftActionRef.current) return;
        const result = await patchToolDraftActionRef.current({
          body: {
            input_draft_id: draftId || null,
            schema_ids: formState.schema_ids,
            template_ids: formState.template_ids,
            schema_field_item_ids: formState.schema_field_item_ids,
            template_array_item_ids: formState.template_array_item_ids,
            template_value_ids: formState.template_value_ids,
            expected_version: lastSavedVersionRef.current,
          },
        });

        lastPatchedKeyRef.current = draftPatchKey;

        if (!draftId && result.draft_id) {
          setUrlFormDataRef.current?.({ draftId: result.draft_id });
        }

        if ((result.new_version ?? 0) !== lastSavedVersionRef.current) {
          setLastSavedVersion(result.new_version ?? 0);
          lastSavedVersionRef.current = result.new_version ?? 0;
        }
      } catch {
        // Failed to save draft - error already logged by API
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [
    draftPatchKey,
    formState.schema_ids,
    formState.template_ids,
    formState.schema_field_item_ids,
    formState.template_array_item_ids,
    formState.template_value_ids,
    draftId,
    patchToolDraftActionRef,
    setUrlFormDataRef,
    lastSavedVersionRef,
    setLastSavedVersion,
  ]);

  // WebSocket handlers for AI generation
  useEffect(() => {
    if (!socket || !isConnected) return;

    const currentGroupId = toolData?.group_id;

    const handleGenerationComplete = (data: {
      artifact_type?: string;
      group_id?: string;
      resource_type?: string;
      schema_ids?: string[];
      template_ids?: string[];
      schema_field_item_ids?: string[];
      template_array_item_ids?: string[];
      template_value_ids?: string[];
      message?: string;
      success?: boolean;
      [key: string]: unknown;
    }) => {
      if (
        data.artifact_type !== "tool" ||
        !data.group_id ||
        data.group_id !== currentGroupId
      ) {
        return;
      }

      const validResourceTypes: ResourceType[] = [
        "schemas",
        "templates",
        "schema_field_items",
        "template_array_items",
        "template_values",
      ];
      if (
        data.resource_type &&
        validResourceTypes.includes(data.resource_type as ResourceType)
      ) {
        setFormState((prev) => {
          const updates: Partial<typeof prev> = {};

          if (data.schema_ids && data.schema_ids.length > 0) {
            const newSchemaIds = data.schema_ids.filter(
              (id) => !prev.schema_ids.includes(id)
            );
            updates.schema_ids = [...prev.schema_ids, ...newSchemaIds];
          }
          if (data.template_ids && data.template_ids.length > 0) {
            const newTemplateIds = data.template_ids.filter(
              (id) => !prev.template_ids.includes(id)
            );
            updates.template_ids = [...prev.template_ids, ...newTemplateIds];
          }
          if (
            data.schema_field_item_ids &&
            data.schema_field_item_ids.length > 0
          ) {
            const newSchemaFieldItemIds = data.schema_field_item_ids.filter(
              (id) => !prev.schema_field_item_ids.includes(id)
            );
            updates.schema_field_item_ids = [
              ...prev.schema_field_item_ids,
              ...newSchemaFieldItemIds,
            ];
          }
          if (
            data.template_array_item_ids &&
            data.template_array_item_ids.length > 0
          ) {
            const newTemplateArrayItemIds = data.template_array_item_ids.filter(
              (id) => !prev.template_array_item_ids.includes(id)
            );
            updates.template_array_item_ids = [
              ...prev.template_array_item_ids,
              ...newTemplateArrayItemIds,
            ];
          }
          if (data.template_value_ids && data.template_value_ids.length > 0) {
            const newTemplateValueIds = data.template_value_ids.filter(
              (id) => !prev.template_value_ids.includes(id)
            );
            updates.template_value_ids = [
              ...prev.template_value_ids,
              ...newTemplateValueIds,
            ];
          }

          return { ...prev, ...updates };
        });

        setGeneratingResources((prev) => {
          const next = new Set(prev);
          next.delete(data.resource_type as ResourceType);
          return next;
        });
        if (data.success) {
          toast.success(
            data.message || `${data.resource_type} generated successfully`
          );
        } else {
          toast.error(
            data.message || `Failed to generate ${data.resource_type}`
          );
        }
      }
    };

    const handleGenerationProgress = (data: {
      artifact_type?: string;
      group_id?: string;
      resource_type?: string;
      [key: string]: unknown;
    }) => {
      if (
        data.artifact_type !== "tool" ||
        !data.group_id ||
        data.group_id !== currentGroupId
      ) {
        return;
      }
    };

    const handleGenerationError = (data: {
      artifact_type?: string;
      group_id?: string;
      message?: string;
      resource_type?: string;
      resource_types?: string[];
    }) => {
      if (
        data.artifact_type !== "tool" ||
        !data.group_id ||
        data.group_id !== currentGroupId
      ) {
        return;
      }

      const validResourceTypes: ResourceType[] = [
        "schemas",
        "templates",
        "schema_field_items",
        "template_array_items",
        "template_values",
      ];
      const resourceTypes =
        data.resource_types || (data.resource_type ? [data.resource_type] : []);
      setGeneratingResources((prev) => {
        const next = new Set(prev);
        resourceTypes.forEach((rt) => {
          if (validResourceTypes.includes(rt as ResourceType)) {
            next.delete(rt as ResourceType);
          }
        });
        return next;
      });
      toast.error(data.message || "Generation failed");
    };

    socket.on("tool_generation_progress", handleGenerationProgress);
    socket.on("tool_generation_complete", handleGenerationComplete);
    socket.on("tool_generation_error", handleGenerationError);

    return () => {
      socket.off("tool_generation_progress", handleGenerationProgress);
      socket.off("tool_generation_complete", handleGenerationComplete);
      socket.off("tool_generation_error", handleGenerationError);
    };
  }, [socket, isConnected, toolData?.group_id]);

  // Generation handlers
  const handleGenerateSchemas = useCallback(async () => {
    if (!socket || !isConnected) {
      toast.error("WebSocket not connected");
      return;
    }

    setGeneratingResources((prev) => {
      const next = new Set(prev);
      next.add("schemas");
      return next;
    });

    const formData = formDataRef.current;
    const draftId = (formData["draftId"] as string | undefined) ?? null;
    const schemaSearch =
      (formData["schemaSearch"] as string | undefined) ?? null;
    const schemaShowSelected =
      (formData["schemaShowSelected"] as boolean | undefined) ?? false;

    socket.emit("tool_generate", {
      resource_types: ["schemas"],
      agent_type: "schemas",
      draft_id: draftId || null,
      schema_search: schemaSearch || null,
      schema_show_selected: schemaShowSelected || false,
      mcp: false,
      tool_id: toolId || null,
    });
  }, [socket, isConnected, toolId]);

  const handleGenerateTemplates = useCallback(async () => {
    if (!socket || !isConnected) {
      toast.error("WebSocket not connected");
      return;
    }

    setGeneratingResources((prev) => {
      const next = new Set(prev);
      next.add("templates");
      return next;
    });

    const formData = formDataRef.current;
    const draftId = (formData["draftId"] as string | undefined) ?? null;
    const templateSearch =
      (formData["templateSearch"] as string | undefined) ?? null;
    const templateShowSelected =
      (formData["templateShowSelected"] as boolean | undefined) ?? false;

    socket.emit("tool_generate", {
      resource_types: ["templates"],
      agent_type: "templates",
      draft_id: draftId || null,
      template_search: templateSearch || null,
      template_show_selected: templateShowSelected || false,
      mcp: false,
      tool_id: toolId || null,
    });
  }, [socket, isConnected, toolId]);

  const handleGenerateSchemaFieldItems = useCallback(async () => {
    if (!socket || !isConnected) {
      toast.error("WebSocket not connected");
      return;
    }

    setGeneratingResources((prev) => {
      const next = new Set(prev);
      next.add("schema_field_items");
      return next;
    });

    const formData = formDataRef.current;
    const draftId = (formData["draftId"] as string | undefined) ?? null;

    socket.emit("tool_generate", {
      resource_types: ["schema_field_items"],
      agent_type: "schema_field_items",
      draft_id: draftId || null,
      mcp: false,
      tool_id: toolId || null,
    });
  }, [socket, isConnected, toolId]);

  const handleGenerateTemplateArrayItems = useCallback(async () => {
    if (!socket || !isConnected) {
      toast.error("WebSocket not connected");
      return;
    }

    setGeneratingResources((prev) => {
      const next = new Set(prev);
      next.add("template_array_items");
      return next;
    });

    const formData = formDataRef.current;
    const draftId = (formData["draftId"] as string | undefined) ?? null;

    socket.emit("tool_generate", {
      resource_types: ["template_array_items"],
      agent_type: "template_array_items",
      draft_id: draftId || null,
      mcp: false,
      tool_id: toolId || null,
    });
  }, [socket, isConnected, toolId]);

  const handleGenerateTemplateValues = useCallback(async () => {
    if (!socket || !isConnected) {
      toast.error("WebSocket not connected");
      return;
    }

    setGeneratingResources((prev) => {
      const next = new Set(prev);
      next.add("template_values");
      return next;
    });

    const formData = formDataRef.current;
    const draftId = (formData["draftId"] as string | undefined) ?? null;

    socket.emit("tool_generate", {
      resource_types: ["template_values"],
      agent_type: "template_values",
      draft_id: draftId || null,
      mcp: false,
      tool_id: toolId || null,
    });
  }, [socket, isConnected, toolId]);

  // Disabled logic based on can_edit flag
  const disabled = useMemo(() => {
    if (!toolData) return false;
    return !toolData.can_edit;
  }, [toolData]);

  // Set breadcrumb context when tool data is loaded
  useEffect(() => {
    const toolName = toolData?.name;
    if (toolName && toolId && isEditMode) {
      setEntityMetadata({
        entityId: toolId,
        entityName: toolName,
        entityType: "tool",
      });
    }
    return () => clearEntityMetadata();
  }, [toolData, toolId, isEditMode, setEntityMetadata, clearEntityMetadata]);

  // Set generation capability when tool data is loaded
  useEffect(() => {
    if (toolData?.schemas_agent_id || toolData?.templates_agent_id) {
      setGenerationCapability({
        artifactType: "tool",
        canGenerate: true,
        agentId:
          toolData.schemas_agent_id || toolData.templates_agent_id || null,
      });
    } else {
      setGenerationCapability({
        artifactType: "tool",
        canGenerate: false,
        agentId: null,
      });
    }
    return () => clearGenerationCapability();
  }, [
    toolData?.schemas_agent_id,
    toolData?.templates_agent_id,
    setGenerationCapability,
    clearGenerationCapability,
  ]);

  // Submit handler for GenericForm
  const handleSubmit = useCallback(
    async (_formData: Record<string, unknown>) => {
      // Validate required resource IDs
      if (toolData?.schemas_required && formState.schema_ids.length === 0) {
        toast.error("Schemas are required");
        throw new Error("Schemas are required");
      }

      if (toolData?.templates_required && formState.template_ids.length === 0) {
        toast.error("Templates are required");
        throw new Error("Templates are required");
      }

      if (
        toolData?.schema_field_items_required &&
        formState.schema_field_item_ids.length === 0
      ) {
        toast.error("Schema field items are required");
        throw new Error("Schema field items are required");
      }

      if (
        toolData?.template_array_items_required &&
        formState.template_array_item_ids.length === 0
      ) {
        toast.error("Template array items are required");
        throw new Error("Template array items are required");
      }

      if (
        toolData?.template_values_required &&
        formState.template_value_ids.length === 0
      ) {
        toast.error("Template values are required");
        throw new Error("Template values are required");
      }

      if (!effectiveProfile?.id) {
        toast.error("Profile not loaded. Please refresh the page.");
        throw new Error("Profile not loaded");
      }

      if (!saveToolAction) {
        toast.error("Save action not available");
        throw new Error("Save action not available");
      }

      if (!formState.name || !formState.name.trim()) {
        toast.error("Tool name is required");
        throw new Error("Tool name is required");
      }

      try {
        await saveToolAction({
          body: {
            input_tool_id: isEditMode && toolId ? toolId : null,
            name: formState.name,
            description: formState.description || "",
            schema_ids: formState.schema_ids,
            template_ids: formState.template_ids,
            schema_field_item_ids: formState.schema_field_item_ids,
            template_array_item_ids: formState.template_array_item_ids,
            template_value_ids: formState.template_value_ids,
            active: true,
          },
        });
        toast.success(
          `Tool ${isEditMode ? "updated" : "created"} successfully!`
        );
        router.push("/engine/tools");
      } catch (error) {
        toast.error(
          `Failed to ${isEditMode ? "update" : "create"} tool: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
        throw error;
      }
    },
    [
      formState,
      isEditMode,
      toolId,
      effectiveProfile?.id,
      saveToolAction,
      router,
      toolData?.schemas_required,
      toolData?.templates_required,
      toolData?.schema_field_items_required,
      toolData?.template_array_items_required,
      toolData?.template_values_required,
    ]
  );

  // Step status logic
  const getStepStatus = useCallback(
    (stepId: string, _formData: Record<string, unknown>): StepStatus => {
      const hasName = !!formState.name && formState.name.trim() !== "";
      const hasDescription =
        !!formState.description && formState.description.trim() !== "";
      const hasSchemas = formState.schema_ids.length > 0;
      const hasTemplates = formState.template_ids.length > 0;
      const hasSchemaFieldItems = formState.schema_field_item_ids.length > 0;
      const hasTemplateArrayItems =
        formState.template_array_item_ids.length > 0;
      const hasTemplateValues = formState.template_value_ids.length > 0;

      switch (stepId) {
        case "basic":
          return hasName && hasDescription ? "completed" : "active";
        case "schemas":
          if (!hasName || !hasDescription) return "pending";
          return hasSchemas ? "completed" : "active";
        case "templates":
          if (!hasName || !hasDescription) return "pending";
          return hasTemplates ? "completed" : "active";
        case "schema_field_items":
          if (!hasName || !hasDescription) return "pending";
          return hasSchemaFieldItems ? "completed" : "active";
        case "template_array_items":
          if (!hasName || !hasDescription) return "pending";
          return hasTemplateArrayItems ? "completed" : "active";
        case "template_values":
          if (!hasName || !hasDescription) return "pending";
          return hasTemplateValues ? "completed" : "active";
        default:
          return "pending";
      }
    },
    [formState]
  );

  // Steps configuration for GenericForm
  const steps = useMemo(
    () => [
      {
        id: "basic",
        title: "Basic Information",
        description: "Set the tool name and description.",
        resetFields: ["name", "description"],
      },
      {
        id: "schemas",
        title: "Schemas",
        description: "Select input schemas for this tool.",
        resetFields: ["schema_ids"],
      },
      {
        id: "templates",
        title: "Templates",
        description: "Select output templates for this tool.",
        resetFields: ["template_ids"],
      },
      {
        id: "schema_field_items",
        title: "Schema Field Items",
        description: "Select schema field items for this tool.",
        resetFields: ["schema_field_item_ids"],
      },
      {
        id: "template_array_items",
        title: "Template Array Items",
        description: "Select template array items for this tool.",
        resetFields: ["template_array_item_ids"],
      },
      {
        id: "template_values",
        title: "Template Values",
        description: "Select template values for this tool.",
        resetFields: ["template_value_ids"],
      },
    ],
    []
  );

  const formFieldKeys = useMemo(
    () => [
      "name",
      "description",
      "schema_ids",
      "template_ids",
      "schema_field_item_ids",
      "template_array_item_ids",
      "template_value_ids",
    ],
    []
  );

  const resetSuccessMessage = useCallback((stepId: string) => {
    switch (stepId) {
      case "basic":
        return "Basic information reset";
      case "schemas":
        return "Schemas reset";
      case "templates":
        return "Templates reset";
      case "schema_field_items":
        return "Schema field items reset";
      case "template_array_items":
        return "Template array items reset";
      case "template_values":
        return "Template values reset";
      default:
        return "Reset";
    }
  }, []);

  const submitButton = useMemo(
    () => ({
      backUrl: "/engine/tools",
      backLabel: "Back",
      createLabel: "Create Tool",
      updateLabel: "Update Tool",
    }),
    []
  );

  // Memoize renderStep
  const renderStep = useCallback(
    ({
      stepId,
      stepStatus,
      stepTitle,
      stepDescription,
      stepNumber,
      formData: stepFormData,
      setFormData: setStepFormData,
      onReset,
    }: {
      stepId: string;
      stepTitle: string;
      stepDescription: string;
      stepNumber: number;
      stepStatus: StepStatus;
      isOptional: boolean;
      formData: Record<string, unknown>;
      setFormData: (updates: Partial<Record<string, unknown>>) => void;
      filters?: Array<{
        key: string;
        label: string;
        value: boolean;
        onChange: (value: boolean) => void;
      }>;
      onReset?: () => void;
    }) => {
      const currentToolData = stableToolDataFields;
      switch (stepId) {
        case "basic":
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              resetFields={["name", "description"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">
                    Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={formState.name}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    placeholder="Enter tool name"
                    disabled={disabled}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formState.description}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Enter tool description"
                    rows={4}
                    disabled={disabled}
                  />
                </div>
              </div>
            </StepCard>
          );

        case "schemas": {
          const schemaSearchTerm =
            (stepFormData["schemaSearch"] as string | null | undefined) || "";
          const schemaShowSelected =
            (stepFormData["schemaShowSelected"] as
              | boolean
              | null
              | undefined) ?? false;
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              searchTerm={schemaSearchTerm}
              onSearchChange={(term: string) =>
                setStepFormData({ schemaSearch: term || null })
              }
              searchPlaceholder="Search schemas..."
              debounceMs={300}
              filters={[
                {
                  key: "showSelected",
                  label: "Show selected",
                  value: schemaShowSelected,
                  onChange: (value: boolean) =>
                    setStepFormData({ schemaShowSelected: value || null }),
                },
              ]}
              resetFields={["schema_ids", "schemaSearch", "schemaShowSelected"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <Schemas
                schema_ids={formState.schema_ids ?? []}
                schema_resources={currentToolData?.schema_resources ?? []}
                show_schemas={currentToolData?.show_schemas ?? false}
                schema_suggestions={currentToolData?.schema_suggestions ?? []}
                schemas={currentToolData?.schemas ?? []}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({ ...prev, schema_ids: ids }))
                }
                label="Schemas"
                required={currentToolData?.schemas_required ?? false}
                group_id={currentToolData?.group_id ?? null}
                schemas_agent_id={currentToolData?.schemas_agent_id ?? null}
                createSchemasAction={createSchemasAction}
                onGenerate={handleGenerateSchemas}
                isGenerating={isGenerating("schemas")}
                searchTerm={schemaSearchTerm}
                showSelectedFilter={schemaShowSelected}
              />
            </StepCard>
          );
        }

        case "templates": {
          const templateSearchTerm =
            (stepFormData["templateSearch"] as string | null | undefined) || "";
          const templateShowSelected =
            (stepFormData["templateShowSelected"] as
              | boolean
              | null
              | undefined) ?? false;
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              searchTerm={templateSearchTerm}
              onSearchChange={(term: string) =>
                setStepFormData({ templateSearch: term || null })
              }
              searchPlaceholder="Search templates..."
              debounceMs={300}
              filters={[
                {
                  key: "showSelected",
                  label: "Show selected",
                  value: templateShowSelected,
                  onChange: (value: boolean) =>
                    setStepFormData({ templateShowSelected: value || null }),
                },
              ]}
              resetFields={[
                "template_ids",
                "templateSearch",
                "templateShowSelected",
              ]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <Templates
                template_ids={formState.template_ids ?? []}
                template_resources={currentToolData?.template_resources ?? []}
                show_templates={currentToolData?.show_templates ?? false}
                template_suggestions={
                  currentToolData?.template_suggestions ?? []
                }
                templates={currentToolData?.templates ?? []}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({ ...prev, template_ids: ids }))
                }
                label="Templates"
                required={currentToolData?.templates_required ?? false}
                group_id={currentToolData?.group_id ?? null}
                templates_agent_id={currentToolData?.templates_agent_id ?? null}
                createTemplatesAction={createTemplatesAction}
                onGenerate={handleGenerateTemplates}
                isGenerating={isGenerating("templates")}
                searchTerm={templateSearchTerm}
                showSelectedFilter={templateShowSelected}
              />
            </StepCard>
          );
        }

        case "schema_field_items": {
          const schemaFieldItemSearchTerm =
            (stepFormData["schemaFieldItemSearch"] as
              | string
              | null
              | undefined) || "";
          const schemaFieldItemShowSelected =
            (stepFormData["schemaFieldItemShowSelected"] as
              | boolean
              | null
              | undefined) ?? false;
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              searchTerm={schemaFieldItemSearchTerm}
              onSearchChange={(term: string) =>
                setStepFormData({ schemaFieldItemSearch: term || null })
              }
              searchPlaceholder="Search schema field items..."
              debounceMs={300}
              filters={[
                {
                  key: "showSelected",
                  label: "Show selected",
                  value: schemaFieldItemShowSelected,
                  onChange: (value: boolean) =>
                    setStepFormData({
                      schemaFieldItemShowSelected: value || null,
                    }),
                },
              ]}
              resetFields={[
                "schema_field_item_ids",
                "schemaFieldItemSearch",
                "schemaFieldItemShowSelected",
              ]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <SchemaFieldItems
                schema_field_item_ids={formState.schema_field_item_ids ?? []}
                schema_field_item_resources={
                  currentToolData?.schema_field_item_resources ?? []
                }
                show_schema_field_items={
                  currentToolData?.show_schema_field_items ?? false
                }
                schema_field_item_suggestions={
                  currentToolData?.schema_field_item_suggestions ?? []
                }
                schema_field_items={currentToolData?.schema_field_items ?? []}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({
                    ...prev,
                    schema_field_item_ids: ids,
                  }))
                }
                label="Schema Field Items"
                required={currentToolData?.schema_field_items_required ?? false}
                group_id={currentToolData?.group_id ?? null}
                schema_field_items_agent_id={
                  currentToolData?.schema_field_items_agent_id ?? null
                }
                createSchemaFieldItemsAction={createSchemaFieldItemsAction}
                onGenerate={handleGenerateSchemaFieldItems}
                isGenerating={isGenerating("schema_field_items")}
                searchTerm={schemaFieldItemSearchTerm}
                showSelectedFilter={schemaFieldItemShowSelected}
              />
            </StepCard>
          );
        }

        case "template_array_items": {
          const templateArrayItemSearchTerm =
            (stepFormData["templateArrayItemSearch"] as
              | string
              | null
              | undefined) || "";
          const templateArrayItemShowSelected =
            (stepFormData["templateArrayItemShowSelected"] as
              | boolean
              | null
              | undefined) ?? false;
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              searchTerm={templateArrayItemSearchTerm}
              onSearchChange={(term: string) =>
                setStepFormData({ templateArrayItemSearch: term || null })
              }
              searchPlaceholder="Search template array items..."
              debounceMs={300}
              filters={[
                {
                  key: "showSelected",
                  label: "Show selected",
                  value: templateArrayItemShowSelected,
                  onChange: (value: boolean) =>
                    setStepFormData({
                      templateArrayItemShowSelected: value || null,
                    }),
                },
              ]}
              resetFields={[
                "template_array_item_ids",
                "templateArrayItemSearch",
                "templateArrayItemShowSelected",
              ]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <TemplateArrayItems
                template_array_item_ids={
                  formState.template_array_item_ids ?? []
                }
                template_array_item_resources={
                  currentToolData?.template_array_item_resources ?? []
                }
                show_template_array_items={
                  currentToolData?.show_template_array_items ?? false
                }
                template_array_item_suggestions={
                  currentToolData?.template_array_item_suggestions ?? []
                }
                template_array_items={
                  currentToolData?.template_array_items ?? []
                }
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({
                    ...prev,
                    template_array_item_ids: ids,
                  }))
                }
                label="Template Array Items"
                required={
                  currentToolData?.template_array_items_required ?? false
                }
                group_id={currentToolData?.group_id ?? null}
                template_array_items_agent_id={
                  currentToolData?.template_array_items_agent_id ?? null
                }
                createTemplateArrayItemsAction={createTemplateArrayItemsAction}
                onGenerate={handleGenerateTemplateArrayItems}
                isGenerating={isGenerating("template_array_items")}
                searchTerm={templateArrayItemSearchTerm}
                showSelectedFilter={templateArrayItemShowSelected}
              />
            </StepCard>
          );
        }

        case "template_values": {
          const templateValueSearchTerm =
            (stepFormData["templateValueSearch"] as
              | string
              | null
              | undefined) || "";
          const templateValueShowSelected =
            (stepFormData["templateValueShowSelected"] as
              | boolean
              | null
              | undefined) ?? false;
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              searchTerm={templateValueSearchTerm}
              onSearchChange={(term: string) =>
                setStepFormData({ templateValueSearch: term || null })
              }
              searchPlaceholder="Search template values..."
              debounceMs={300}
              filters={[
                {
                  key: "showSelected",
                  label: "Show selected",
                  value: templateValueShowSelected,
                  onChange: (value: boolean) =>
                    setStepFormData({
                      templateValueShowSelected: value || null,
                    }),
                },
              ]}
              resetFields={[
                "template_value_ids",
                "templateValueSearch",
                "templateValueShowSelected",
              ]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <TemplateValues
                template_value_ids={formState.template_value_ids ?? []}
                template_value_resources={
                  currentToolData?.template_value_resources ?? []
                }
                show_template_values={
                  currentToolData?.show_template_values ?? false
                }
                template_value_suggestions={
                  currentToolData?.template_value_suggestions ?? []
                }
                template_values={currentToolData?.template_values ?? []}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({
                    ...prev,
                    template_value_ids: ids,
                  }))
                }
                label="Template Values"
                required={currentToolData?.template_values_required ?? false}
                group_id={currentToolData?.group_id ?? null}
                template_values_agent_id={
                  currentToolData?.template_values_agent_id ?? null
                }
                createTemplateValuesAction={createTemplateValuesAction}
                onGenerate={handleGenerateTemplateValues}
                isGenerating={isGenerating("template_values")}
                searchTerm={templateValueSearchTerm}
                showSelectedFilter={templateValueShowSelected}
              />
            </StepCard>
          );
        }

        default:
          return null;
      }
    },
    [
      stableToolDataFields,
      disabled,
      isEditMode,
      handleGenerateSchemas,
      handleGenerateTemplates,
      isGenerating,
      formState.name,
      formState.description,
      formState.schema_ids,
      formState.template_ids,
      formState.schema_field_item_ids,
      formState.template_array_item_ids,
      formState.template_value_ids,
      createSchemasAction,
      createTemplatesAction,
      createSchemaFieldItemsAction,
      createTemplateArrayItemsAction,
      createTemplateValuesAction,
      handleGenerateSchemaFieldItems,
      handleGenerateTemplateArrayItems,
      handleGenerateTemplateValues,
    ]
  );

  return (
    <div
      className="w-full p-6 space-y-8"
      data-page={`tool-${isEditMode ? "edit" : "new"}`}
    >
      <ReadOnlyBanner
        disabled={disabled}
        disabledReason={toolData?.disabled_reason ?? null}
        entityType="tool"
      />

      <GenericForm
        nuqsParsers={toolSearchParamsClient as Record<string, Parser<unknown>>}
        steps={steps}
        getStepStatus={getStepStatus}
        serverData={toolData}
        formFieldKeys={formFieldKeys}
        resetSuccessMessage={resetSuccessMessage}
        onSubmit={handleSubmit}
        submitButton={submitButton}
        isReadonly={disabled}
        isEditMode={isEditMode}
        renderStep={renderStep}
        onFormDataChange={onFormDataChange}
        registerSetFormData={(setter) => {
          setUrlFormDataRef.current = setter;
        }}
      />
    </div>
  );
}

// Memoize component to prevent re-renders when only prop references change
export default React.memo(ToolComponent);
