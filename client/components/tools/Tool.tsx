/**
 * Tool.tsx
 * Implementation using modular resource components
 * Used to create and manage tools - supports both creation and editing
 * Follows Persona.tsx gold standard pattern
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
import type { GenerateRegenerateModalResource } from "@/components/common/GenerateRegenerateModal";
import { GenerateRegenerateModal } from "@/components/common/GenerateRegenerateModal";
import { ReadOnlyBanner } from "@/components/common/ReadOnlyBanner";
import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
import { Args } from "@/components/resources/Args";
import { ArgsOutputs } from "@/components/resources/ArgsOutputs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Check, Loader2, Sparkles } from "lucide-react";
import { parseAsBoolean, parseAsString, type Parser } from "nuqs";

// Types defined inline using InputOf/OutputOf
type SaveToolIn = InputOf<"/api/v4/tools/save", "post">;
type SaveToolOut = OutputOf<"/api/v4/tools/save", "post">;
type CreateDraftArgsIn = InputOf<"/api/v4/resources/args", "post">;
type CreateDraftArgsOut = OutputOf<"/api/v4/resources/args", "post">;
type CreateDraftArgsOutputsIn = InputOf<
  "/api/v4/resources/args_outputs",
  "post"
>;
type CreateDraftArgsOutputsOut = OutputOf<
  "/api/v4/resources/args_outputs",
  "post"
>;
type PatchToolDraftIn = InputOf<"/api/v4/tools/draft", "patch">;
type PatchToolDraftOut = OutputOf<"/api/v4/tools/draft", "patch">;

type ToolData = OutputOf<"/api/v4/tools/get", "post">;

// Resource types for tools
type ToolResourceType = "args" | "args_outputs";

export interface ToolProps {
  toolId?: string;
  // Server-provided data (for server-side rendering)
  toolData?: ToolData;
  // Server actions (replaces useMutation)
  saveToolAction?: (input: SaveToolIn) => Promise<SaveToolOut>;
  patchToolDraftAction?: (
    input: PatchToolDraftIn
  ) => Promise<PatchToolDraftOut>;
  // Resource creation actions
  createArgsAction?: (input: CreateDraftArgsIn) => Promise<CreateDraftArgsOut>;
  createArgsOutputsAction?: (
    input: CreateDraftArgsOutputsIn
  ) => Promise<CreateDraftArgsOutputsOut>;
}

function ToolComponent({
  toolId,
  toolData,
  saveToolAction,
  patchToolDraftAction,
  createArgsAction,
  createArgsOutputsAction,
}: ToolProps) {
  const router = useRouter();
  const isEditMode = !!toolId;
  const {
    profile,
    selectedDraftId,
    setSelectedDraftId,
    socket,
    isConnected,
  } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();

  // Generation state for AI workflows
  const [generatingResources, setGeneratingResources] = useState<
    Set<ToolResourceType>
  >(new Set());

  // Modal state for generate/regenerate
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [modalMode, setModalMode] = useState<"generate" | "regenerate" | null>(
    null
  );
  const [modalResources, setModalResources] = useState<
    GenerateRegenerateModalResource[]
  >([]);
  const [modalInstructions, setModalInstructions] = useState("");

  const isGenerating = useCallback(
    (resourceType: ToolResourceType) => generatingResources.has(resourceType),
    [generatingResources]
  );

  // nuqs parsers for URL-backed state (will be passed to GenericForm)
  const toolSearchParamsClient = useMemo(
    () => ({
      // Draft ID (URL-backed, updated when draft is created)
      draftId: parseAsString,
      argsSearch: parseAsString,
      argsOutputsSearch: parseAsString,
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
      input_args_fields: toolData.input_args_fields ?? [],
      output_args_outputs: toolData.output_args_outputs ?? [],
    };
  }, [toolData]);

  // Helper to check if a resource type can be regenerated
  const canRegenerate = useCallback(
    (resourceType: ToolResourceType): boolean => {
      if (!stableToolDataFields) return false;
      switch (resourceType) {
        case "args":
          return (
            stableToolDataFields.args_resources?.some((r) => r.generated) ??
            false
          );
        case "args_outputs":
          return (
            stableToolDataFields.args_outputs_resources?.some(
              (r) => r.generated
            ) ?? false
          );
        default:
          return false;
      }
    },
    [stableToolDataFields]
  );

  const argsItems = useMemo(() => {
    return (
      stableToolDataFields?.args
        ?.filter(
          (arg): arg is NonNullable<typeof arg> =>
            !!arg && !!arg.id && !!arg.name
        )
        .map((arg) => ({
          id: arg.id!,
          name: arg.name!,
          description: arg.description ?? "",
          field_type: arg.field_type ?? "",
          required: arg.required ?? false,
          position: arg.position ?? 0,
          generated: arg.generated ?? false,
        }))
        .sort((a, b) =>
          a.position === b.position
            ? a.name.localeCompare(b.name)
            : a.position - b.position
        ) ?? []
    );
  }, [stableToolDataFields?.args]);

  const argsOutputsItems = useMemo(() => {
    return (
      stableToolDataFields?.args_outputs
        ?.filter(
          (output): output is NonNullable<typeof output> =>
            !!output && !!output.id && !!output.name && !!output.args_id
        )
        .map((output) => ({
          id: output.id!,
          args_id: output.args_id!,
          name: output.name!,
          template: output.template ?? "",
          generated: output.generated ?? false,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)) ?? []
    );
  }, [stableToolDataFields?.args_outputs]);

  const argsNameById = useMemo(() => {
    const map = new Map<string, string>();
    argsItems.forEach((arg) => {
      map.set(arg.id, arg.name);
    });
    return map;
  }, [argsItems]);

  const argsOutputsById = useMemo(() => {
    const map = new Map<string, { id: string; args_id: string }>();
    argsOutputsItems.forEach((output) => {
      map.set(output.id, output);
    });
    return map;
  }, [argsOutputsItems]);

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

  useEffect(() => {
    setFormState((prev) => {
      if (prev.args_outputs_ids.length === 0) {
        return prev;
      }
      const allowedArgs = new Set(prev.args_ids);
      const nextArgsOutputs = prev.args_outputs_ids.filter((outputId) => {
        const output = argsOutputsById.get(outputId);
        if (!output) return false;
        if (allowedArgs.size === 0) return true;
        return allowedArgs.has(output.args_id);
      });
      if (nextArgsOutputs.length === prev.args_outputs_ids.length) {
        return prev;
      }
      return {
        ...prev,
        args_outputs_ids: nextArgsOutputs,
      };
    });
  }, [argsOutputsById, formState.args_ids]);

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
        JSON.stringify(prev.args_ids) !== JSON.stringify(newState.args_ids) ||
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

  // Draft version tracking for optimistic concurrency control
  const [lastSavedVersion, setLastSavedVersion] = useState(0);
  const lastSavedVersionRef = React.useRef(0);
  React.useEffect(() => {
    lastSavedVersionRef.current = lastSavedVersion;
  }, [lastSavedVersion]);
  // Sync draft_version from server to avoid unintended draft forks.
  const draftVersion =
    toolData && "draft_version" in toolData
      ? (toolData as { draft_version?: number | null }).draft_version
      : null;
  React.useEffect(() => {
    if (
      typeof draftVersion === "number" &&
      draftVersion !== lastSavedVersionRef.current
    ) {
      setLastSavedVersion(draftVersion);
      lastSavedVersionRef.current = draftVersion;
    }
  }, [draftVersion]);

  const formArgsIdsStr = useMemo(
    () => JSON.stringify(formState.args_ids ?? []),
    [formState.args_ids]
  );
  const formArgsOutputsIdsStr = useMemo(
    () => JSON.stringify(formState.args_outputs_ids ?? []),
    [formState.args_outputs_ids]
  );

  const draftPatchKey = useMemo(
    () =>
      JSON.stringify({
        draftId: draftId || null,
        args_ids: formState.args_ids,
        args_outputs_ids: formState.args_outputs_ids,
      }),
    [draftId, formArgsIdsStr, formArgsOutputsIdsStr]
  );

  const lastPatchedKeyRef = React.useRef<string | null>(null);

  useEffect(() => {
    const hasResourceIds =
      formState.args_ids.length > 0 || formState.args_outputs_ids.length > 0;

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
            args_ids: formState.args_ids,
            args_outputs_ids: formState.args_outputs_ids,
            expected_version: lastSavedVersionRef.current,
          },
        });

        lastPatchedKeyRef.current = draftPatchKey;

        if (result.draft_id && result.draft_id !== draftId) {
          // Sync URL to server-returned draft_id to avoid stale draft mismatch
          setUrlFormDataRef.current?.({ draftId: result.draft_id });
        }

        if ((result.new_version ?? 0) !== lastSavedVersionRef.current) {
          setLastSavedVersion(result.new_version ?? 0);
          lastSavedVersionRef.current = result.new_version ?? 0;
        }
      } catch {
        // Draft save failed - API logs handle details
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [draftPatchKey, draftId, formState.args_ids, formState.args_outputs_ids]);

  // WebSocket handlers for AI generation
  useEffect(() => {
    if (!socket || !isConnected) return;

    const currentGroupId = toolData?.group_id;

    const handleGenerationComplete = (data: {
      artifact_type?: string;
      group_id?: string;
      resource_type?: string;
      args_ids?: string[];
      args_outputs_ids?: string[];
      message?: string;
      success?: boolean;
      [key: string]: unknown;
    }) => {
      // Filter by artifact_type and group_id
      if (
        data.artifact_type !== "tool" ||
        !data.group_id ||
        data.group_id !== currentGroupId
      ) {
        return;
      }

      const validResourceTypes: ToolResourceType[] = ["args", "args_outputs"];
      if (
        data.resource_type &&
        validResourceTypes.includes(data.resource_type as ToolResourceType)
      ) {
        // Update formState with the resource IDs that were generated
        setFormState((prev) => {
          const updates: Partial<typeof prev> = {};

          if (data.args_ids && data.args_ids.length > 0) {
            // For arrays, append new IDs (avoid duplicates)
            const newArgsIds = data.args_ids.filter(
              (id) => !prev.args_ids.includes(id)
            );
            updates.args_ids = [...prev.args_ids, ...newArgsIds];
          }
          if (data.args_outputs_ids && data.args_outputs_ids.length > 0) {
            // For arrays, append new IDs (avoid duplicates)
            const newArgsOutputsIds = data.args_outputs_ids.filter(
              (id) => !prev.args_outputs_ids.includes(id)
            );
            updates.args_outputs_ids = [
              ...prev.args_outputs_ids,
              ...newArgsOutputsIds,
            ];
          }

          return { ...prev, ...updates };
        });

        setGeneratingResources((prev) => {
          const next = new Set(prev);
          next.delete(data.resource_type as ToolResourceType);
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
      // Filter by artifact_type and group_id
      if (
        data.artifact_type !== "tool" ||
        !data.group_id ||
        data.group_id !== currentGroupId
      ) {
        return;
      }
      // Handle progress updates if needed
    };

    const handleGenerationError = (data: {
      artifact_type?: string;
      group_id?: string;
      message?: string;
      resource_type?: string;
      resource_types?: string[];
    }) => {
      // Filter by artifact_type and group_id
      if (
        data.artifact_type !== "tool" ||
        !data.group_id ||
        data.group_id !== currentGroupId
      ) {
        return;
      }

      const validResourceTypes: ToolResourceType[] = ["args", "args_outputs"];
      const resourceTypes =
        data.resource_types || (data.resource_type ? [data.resource_type] : []);
      setGeneratingResources((prev) => {
        const next = new Set(prev);
        resourceTypes.forEach((rt) => {
          if (validResourceTypes.includes(rt as ToolResourceType)) {
            next.delete(rt as ToolResourceType);
          }
        });
        return next;
      });
      toast.error(data.message || "Generation failed");
    };

    // Listen to tool-specific events filtered by artifact_type and group_id
    socket.on("tool_generation_progress", handleGenerationProgress);
    socket.on("tool_generation_complete", handleGenerationComplete);
    socket.on("tool_generation_error", handleGenerationError);

    return () => {
      socket.off("tool_generation_progress", handleGenerationProgress);
      socket.off("tool_generation_complete", handleGenerationComplete);
      socket.off("tool_generation_error", handleGenerationError);
    };
  }, [socket, isConnected, toolData?.group_id]);

  // Multi-generation handler - accepts list of resource types and optional user instructions
  const determineAgentType = useCallback(
    (resourceTypes: ToolResourceType[]): string | null => {
      if (resourceTypes.length === 1) {
        // Single resource type - map to agent_type
        const agentTypeMap: Partial<Record<ToolResourceType, string>> = {
          args: "args",
          args_outputs: "args_outputs",
        };
        const firstType = resourceTypes[0];
        if (firstType && firstType in agentTypeMap) {
          return agentTypeMap[firstType] ?? null;
        }
      } else if (resourceTypes.length === 2) {
        // Both resources - use general agent if available
        return "general";
      }
      return null;
    },
    []
  );

  const handleGenerateResources = useCallback(
    async (
      resourceTypes: ToolResourceType[],
      agentType: string | null,
      userInstructions?: string
    ) => {
      if (!socket || !isConnected) {
        toast.error("WebSocket not connected");
        return;
      }

      // Set all resources as generating
      setGeneratingResources((prev) => {
        const next = new Set(prev);
        resourceTypes.forEach((rt) => next.add(rt));
        return next;
      });

      // Read draftId from formData
      const formData = formDataRef.current;
      const draftId = (formData["draftId"] as string | undefined) ?? null;

      // Emit tool_generate event
      socket.emit("tool_generate", {
        resource_types: resourceTypes,
        agent_type: agentType,
        user_instructions: userInstructions ? [userInstructions] : null,
        draft_id: draftId || null,
        mcp: false,
        tool_id: toolId || null,
      });
    },
    [socket, isConnected, toolId]
  );

  // Disabled logic based on can_edit flag - check in both new and edit modes
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

  // Submit handler for GenericForm
  const handleSubmit = useCallback(
    async (_formData: Record<string, unknown>) => {
      // Validate required resource IDs
      if (toolData?.args_required && formState.args_ids.length === 0) {
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

      if (!profile?.id) {
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
      profile?.id,
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

  // Step-to-resources mapping for multi-generation
  const stepResources: Record<string, ToolResourceType[]> = useMemo(
    () => ({
      args: ["args"],
      args_outputs: ["args_outputs"],
      all: ["args", "args_outputs"], // All resources for full-page generation
    }),
    []
  );

  // Resource labels for display
  const resourceLabels: Partial<Record<ToolResourceType, string>> = useMemo(
    () => ({
      args: "Args",
      args_outputs: "Args Outputs",
    }),
    []
  );

  // Handler to open modal for step card generation
  const handleOpenStepCardModal = useCallback(
    (stepId: string, mode: "generate" | "regenerate") => {
      const resourceTypes = stepResources[stepId] || [];
      const resources: GenerateRegenerateModalResource[] = resourceTypes.map(
        (rt) => ({
          id: rt,
          label: resourceLabels[rt] ?? "",
          active: mode === "regenerate" ? canRegenerate(rt) : true,
        })
      );

      setModalResources(resources);
      setModalMode(mode);
      setModalInstructions("");
      setShowGenerateModal(true);
    },
    [stepResources, resourceLabels, canRegenerate]
  );

  // Handler for modal generate/regenerate action
  const handleModalGenerate = useCallback(
    async (selectedResources: string[], instructions: string) => {
      const resourceTypes = selectedResources as ToolResourceType[];
      const agentType = determineAgentType(resourceTypes);
      await handleGenerateResources(
        resourceTypes,
        agentType,
        instructions.trim() || undefined
      );
      setShowGenerateModal(false);
      setModalInstructions("");
    },
    [handleGenerateResources, determineAgentType]
  );

  // Listen for full-page-generate event from layout
  useEffect(() => {
    const handleFullPageGenerate = (
      event: CustomEvent<{ agentId?: string }>
    ) => {
      const agentId = event.detail?.agentId;
      if (agentId) {
        // Open modal instead of directly generating
        handleOpenStepCardModal("all", "generate");
      }
    };
    window.addEventListener(
      "full-page-generate",
      handleFullPageGenerate as EventListener
    );
    return () =>
      window.removeEventListener(
        "full-page-generate",
        handleFullPageGenerate as EventListener
      );
  }, [handleOpenStepCardModal]);

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
        id: "args",
        title: "Args",
        description: "Select and edit args for this tool.",
        filters: [
          {
            key: "argsShowSelected",
            label: "Show selected",
          },
        ],
        resetFields: ["args_ids"],
      },
      {
        id: "args_outputs",
        title: "Args Outputs",
        description: "Select and edit args outputs for this tool.",
        filters: [
          {
            key: "argsOutputsShowSelected",
            label: "Show selected",
          },
        ],
        resetFields: ["args_outputs_ids"],
      },
    ],
    []
  );

  const formFieldKeys = useMemo(
    () => [
      "draftId",
      "argsSearch",
      "argsOutputsSearch",
      "argsShowSelected",
      "argsOutputsShowSelected",
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

  const handleReset = useCallback((stepId: string) => {
    setFormState((prev) => {
      switch (stepId) {
        case "basic":
          return {
            ...prev,
            name: "",
            description: "",
          };
        case "args":
          return {
            ...prev,
            args_ids: [],
          };
        case "args_outputs":
          return {
            ...prev,
            args_outputs_ids: [],
          };
        default:
          return prev;
      }
    });
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
      formData,
      setFormData,
      filters,
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
          const argsSearch = (formData["argsSearch"] as string | undefined) ?? "";
          const argsShowSelected =
            (formData["argsShowSelected"] as boolean | null | undefined) ??
            false;
          const normalizedArgsSearch = argsSearch.trim().toLowerCase();
          let filteredArgsItems = argsItems;

          if (argsShowSelected) {
            filteredArgsItems = filteredArgsItems.filter((item) =>
              formState.args_ids.includes(item.id)
            );
          }

          if (normalizedArgsSearch) {
            filteredArgsItems = filteredArgsItems.filter((item) => {
              const searchable = `${item.name} ${item.description} ${item.field_type}`.toLowerCase();
              return searchable.includes(normalizedArgsSearch);
            });
          }

          const argsSuggestions = currentToolData?.args_suggestions ?? [];

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
              searchTerm={argsSearch}
              onSearchChange={(term) =>
                setFormData({ argsSearch: term || null })
              }
              searchPlaceholder="Search args..."
              {...(filters ? { filters } : {})}
              actions={
                stepResources["args"] &&
                stepResources["args"].length > 0 &&
                currentToolData?.args_agent_id ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const hasRegeneratable = stepResources[
                              "args"
                            ]!.some((rt) => canRegenerate(rt));
                            handleOpenStepCardModal(
                              "args",
                              hasRegeneratable ? "regenerate" : "generate"
                            );
                          }}
                          disabled={
                            disabled ||
                            stepResources["args"]!.some((rt) =>
                              isGenerating(rt)
                            )
                          }
                        >
                          {stepResources["args"]!.some((rt) =>
                            isGenerating(rt)
                          ) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {stepResources["args"]!.some((rt) => canRegenerate(rt))
                          ? "Regenerate"
                          : "Generate"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : undefined
              }
            >
              <div className="space-y-6">
                <SelectableGrid
                  items={filteredArgsItems}
                  selectedId={null}
                  selectedIds={formState.args_ids ?? []}
                  onSelect={(argsId) => {
                    setFormState((prev) => {
                      const isSelected = prev.args_ids.includes(argsId);
                      const nextArgsIds = isSelected
                        ? prev.args_ids.filter((id) => id !== argsId)
                        : [...prev.args_ids, argsId];
                      return {
                        ...prev,
                        args_ids: nextArgsIds,
                      };
                    });
                  }}
                  getId={(item) => item.id}
                  renderItem={(item, isSelected) => {
                    const isSuggested = argsSuggestions.includes(item.id);
                    return (
                      <div
                        className={cn(
                          "relative flex flex-col gap-2 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                          "hover:shadow-md hover:bg-accent/50",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          isSelected && "ring-2 ring-primary bg-accent",
                          isSuggested &&
                            !isSelected &&
                            "ring-2 ring-primary/40"
                        )}
                      >
                        {isSelected && (
                          <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                            <Check className="h-3.5 w-3.5 text-primary-foreground" />
                          </div>
                        )}
                        <div className="space-y-1">
                          <div className="text-sm font-semibold leading-tight">
                            {item.name}
                          </div>
                          {item.description && (
                            <div className="text-xs text-muted-foreground line-clamp-2">
                              {item.description}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {item.field_type && (
                            <span className="rounded-md border px-2 py-0.5">
                              {item.field_type}
                            </span>
                          )}
                          {item.required && (
                            <span className="rounded-md border px-2 py-0.5">
                              Required
                            </span>
                          )}
                          {item.generated && (
                            <span className="rounded-md border px-2 py-0.5">
                              Generated
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  }}
                  emptyMessage={
                    normalizedArgsSearch
                      ? "No args match your search."
                      : "No args available yet."
                  }
                  disabled={disabled}
                />

                <Args
                  args_ids={formState.args_ids ?? []}
                  input_args_fields={
                    currentToolData?.input_args_fields
                      ?.filter(
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
                      })) ?? []
                  }
                  disabled={disabled}
                  {...(createArgsAction ? { createArgsAction } : {})}
                  group_id={currentToolData?.group_id ?? null}
                  agent_id={currentToolData?.args_agent_id ?? null}
                />
              </div>
            </StepCard>
          );
        }

        case "args_outputs": {
          const argsOutputsSearch =
            (formData["argsOutputsSearch"] as string | undefined) ?? "";
          const argsOutputsShowSelected =
            (formData["argsOutputsShowSelected"] as boolean | null | undefined) ??
            false;
          const normalizedArgsOutputsSearch =
            argsOutputsSearch.trim().toLowerCase();
          const selectedArgs = new Set(formState.args_ids);
          let filteredArgsOutputsItems = argsOutputsItems;

          if (selectedArgs.size > 0) {
            filteredArgsOutputsItems = filteredArgsOutputsItems.filter((item) =>
              selectedArgs.has(item.args_id)
            );
          }

          if (argsOutputsShowSelected) {
            filteredArgsOutputsItems = filteredArgsOutputsItems.filter((item) =>
              formState.args_outputs_ids.includes(item.id)
            );
          }

          if (normalizedArgsOutputsSearch) {
            filteredArgsOutputsItems = filteredArgsOutputsItems.filter((item) => {
              const argName = argsNameById.get(item.args_id) ?? "";
              const searchable = `${item.name} ${item.template} ${argName}`.toLowerCase();
              return searchable.includes(normalizedArgsOutputsSearch);
            });
          }

          const argsOutputsSuggestions =
            currentToolData?.args_outputs_suggestions ?? [];

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
              searchTerm={argsOutputsSearch}
              onSearchChange={(term) =>
                setFormData({ argsOutputsSearch: term || null })
              }
              searchPlaceholder="Search args outputs..."
              {...(filters ? { filters } : {})}
              actions={
                stepResources["args_outputs"] &&
                stepResources["args_outputs"].length > 0 &&
                currentToolData?.args_outputs_agent_id ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const hasRegeneratable = stepResources[
                              "args_outputs"
                            ]!.some((rt) => canRegenerate(rt));
                            handleOpenStepCardModal(
                              "args_outputs",
                              hasRegeneratable ? "regenerate" : "generate"
                            );
                          }}
                          disabled={
                            disabled ||
                            stepResources["args_outputs"]!.some((rt) =>
                              isGenerating(rt)
                            )
                          }
                        >
                          {stepResources["args_outputs"]!.some((rt) =>
                            isGenerating(rt)
                          ) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {stepResources["args_outputs"]!.some((rt) =>
                          canRegenerate(rt)
                        )
                          ? "Regenerate"
                          : "Generate"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : undefined
              }
            >
              <div className="space-y-6">
                <SelectableGrid
                  items={filteredArgsOutputsItems}
                  selectedId={null}
                  selectedIds={formState.args_outputs_ids ?? []}
                  onSelect={(argsOutputsId) => {
                    setFormState((prev) => {
                      const isSelected = prev.args_outputs_ids.includes(
                        argsOutputsId
                      );
                      if (isSelected) {
                        return {
                          ...prev,
                          args_outputs_ids: prev.args_outputs_ids.filter(
                            (id) => id !== argsOutputsId
                          ),
                        };
                      }
                      const output = argsOutputsById.get(argsOutputsId);
                      const nextArgsIds =
                        output && !prev.args_ids.includes(output.args_id)
                          ? [...prev.args_ids, output.args_id]
                          : prev.args_ids;
                      return {
                        ...prev,
                        args_ids: nextArgsIds,
                        args_outputs_ids: [...prev.args_outputs_ids, argsOutputsId],
                      };
                    });
                  }}
                  getId={(item) => item.id}
                  renderItem={(item, isSelected) => {
                    const argName = argsNameById.get(item.args_id) ?? "Arg";
                    const isSuggested = argsOutputsSuggestions.includes(item.id);
                    return (
                      <div
                        className={cn(
                          "relative flex flex-col gap-2 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                          "hover:shadow-md hover:bg-accent/50",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          isSelected && "ring-2 ring-primary bg-accent",
                          isSuggested &&
                            !isSelected &&
                            "ring-2 ring-primary/40"
                        )}
                      >
                        {isSelected && (
                          <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                            <Check className="h-3.5 w-3.5 text-primary-foreground" />
                          </div>
                        )}
                        <div className="space-y-1">
                          <div className="text-sm font-semibold leading-tight">
                            {item.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Arg: {argName}
                          </div>
                        </div>
                        {item.template && (
                          <div className="text-xs text-muted-foreground line-clamp-2 font-mono">
                            {item.template}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {item.generated && (
                            <span className="rounded-md border px-2 py-0.5">
                              Generated
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  }}
                  emptyMessage={
                    normalizedArgsOutputsSearch
                      ? "No args outputs match your search."
                      : "No args outputs available yet."
                  }
                  disabled={disabled}
                />

                <ArgsOutputs
                  args_outputs_ids={formState.args_outputs_ids ?? []}
                  output_args_outputs={
                    currentToolData?.output_args_outputs
                      ?.filter(
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
                      })) ?? []
                  }
                  input_args_fields={
                    currentToolData?.input_args_fields
                      ?.filter(
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
                      })) ?? []
                  }
                  disabled={disabled}
                  {...(createArgsOutputsAction
                    ? { createArgsOutputsAction }
                    : {})}
                  group_id={currentToolData?.group_id ?? null}
                  agent_id={currentToolData?.args_outputs_agent_id ?? null}
                />
              </div>
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
      stepResources,
      canRegenerate,
      handleOpenStepCardModal,
      isGenerating,
      argsItems,
      argsOutputsItems,
      argsNameById,
      argsOutputsById,
    ]
  );

  return (
    <TooltipProvider>
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
          nuqsParsers={
            toolSearchParamsClient as Record<string, Parser<unknown>>
          }
        steps={steps}
        getStepStatus={getStepStatus}
        serverData={toolData}
        formFieldKeys={formFieldKeys}
        onReset={(stepId) => handleReset(stepId)}
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

        {/* Generate/Regenerate Modal */}
        {modalMode && (
          <GenerateRegenerateModal
            open={showGenerateModal}
            onOpenChange={setShowGenerateModal}
            resources={modalResources}
            onResourcesChange={setModalResources}
            instructions={modalInstructions}
            onInstructionsChange={setModalInstructions}
            onGenerate={handleModalGenerate}
            isGenerating={modalResources.some((r) =>
              isGenerating(r.id as ToolResourceType)
            )}
            mode={modalMode}
          />
        )}
      </div>
    </TooltipProvider>
  );
}

