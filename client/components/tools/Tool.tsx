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
import { StepCardAiButton } from "@/components/common/forms/StepCardAiButton";
import type { GenerateRegenerateModalResource } from "@/components/common/GenerateRegenerateModal";
import { GenerateRegenerateModal } from "@/components/common/GenerateRegenerateModal";
import { ReadOnlyBanner } from "@/components/common/ReadOnlyBanner";
import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
import { Args } from "@/components/resources/Args";
import { ArgsOutputs } from "@/components/resources/ArgsOutputs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { parseAsBoolean, parseAsString, type Parser } from "nuqs";

// Types defined inline using InputOf/OutputOf
type SaveToolIn = InputOf<"/api/v4/artifacts/tools/save", "post">;
type SaveToolOut = OutputOf<"/api/v4/artifacts/tools/save", "post">;
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
type PatchToolDraftIn = InputOf<"/api/v4/artifacts/tools/draft", "patch">;
type PatchToolDraftOut = OutputOf<"/api/v4/artifacts/tools/draft", "patch">;

type ToolData = OutputOf<"/api/v4/artifacts/tools/get", "post">;

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
    const s = toolData;
    const currentArgsIds = (s.args?.current ?? [])
      .map((a) => a.id)
      .filter((id): id is string => !!id);
    const currentArgsOutputsIds = (s.args_outputs?.current ?? [])
      .map((a) => a.id)
      .filter((id): id is string => !!id);
    return {
      group_id: toolData.group_id,
      args_ids: currentArgsIds,
      args_outputs_ids: currentArgsOutputsIds,
      args_resources: s.args?.current ?? [],
      args_outputs_resources: s.args_outputs?.current ?? [],
      args: s.args?.resources ?? [],
      args_outputs: s.args_outputs?.resources ?? [],
      args_suggestions: s.args?.suggestions ?? [],
      args_required: s.args?.required ?? false,
      args_outputs_suggestions: s.args_outputs?.suggestions ?? [],
      args_outputs_required: s.args_outputs?.required ?? false,
      args_show_ai_generate: s.args?.show_ai_generate ?? false,
      args_outputs_show_ai_generate: s.args_outputs?.show_ai_generate ?? false,
      names: s.names,
      descriptions: s.descriptions,
      flags: s.flags,
    };
  }, [toolData]);

  // Helper to check if a resource type can be regenerated
  const canRegenerate = useCallback(
    (resourceType: ToolResourceType): boolean => {
      if (!stableToolDataFields) return false;
      switch (resourceType) {
        case "args":
          return stableToolDataFields.args_resources.some(
            (r) => r.generated
          );
        case "args_outputs":
          return stableToolDataFields.args_outputs_resources.some(
            (r) => r.generated
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
    const currentName = data.names?.resource;
    const currentDesc = data.descriptions?.resource;
    return {
      name: currentName?.name || "",
      description: currentDesc?.description || "",
      args_ids: (data.args?.current ?? [])
        .map((a) => a.id)
        .filter((id): id is string => !!id),
      args_outputs_ids: (data.args_outputs?.current ?? [])
        .map((a) => a.id)
        .filter((id): id is string => !!id),
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

  // Memoize stringified array dependencies (derive from resources.current)
  const argsIdsStr = React.useMemo(
    () =>
      JSON.stringify(
        (toolData?.args?.current ?? [])
          .map((a) => a.id)
          .filter(Boolean)
      ),
    [toolData?.args]
  );
  const argsOutputsIdsStr = React.useMemo(
    () =>
      JSON.stringify(
        (toolData?.args_outputs?.current ?? [])
          .map((a) => a.id)
          .filter(Boolean)
      ),
    [toolData?.args_outputs]
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
    toolData?.names?.resource,
    toolData?.descriptions?.resource,
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

  const draftPatchKey = useMemo(
    () =>
      JSON.stringify({
        draftId: draftId || null,
        name_id: stableToolDataFields?.names?.resource?.id ?? null,
        description_id: stableToolDataFields?.descriptions?.resource?.id ?? null,
        active_flag_id: stableToolDataFields?.flags?.current?.flag_option_id ?? null,
        args_ids: formState.args_ids,
        args_outputs_ids: formState.args_outputs_ids,
      }),
    [
      draftId,
      stableToolDataFields?.names?.resource?.id,
      stableToolDataFields?.descriptions?.resource?.id,
      stableToolDataFields?.flags,
      formState.args_ids,
      formState.args_outputs_ids,
    ]
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
        const currentFields = toolDataRef.current;
        const result = await patchToolDraftActionRef.current({
          body: {
            input_draft_id: draftId || null,
            group_id: currentFields?.group_id ?? null,
            names: {
              resource_id: currentFields?.names?.resource?.id ?? null,
              create_tool_id: currentFields?.names?.create_tool_id ?? null,
              link_tool_id: currentFields?.names?.link_tool_id ?? null,
            },
            descriptions: {
              resource_id: currentFields?.descriptions?.resource?.id ?? null,
              create_tool_id: currentFields?.descriptions?.create_tool_id ?? null,
              link_tool_id: currentFields?.descriptions?.link_tool_id ?? null,
            },
            flags: {
              resource_id: currentFields?.flags?.current?.flag_option_id ?? null,
              create_tool_id: currentFields?.flags?.create_tool_id ?? null,
              link_tool_id: currentFields?.flags?.link_tool_id ?? null,
            },
            args: {
              resource_ids: formState.args_ids,
              create_tool_id: currentFields?.args?.create_tool_id ?? null,
              link_tool_id: currentFields?.args?.link_tool_id ?? null,
            },
            args_outputs: {
              resource_ids: formState.args_outputs_ids,
              create_tool_id: currentFields?.args_outputs?.create_tool_id ?? null,
              link_tool_id: currentFields?.args_outputs?.link_tool_id ?? null,
            },
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
      args_resources?: Array<{ id?: string | null }>;
      args_outputs_resources?: Array<{ id?: string | null }>;
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

          if (data.args_resources && data.args_resources.length > 0) {
            // For arrays, append new IDs (avoid duplicates)
            const newArgsIds = data.args_resources
              .map((r) => r?.id)
              .filter((id): id is string => !!id)
              .filter(
              (id) => !prev.args_ids.includes(id)
            );
            updates.args_ids = [...prev.args_ids, ...newArgsIds];
          }
          if (
            data.args_outputs_resources &&
            data.args_outputs_resources.length > 0
          ) {
            // For arrays, append new IDs (avoid duplicates)
            const newArgsOutputsIds = data.args_outputs_resources
              .map((r) => r?.id)
              .filter((id): id is string => !!id)
              .filter(
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

  const handleGenerateResources = useCallback(
    async (
      resourceTypes: ToolResourceType[],
      _agentType: string | null,
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

      // Emit tool_generate event with resource_types
      socket.emit("tool_generate", {
        resource_types: resourceTypes,
        user_instructions: userInstructions ? [userInstructions] : null,
        draft_id: draftId || null,
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
    const toolName = toolData?.names?.resource?.name;
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
      if (toolData?.args?.required && formState.args_ids.length === 0) {
        toast.error("Args are required");
        throw new Error("Args are required");
      }

      if (
        toolData?.args_outputs?.required &&
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

      // Get resource IDs from current selections
      const nameId = toolData?.names?.resource?.id;
      if (!nameId) {
        toast.error("A name resource must be selected");
        throw new Error("A name resource must be selected");
      }
      const groupId = toolData?.group_id;
      if (!groupId) {
        toast.error("Group ID is required");
        throw new Error("Group ID is required");
      }

      try {
        await saveToolAction({
          body: {
            group_id: groupId,
            input_tool_id: isEditMode && toolId ? toolId : null,
            names: {
              resource_id: nameId,
              create_tool_id: toolData?.names?.create_tool_id ?? null,
              link_tool_id: toolData?.names?.link_tool_id ?? null,
            },
            descriptions: {
              resource_id: toolData?.descriptions?.resource?.id ?? null,
              create_tool_id: toolData?.descriptions?.create_tool_id ?? null,
              link_tool_id: toolData?.descriptions?.link_tool_id ?? null,
            },
            flags: {
              resource_id: toolData?.flags?.current?.flag_option_id ?? null,
              create_tool_id: toolData?.flags?.create_tool_id ?? null,
              link_tool_id: toolData?.flags?.link_tool_id ?? null,
            },
            args: {
              resource_ids: formState.args_ids,
              create_tool_id: toolData?.args?.create_tool_id ?? null,
              link_tool_id: toolData?.args?.link_tool_id ?? null,
            },
            args_outputs: {
              resource_ids: formState.args_outputs_ids,
              create_tool_id: toolData?.args_outputs?.create_tool_id ?? null,
              link_tool_id: toolData?.args_outputs?.link_tool_id ?? null,
            },
          },
        });
        toast.success(
          `Tool ${isEditMode ? "updated" : "created"} successfully!`
        );
        router.push("/intelligence/tools");
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
      toolData?.args?.required,
      toolData?.args_outputs?.required,
      toolData?.group_id,
      toolData?.names?.resource?.id,
      toolData?.names?.create_tool_id,
      toolData?.names?.link_tool_id,
      toolData?.descriptions?.resource?.id,
      toolData?.descriptions?.create_tool_id,
      toolData?.descriptions?.link_tool_id,
      toolData?.flags,
      toolData?.args?.create_tool_id,
      toolData?.args?.link_tool_id,
      toolData?.args_outputs?.create_tool_id,
      toolData?.args_outputs?.link_tool_id,
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
      await handleGenerateResources(
        resourceTypes,
        null,
        instructions.trim() || undefined
      );
      setShowGenerateModal(false);
      setModalInstructions("");
    },
    [handleGenerateResources]
  );

  // Listen for full-page-generate event from layout
  useEffect(() => {
    const handleFullPageGenerate = () => {
      handleOpenStepCardModal("all", "generate");
    };
    window.addEventListener("full-page-generate", handleFullPageGenerate);
    return () =>
      window.removeEventListener("full-page-generate", handleFullPageGenerate);
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
      backUrl: "/intelligence/tools",
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
                currentToolData?.args_show_ai_generate ? (
                  <StepCardAiButton
                    stepId="args"
                    resourceTypes={stepResources["args"] ?? []}
                    canRegenerate={(rt) => canRegenerate(rt as ToolResourceType)}
                    isGenerating={(rt) => isGenerating(rt as ToolResourceType)}
                    onOpenModal={handleOpenStepCardModal}
                    disabled={disabled}
                  />
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
                    (currentToolData?.args ?? [])
                      .filter(
                        (f) =>
                          f.id !== null &&
                          f.name !== null &&
                          f.field_type !== null &&
                          f.required !== null &&
                          f.position !== null
                      )
                      .map((f) => ({
                        args_id: f.id!,
                        name: f.name!,
                        description: f.description ?? "",
                        field_type: f.field_type!,
                        required: f.required!,
                        default_value: f.default_value ?? "",
                        position: f.position!,
                        generated: f.generated ?? false,
                      }))
                  }
                  disabled={disabled}
                  {...(createArgsAction ? { createArgsAction } : {})}
                  group_id={currentToolData?.group_id ?? null}
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
                currentToolData?.args_outputs_show_ai_generate ? (
                  <StepCardAiButton
                    stepId="args_outputs"
                    resourceTypes={stepResources["args_outputs"] ?? []}
                    canRegenerate={(rt) => canRegenerate(rt as ToolResourceType)}
                    isGenerating={(rt) => isGenerating(rt as ToolResourceType)}
                    onOpenModal={handleOpenStepCardModal}
                    disabled={disabled}
                  />
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
                    (currentToolData?.args_outputs ?? [])
                      .filter(
                        (o) =>
                          o.id !== null &&
                          o.args_id !== null &&
                          o.name !== null
                      )
                      .map((o) => ({
                        args_outputs_id: o.id!,
                        args_id: o.args_id!,
                        name: o.name!,
                        template: o.template ?? "",
                        generated: o.generated ?? false,
                      }))
                  }
                  input_args_fields={
                    (currentToolData?.args ?? [])
                      .filter(
                        (f) =>
                          f.id !== null &&
                          f.name !== null &&
                          f.field_type !== null &&
                          f.required !== null &&
                          f.position !== null
                      )
                      .map((f) => ({
                        args_id: f.id!,
                        name: f.name!,
                        description: f.description ?? "",
                        field_type: f.field_type!,
                        required: f.required!,
                        default_value: f.default_value ?? "",
                        position: f.position!,
                        generated: f.generated ?? false,
                      }))
                  }
                  disabled={disabled}
                  {...(createArgsOutputsAction
                    ? { createArgsOutputsAction }
                    : {})}
                  group_id={currentToolData?.group_id ?? null}
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
  // Compare toolData by selected section resource IDs, not object reference
  const prevIds = {
    name: prevProps.toolData?.names?.resource?.name,
    description: prevProps.toolData?.descriptions?.resource?.description,
    args_ids: prevProps.toolData?.args?.current?.map((a) => a.id),
    args_outputs_ids: prevProps.toolData?.args_outputs?.current?.map((a) => a.id),
  };
  const nextIds = {
    name: nextProps.toolData?.names?.resource?.name,
    description: nextProps.toolData?.descriptions?.resource?.description,
    args_ids: nextProps.toolData?.args?.current?.map((a) => a.id),
    args_outputs_ids: nextProps.toolData?.args_outputs?.current?.map((a) => a.id),
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
