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
import { Args } from "@/components/resources/Args";
import { ArgsOutputs } from "@/components/resources/ArgsOutputs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useGenerationContext } from "@/contexts/generation-context";
import { useProfile } from "@/contexts/profile-context";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { parseAsBoolean, parseAsString, type Parser } from "nuqs";

// Types defined inline using InputOf/OutputOf
type SaveToolIn = InputOf<"/api/v4/tools/save", "post">;
type SaveToolOut = OutputOf<"/api/v4/tools/save", "post">;
type CreateDraftArgsIn = InputOf<"/api/v4/resources/args", "post">;
type CreateDraftArgsOut = OutputOf<"/api/v4/resources/args", "post">;
type CreateDraftArgsOutputsIn = InputOf<"/api/v4/resources/args_outputs", "post">;
type CreateDraftArgsOutputsOut = OutputOf<"/api/v4/resources/args_outputs", "post">;
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
  createArgsAction?: (
    input: CreateDraftArgsIn
  ) => Promise<CreateDraftArgsOut>;
  createArgsOutputsAction?: (
    input: CreateDraftArgsOutputsIn
  ) => Promise<CreateDraftArgsOutputsOut>;
}

function ToolComponent({
  toolId,
  toolData: toolDataProp,
  toolDetail,
  toolDetailDefault,
  saveToolAction,
  patchToolDraftAction,
  createArgsAction,
  createArgsOutputsAction,
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

  // Generation state for AI workflows (removed - no longer needed for schema/template)

  // nuqs parsers for URL-backed state (will be passed to GenericForm)
  const toolSearchParamsClient = useMemo(
    () => ({
      // Draft ID (URL-backed, updated when draft is created)
      draftId: parseAsString,
      // Search params (URL-backed, updated via debounced callback in StepCard)
      argsSearch: parseAsString,
      argsOutputsSearch: parseAsString,
      // Filter params (URL-backed)
      argsShowSelected: parseAsBoolean,
      argsOutputsShowSelected: parseAsBoolean,
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
      args_ids: toolData.args_ids,
      args_resources: toolData.args_resources,
      show_args: toolData.show_args,
      args_suggestions: toolData.args_suggestions,
      args: toolData.args,
      args_required: toolData.args_required,
      args_agent_id: toolData.args_agent_id,
      args_outputs_ids: toolData.args_outputs_ids,
      args_outputs_resources: toolData.args_outputs_resources,
      show_args_outputs: toolData.show_args_outputs,
      args_outputs_suggestions: toolData.args_outputs_suggestions,
      args_outputs: toolData.args_outputs,
      args_outputs_required: toolData.args_outputs_required,
      args_outputs_agent_id: toolData.args_outputs_agent_id,
      input_args_fields:
        (toolData as typeof toolData & { input_args_fields?: unknown[] })
          .input_args_fields ?? [],
      output_args_outputs:
        (toolData as typeof toolData & { output_args_outputs?: unknown[] })
          .output_args_outputs ?? [],
      domain_resources: toolData.domain_resources ?? [],
    };
  }, [toolData]);

  const getInitialFormState = useCallback(() => {
    const data = toolDataRef.current;
    if (!data) {
      return {
        name: "",
        description: "",
        args_ids: [] as string[],
        args_outputs_ids: [] as string[],
      };
    }
    return {
      name: data.name || "",
      description: data.description || "",
      args_ids: data.args_ids ?? [],
      args_outputs_ids: data.args_outputs_ids ?? [],
    };
  }, []);

  const [formState, setFormState] = useState(getInitialFormState);
  const formStateRef = React.useRef(formState);
  React.useEffect(() => {
    formStateRef.current = formState;
  }, [formState]);

  // Memoize stringified array dependencies
  const argsIdsStr = React.useMemo(
    () => JSON.stringify(toolData?.args_ids ?? []),
    [toolData?.args_ids]
  );
  const argsOutputsIdsStr = React.useMemo(
    () => JSON.stringify(toolData?.args_outputs_ids ?? []),
    [toolData?.args_outputs_ids]
  );

  // Update form state when server data changes
  useEffect(() => {
    const newState = getInitialFormState();
    setFormState((prev) => {
      if (
        prev.name !== newState.name ||
        prev.description !== newState.description ||
        JSON.stringify(prev.args_ids) !==
          JSON.stringify(newState.args_ids) ||
        JSON.stringify(prev.args_outputs_ids) !==
          JSON.stringify(newState.args_outputs_ids)
      ) {
        return newState;
      }
      return prev;
    });
  }, [
    toolData?.name,
    toolData?.description,
    argsIdsStr,
    argsOutputsIdsStr,
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
      args_ids: formState.args_ids,
      args_outputs_ids: formState.args_outputs_ids,
    });
  }, [
    draftId,
    formState.args_ids,
    formState.args_outputs_ids,
  ]);

  const lastPatchedKeyRef = React.useRef<string | null>(null);

  // Draft change listener - removed since patchToolDraft API doesn't support args_ids/args_outputs_ids yet
  // TODO: Update patchToolDraft API to support args_ids/args_outputs_ids if draft patching is needed

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

      // WebSocket generation handlers removed for schema/template resources
      // Args and args_outputs generation can be added here if needed in the future
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

      // WebSocket error handlers removed for schema/template resources
      // Args and args_outputs error handling can be added here if needed in the future
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

  // Generation handlers (removed schema/template handlers)

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

  // Set generation capability when tool data is loaded (removed schema/template generation)
  useEffect(() => {
    setGenerationCapability({
      artifactType: "tool",
      canGenerate: false,
      agentId: null,
    });
    return () => clearGenerationCapability();
  }, [setGenerationCapability, clearGenerationCapability]);

  // Submit handler for GenericForm
  const handleSubmit = useCallback(
    async (_formData: Record<string, unknown>) => {
      // Validate required resource IDs
      if (
        toolData?.args_required &&
        formState.args_ids.length === 0
      ) {
        toast.error("Args are required");
        throw new Error("Args are required");
      }

      if (
        toolData?.args_outputs_required &&
        formState.args_outputs_ids.length === 0
      ) {
        toast.error("Args outputs are required");
        throw new Error("Args outputs are required");
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
            args_ids: formState.args_ids,
            args_outputs_ids: formState.args_outputs_ids,
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
      toolData?.args_required,
      toolData?.args_outputs_required,
    ]
  );

  // Step status logic
  const getStepStatus = useCallback(
    (stepId: string, _formData: Record<string, unknown>): StepStatus => {
      const hasName = !!formState.name && formState.name.trim() !== "";
      const hasDescription =
        !!formState.description && formState.description.trim() !== "";

      switch (stepId) {
        case "basic":
          return hasName && hasDescription ? "completed" : "active";
        case "args": {
          const hasArgs = (formState.args_ids?.length ?? 0) > 0;
          if (!hasName || !hasDescription) return "pending";
          return hasArgs ? "completed" : "active";
        }
        case "args_outputs": {
          const hasArgsOutputs = (formState.args_outputs_ids?.length ?? 0) > 0;
          if (!hasName || !hasDescription) return "pending";
          return hasArgsOutputs ? "completed" : "active";
        }
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
        id: "input_schema",
        title: "Input Schema",
        description: "Edit input schema fields.",
        resetFields: [],
      },
      {
        id: "output_template",
        title: "Output Template",
        description: "Edit output template Jinja content.",
        resetFields: [],
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
      {
        id: "args",
        title: "Args",
        description: "Select args for this tool.",
        resetFields: ["args_ids"],
      },
      {
        id: "args_outputs",
        title: "Args Outputs",
        description: "Select args outputs for this tool.",
        resetFields: ["args_outputs_ids"],
      },
    ],
    []
  );

  const formFieldKeys = useMemo(
    () => [
      "name",
      "description",
      "args_ids",
      "args_outputs_ids",
    ],
    []
  );

  const resetSuccessMessage = useCallback((stepId: string) => {
    switch (stepId) {
      case "basic":
        return "Basic information reset";
      case "args":
        return "Args reset";
      case "args_outputs":
        return "Args outputs reset";
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
      formData: _stepFormData,
      setFormData: _setStepFormData,
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

        case "args": {
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              resetFields={["args_ids"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <Args
                args_ids={formState.args_ids ?? []}
                input_args_fields={(
                  (
                    currentToolData as typeof currentToolData & {
                      input_args_fields?: Array<{
                        args_id?: string | null;
                        name?: string | null;
                        description?: string | null;
                        field_type?: string | null;
                        required?: boolean | null;
                        default_value?: string | null;
                        position?: number | null;
                        generated?: boolean | null;
                      }>;
                    }
                  )?.input_args_fields ?? []
                )
                  .filter(
                    (f): f is NonNullable<typeof f> =>
                      f !== null &&
                      f.args_id !== null &&
                      f.name !== null &&
                      f.field_type !== null &&
                      f.required !== null &&
                      f.position !== null
                  )
                  .map((f) => ({
                    args_id: f.args_id!,
                    name: f.name!,
                    description: f.description ?? "",
                    field_type: f.field_type!,
                    required: f.required!,
                    default_value: f.default_value ?? "",
                    position: f.position!,
                    generated: f.generated ?? false,
                  }))}
                disabled={disabled}
                {...(createArgsAction ? { createArgsAction } : {})}
                group_id={currentToolData?.group_id ?? null}
                agent_id={currentToolData?.args_agent_id ?? null}
              />
            </StepCard>
          );
        }

        case "args_outputs": {
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              resetFields={["args_outputs_ids"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <ArgsOutputs
                args_outputs_ids={formState.args_outputs_ids ?? []}
                output_args_outputs={(
                  (
                    currentToolData as typeof currentToolData & {
                      output_args_outputs?: Array<{
                        args_outputs_id?: string | null;
                        args_id?: string | null;
                        name?: string | null;
                        template?: string | null;
                        generated?: boolean | null;
                      }>;
                    }
                  )?.output_args_outputs ?? []
                )
                  .filter(
                    (o): o is NonNullable<typeof o> =>
                      o !== null &&
                      o.args_outputs_id !== null &&
                      o.args_id !== null &&
                      o.name !== null
                  )
                  .map((o) => ({
                    args_outputs_id: o.args_outputs_id!,
                    args_id: o.args_id!,
                    name: o.name!,
                    template: o.template ?? "",
                    generated: o.generated ?? false,
                  }))}
                input_args_fields={(
                  (
                    currentToolData as typeof currentToolData & {
                      input_args_fields?: Array<{
                        args_id?: string | null;
                        name?: string | null;
                        description?: string | null;
                        field_type?: string | null;
                        required?: boolean | null;
                        default_value?: string | null;
                        position?: number | null;
                        generated?: boolean | null;
                      }>;
                    }
                  )?.input_args_fields ?? []
                )
                  .filter(
                    (f): f is NonNullable<typeof f> =>
                      f !== null &&
                      f.args_id !== null &&
                      f.name !== null &&
                      f.field_type !== null &&
                      f.required !== null &&
                      f.position !== null
                  )
                  .map((f) => ({
                    args_id: f.args_id!,
                    name: f.name!,
                    description: f.description ?? "",
                    field_type: f.field_type!,
                    required: f.required!,
                    default_value: f.default_value ?? "",
                    position: f.position!,
                    generated: f.generated ?? false,
                  }))}
                disabled={disabled}
                {...(createArgsOutputsAction ? { createArgsOutputsAction } : {})}
                group_id={currentToolData?.group_id ?? null}
                agent_id={currentToolData?.args_outputs_agent_id ?? null}
              />
            </StepCard>
          );
        }

        default:
          return null;
      }
    },
    [
      formState,
      stableToolDataFields,
      disabled,
      isEditMode,
      createArgsAction,
      createArgsOutputsAction,
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