// Memoize component to prevent re-renders when only prop references change
export default React.memo(ToolComponent, (prevProps, nextProps) => {
  // Compare toolData by resource IDs, not object reference
  const prevIds = {
    name: prevProps.toolData?.name,
    description: prevProps.toolData?.description,
    args_ids: prevProps.toolData?.args_ids,
    args_outputs_ids: prevProps.toolData?.args_outputs_ids,
  };
  const nextIds = {
    name: nextProps.toolData?.name,
    description: nextProps.toolData?.description,
    args_ids: nextProps.toolData?.args_ids,
    args_outputs_ids: nextProps.toolData?.args_outputs_ids,
  };

  // Compare primitive props
  if (
    prevProps.toolId !== nextProps.toolId ||
    JSON.stringify(prevIds) !== JSON.stringify(nextIds)
  ) {
    return false; // Props changed, re-render
  }

  // Compare function props by reference (should be stable from server actions)
  if (
    prevProps.saveToolAction !== nextProps.saveToolAction ||
    prevProps.patchToolDraftAction !== nextProps.patchToolDraftAction ||
    prevProps.createArgsAction !== nextProps.createArgsAction ||
    prevProps.createArgsOutputsAction !== nextProps.createArgsOutputsAction
  ) {
    return false; // Function props changed, re-render
  }

  // All props are equivalent, skip re-render
  return true;
});
