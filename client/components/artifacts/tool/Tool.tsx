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
import { ReadOnlyBanner } from "@/components/common/forms/ReadOnlyBanner";
import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
import { Args } from "@/components/resources/Args";
import { ArgPositions } from "@/components/resources/ArgPositions";
import { ArgsOutputs } from "@/components/resources/ArgsOutputs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useProfile } from "@/contexts/profile-context";
import { useDrafts } from "@/contexts/draft-context";
import { useArtifactAi } from "@/hooks/use-artifact-ai";
import { useFlushRegistry } from "@/hooks/use-flush-registry";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { parseAsBoolean, parseAsString, type Parser } from "nuqs";

// Types defined inline using InputOf/OutputOf
type SaveToolIn = InputOf<"/api/v5/artifacts/tools/save", "post">;
type SaveToolOut = OutputOf<"/api/v5/artifacts/tools/save", "post">;
type CreateDraftArgsIn = InputOf<"/api/v5/resources/args", "post">;
type CreateDraftArgsOut = OutputOf<"/api/v5/resources/args", "post">;
type CreateDraftArgsOutputsIn = InputOf<
  "/api/v5/resources/args_outputs",
  "post"
>;
type CreateDraftArgsOutputsOut = OutputOf<
  "/api/v5/resources/args_outputs",
  "post"
>;
type CreateDraftArgPositionsIn = {
  body: {
    agent_id: string;
    group_id: string;
    tool_id: string;
    args_id: string;
    value: number;
    mcp: boolean;
  };
};
type CreateDraftArgPositionsOut = {
  id?: string | null;
};
type PatchToolDraftIn = InputOf<"/api/v5/artifacts/tools/draft", "patch">;
type PatchToolDraftOut = OutputOf<"/api/v5/artifacts/tools/draft", "patch">;

type ToolData = OutputOf<"/api/v5/artifacts/tools/get", "post">;
type ToolDataWithArgPositions = ToolData & {
  arg_positions?: {
    current?: Array<{
      id?: string | null;
      args_id?: string | null;
      value?: number | null;
      generated?: boolean | null;
    }> | null;
    resources?: Array<{
      id?: string | null;
      args_id?: string | null;
      value?: number | null;
      generated?: boolean | null;
    }> | null;
    suggestions?: string[] | null;
    required?: boolean | null;
    show_ai_generate?: boolean | null;
    create_tool_id?: string | null;
  } | null;
};

// Resource types for tools
type ToolResourceType = "args" | "arg_positions" | "args_outputs";

const TOOL_FLUSH_KEYS = ["args", "arg_positions", "args_outputs"] as const;

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
  createArgPositionsAction?: (
    input: CreateDraftArgPositionsIn
  ) => Promise<CreateDraftArgPositionsOut>;
}

function ToolComponent({
  toolId,
  toolData,
  saveToolAction,
  patchToolDraftAction,
  createArgsAction,
  createArgsOutputsAction,
  createArgPositionsAction,
}: ToolProps) {
  const router = useRouter();
  const isEditMode = !!toolId;
  const { profile } = useProfile();
  const { selectedDraftId, setSelectedDraftId, isAutosaveEnabled } = useDrafts();
  const { registerFlushCallbacks, flushAllResources } =
    useFlushRegistry<Record<string, unknown>>(TOOL_FLUSH_KEYS);
  // Generation state for AI workflows
  const VALID_TOOL_RESOURCE_TYPES: ToolResourceType[] = ["args", "arg_positions", "args_outputs"];
  const { isGenerating, makeOnGenerationComplete, generate } =
    useArtifactAi({
      artifactType: "tool",
      validResourceTypes: VALID_TOOL_RESOURCE_TYPES,
    });

  // nuqs parsers for URL-backed state (will be passed to GenericForm)
  const toolSearchParamsClient = useMemo(
    () => ({
      // Draft ID (URL-backed, updated when draft is created)
      draftId: parseAsString,
      argsSearch: parseAsString,
      argPositionsSearch: parseAsString,
      argsOutputsSearch: parseAsString,
      argsShowSelected: parseAsBoolean,
      argPositionsShowSelected: parseAsBoolean,
      argsOutputsShowSelected: parseAsBoolean,
    }),
    []
  );

  // Local form state (not in URL) - stores only resource IDs
  const toolDataRef = React.useRef(toolData);
  React.useEffect(() => {
    toolDataRef.current = toolData;
  }, [toolData]);
  const toolDataAny = toolData as ToolDataWithArgPositions | undefined;

  // Memoize toolData fields used in renderStep
  const stableToolDataFields = React.useMemo(() => {
    if (!toolDataAny) return null;
    const s = toolDataAny;
    const currentArgsIds = (s.args?.current ?? [])
      .map((a: any) => a.id)
      .filter((id: unknown): id is string => !!id && typeof id === "string");
    const currentArgsOutputsIds = (s.args_outputs?.current ?? [])
      .map((a: any) => a.id)
      .filter((id: unknown): id is string => !!id && typeof id === "string");
    const currentArgPositionIds = (s.arg_positions?.current ?? [])
      .map((a: any) => a.id)
      .filter((id: unknown): id is string => !!id && typeof id === "string");
    return {
      group_id: toolDataAny.group_id,
      args_ids: currentArgsIds,
      arg_position_ids: currentArgPositionIds,
      args_outputs_ids: currentArgsOutputsIds,
      args_resources: s.args?.current ?? [],
      arg_positions_resources: s.arg_positions?.current ?? [],
      args_outputs_resources: s.args_outputs?.current ?? [],
      args: s.args?.resources ?? [],
      arg_positions: s.arg_positions?.resources ?? [],
      args_outputs: s.args_outputs?.resources ?? [],
      args_suggestions: s.args?.suggestions ?? [],
      arg_positions_suggestions: s.arg_positions?.suggestions ?? [],
      args_required: s.args?.required ?? false,
      arg_positions_required: s.arg_positions?.required ?? false,
      args_outputs_suggestions: s.args_outputs?.suggestions ?? [],
      args_outputs_required: s.args_outputs?.required ?? false,
      args_show_ai_generate: s.args?.show_ai_generate ?? false,
      arg_positions_show_ai_generate: s.arg_positions?.show_ai_generate ?? false,
      args_outputs_show_ai_generate: s.args_outputs?.show_ai_generate ?? false,
      args_create_tool_id: s.args?.create_tool_id ?? null,
      arg_positions_create_tool_id: s.arg_positions?.create_tool_id ?? null,
      args_outputs_create_tool_id: s.args_outputs?.create_tool_id ?? null,
      names: s.names,
      descriptions: s.descriptions,
      flags: s.flags,
    };
  }, [toolDataAny]);

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
        case "arg_positions":
          return stableToolDataFields.arg_positions_resources.some((r: any) => r.generated);
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
          generated: arg.generated ?? false,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)) ?? []
    );
  }, [stableToolDataFields?.args]);

  const argPositionsItems = useMemo(() => {
    return (
      (stableToolDataFields?.arg_positions as any[] | undefined)
        ?.filter(
          (ap: any): ap is NonNullable<typeof ap> =>
            !!ap && !!ap.id && !!ap.args_id && ap.value !== null && ap.value !== undefined
        )
        .map((ap: any) => ({
          id: ap.id!,
          args_id: ap.args_id!,
          value: ap.value!,
          generated: ap.generated ?? false,
        }))
        .sort((a: any, b: any) => a.value - b.value) ?? []
    );
  }, [stableToolDataFields?.arg_positions]);

  const argPositionByArgId = useMemo(() => {
    const map = new Map<string, { id: string; value: number }>();
    argPositionsItems.forEach((item: any) => {
      map.set(item.args_id, { id: item.id, value: item.value });
    });
    return map;
  }, [argPositionsItems]);

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
    const data = toolDataRef.current as
      | (ToolData & { arg_positions?: any })
      | undefined;
    if (!data) {
      return {
        name: "",
        description: "",
        args_ids: [] as string[],
        arg_position_ids: [] as string[],
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
      arg_position_ids: (data.arg_positions?.current ?? [])
        .map((a: any) => a.id)
        .filter((id: unknown): id is string => !!id && typeof id === "string"),
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

  useEffect(() => {
    setFormState((prev) => {
      const selectedArgs = new Set(prev.args_ids);
      const orderedArgIds = prev.args_ids
        .map((argId) => ({
          argId,
          item: argPositionByArgId.get(argId),
        }))
        .filter((entry) => !!entry.item)
        .sort((a, b) => (a.item?.value ?? 0) - (b.item?.value ?? 0))
        .map((entry) => entry.item!.id);

      const nextArgPositionIds = orderedArgIds.filter((id) => {
        const argIdForPosition = [...argPositionByArgId.entries()].find(
          ([, value]) => value.id === id
        )?.[0];
        return argIdForPosition ? selectedArgs.has(argIdForPosition) : false;
      });

      if (JSON.stringify(nextArgPositionIds) === JSON.stringify(prev.arg_position_ids)) {
        return prev;
      }

      return {
        ...prev,
        arg_position_ids: nextArgPositionIds,
      };
    });
  }, [argPositionByArgId, formState.args_ids]);

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
  const argPositionsIdsStr = React.useMemo(
    () =>
      JSON.stringify(
        (toolDataAny?.arg_positions?.current ?? [])
          .map((a: any) => a.id)
          .filter(Boolean)
      ),
    [toolDataAny?.arg_positions]
  );

  // Update form state when server data changes
  useEffect(() => {
    const newState = getInitialFormState();
    setFormState((prev) => {
      if (
        prev.name !== newState.name ||
        prev.description !== newState.description ||
        JSON.stringify(prev.args_ids) !== JSON.stringify(newState.args_ids) ||
        JSON.stringify(prev.arg_position_ids) !==
          JSON.stringify(newState.arg_position_ids) ||
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
    argPositionsIdsStr,
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
        arg_position_ids: formState.arg_position_ids,
        args_outputs_ids: formState.args_outputs_ids,
      }),
    [
      draftId,
      stableToolDataFields?.names?.resource?.id,
      stableToolDataFields?.descriptions?.resource?.id,
      stableToolDataFields?.flags,
      formState.args_ids,
      formState.arg_position_ids,
      formState.args_outputs_ids,
    ]
  );

  const lastPatchedKeyRef = React.useRef<string | null>(null);

  useEffect(() => {
    const hasResourceIds =
      formState.args_ids.length > 0 ||
      formState.arg_position_ids.length > 0 ||
      formState.args_outputs_ids.length > 0;

    if (!hasResourceIds || !patchToolDraftActionRef.current) {
      return;
    }

    if (lastPatchedKeyRef.current === draftPatchKey) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        if (!patchToolDraftActionRef.current) return;
        const currentFields = toolDataRef.current as ToolDataWithArgPositions | undefined;
        const result = await patchToolDraftActionRef.current({
          body: {
            input_draft_id: draftId || null,
            name_id: currentFields?.names?.resource?.id ?? null,
            description_id: currentFields?.descriptions?.resource?.id ?? null,
            flag_id: currentFields?.flags?.current?.flag_option_id ?? null,
            arg_ids: formState.args_ids,
            arg_position_ids: formState.arg_position_ids,
            args_output_ids: formState.args_outputs_ids,
            expected_version: lastSavedVersionRef.current,
          },
        } as PatchToolDraftIn);

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
  }, [
    draftPatchKey,
    draftId,
    formState.args_ids,
    formState.arg_position_ids,
    formState.args_outputs_ids,
  ]);

  const handleGenerateResources = useCallback(
    async (
      resourceTypes: ToolResourceType[],
      _agentType: string | null,
      userInstructions?: string
    ) => {
      // Read draftId from formData
      const formData = formDataRef.current;
      const draftId = (formData["draftId"] as string | undefined) ?? null;

      generate(resourceTypes, {
        user_instructions: userInstructions ? [userInstructions] : null,
        draft_id: draftId || null,
        artifact_id: toolId || null,
      });
    },
    [generate, toolId]
  );

  // Disabled logic based on can_edit flag - check in both new and edit modes
  const disabled = useMemo(() => {
    if (!toolData) return false;
    return !toolData.can_edit;
  }, [toolData]);

  // Submit handler for GenericForm
  const handleSubmit = useCallback(
    async (_formData: Record<string, unknown>) => {
      // Flush all pending resource creations before saving
      if (!isAutosaveEnabled) {
        await flushAllResources();
      }

      // Validate required resource IDs
      if (toolData?.args?.required && formState.args_ids.length === 0) {
        toast.error("Args are required");
        throw new Error("Args are required");
      }

      if (
        toolDataAny?.arg_positions?.required &&
        formState.arg_position_ids.length === 0
      ) {
        toast.error("Arg positions are required");
        throw new Error("Arg positions are required");
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

      try {
        await saveToolAction({
          body: {
            input_tool_id: isEditMode && toolId ? toolId : null,
            name_id: nameId,
            description_id: toolData?.descriptions?.resource?.id ?? null,
            flag_id: toolData?.flags?.current?.flag_option_id ?? null,
            arg_ids: formState.args_ids?.length ? formState.args_ids : null,
            arg_position_ids: formState.arg_position_ids?.length ? formState.arg_position_ids : null,
            args_output_ids: formState.args_outputs_ids?.length ? formState.args_outputs_ids : null,
          },
        } as SaveToolIn);
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
      toolDataAny?.arg_positions?.required,
      toolData?.args_outputs?.required,
      toolData?.names?.resource?.id,
      toolData?.descriptions?.resource?.id,
      toolData?.flags,
      isAutosaveEnabled,
      flushAllResources,
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
        case "arg_positions": {
          const hasArgPositions = (formState.arg_position_ids?.length ?? 0) > 0;
          if (!hasName || !hasDescription) return "pending";
          return hasArgPositions ? "completed" : "active";
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
      arg_positions: ["arg_positions"],
      args_outputs: ["args_outputs"],
      all: ["args", "arg_positions", "args_outputs"],
    }),
    []
  );

  // Direct step generation handler (bypasses modal)
  const handleDirectStepGenerate = useCallback(
    (stepId: string, _mode: "generate" | "regenerate") => {
      const resources = stepResources[stepId];
      if (resources) {
        handleGenerateResources(resources, null);
      }
    },
    [stepResources, handleGenerateResources],
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
        id: "arg_positions",
        title: "Arg Positions",
        description: "Arrange argument ordering for this tool.",
        filters: [
          {
            key: "argPositionsShowSelected",
            label: "Show selected",
          },
        ],
        resetFields: ["arg_position_ids"],
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
      "argPositionsSearch",
      "argsOutputsSearch",
      "argsShowSelected",
      "argPositionsShowSelected",
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
      case "arg_positions":
        return "Arg positions reset";
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
        case "arg_positions":
          return {
            ...prev,
            arg_position_ids: [],
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
                    onOpenModal={handleDirectStepGenerate}
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
                          f.required !== null
                      )
                      .map((f) => ({
                        args_id: f.id!,
                        name: f.name!,
                        description: f.description ?? "",
                        field_type: f.field_type!,
                        required: f.required!,
                        default_value: f.default_value ?? "",
                        generated: f.generated ?? false,
                      }))
                  }
                  disabled={disabled}
                  {...(createArgsAction ? { createArgsAction } : {})}

                  create_tool_id={currentToolData?.args_create_tool_id ?? null}
                  registerFlush={registerFlushCallbacks["args"]}
                  isAutosaveEnabled={isAutosaveEnabled}
                />
              </div>
            </StepCard>
          );
        }

        case "arg_positions": {
          const argPositionsSearch =
            (formData["argPositionsSearch"] as string | undefined) ?? "";
          const argPositionsShowSelected =
            (formData["argPositionsShowSelected"] as boolean | null | undefined) ??
            false;
          const normalizedArgPositionsSearch =
            argPositionsSearch.trim().toLowerCase();

          let filteredArgsForPositions = argsItems.filter((item) =>
            formState.args_ids.includes(item.id)
          );

          if (argPositionsShowSelected) {
            const selectedPositionIds = new Set(formState.arg_position_ids);
            filteredArgsForPositions = filteredArgsForPositions.filter((item) => {
              const argPosition = argPositionByArgId.get(item.id);
              return argPosition ? selectedPositionIds.has(argPosition.id) : false;
            });
          }

          if (normalizedArgPositionsSearch) {
            filteredArgsForPositions = filteredArgsForPositions.filter((item) => {
              const searchable = `${item.name} ${item.description}`.toLowerCase();
              return searchable.includes(normalizedArgPositionsSearch);
            });
          }

          const argPositionsSuggestions =
            currentToolData?.arg_positions_suggestions ?? [];

          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              resetFields={["arg_position_ids"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              searchTerm={argPositionsSearch}
              onSearchChange={(term) =>
                setFormData({ argPositionsSearch: term || null })
              }
              searchPlaceholder="Search arg positions..."
              {...(filters ? { filters } : {})}
              actions={
                stepResources["arg_positions"] &&
                stepResources["arg_positions"].length > 0 &&
                currentToolData?.arg_positions_show_ai_generate ? (
                  <StepCardAiButton
                    stepId="arg_positions"
                    resourceTypes={stepResources["arg_positions"] ?? []}
                    canRegenerate={(rt) => canRegenerate(rt as ToolResourceType)}
                    isGenerating={(rt) => isGenerating(rt as ToolResourceType)}
                    onOpenModal={handleDirectStepGenerate}
                    disabled={disabled}
                  />
                ) : undefined
              }
            >
              <div className="space-y-6">
                <SelectableGrid
                  items={filteredArgsForPositions}
                  selectedId={null}
                  selectedIds={formState.args_ids ?? []}
                  onSelect={() => {}}
                  getId={(item) => item.id}
                  renderItem={(item) => {
                    const ap = argPositionByArgId.get(item.id);
                    const isSuggested = ap ? argPositionsSuggestions.includes(ap.id) : false;
                    return (
                      <div
                        className={cn(
                          "relative flex flex-col gap-2 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                          isSuggested && "ring-2 ring-primary/40"
                        )}
                      >
                        <div className="space-y-1">
                          <div className="text-sm font-semibold leading-tight">
                            {item.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Position: {(ap?.value ?? 0) + 1}
                          </div>
                        </div>
                      </div>
                    );
                  }}
                  emptyMessage={
                    normalizedArgPositionsSearch
                      ? "No args match your search."
                      : "No selected args available for positions."
                  }
                  disabled
                />

                <ArgPositions
                  args_ids={formState.args_ids ?? []}
                  args_resources={(currentToolData?.args ?? []).map((arg) => ({
                    id: arg.id,
                    name: arg.name,
                  }))}
                  arg_position_ids={formState.arg_position_ids ?? []}
                  arg_position_resources={((currentToolData?.arg_positions ?? []) as any[]).map(
                    (ap: any) => ({
                      id: ap.id,
                      args_id: ap.args_id,
                      value: ap.value,
                      generated: ap.generated ?? false,
                    })
                  )}
                  disabled={disabled}

                  tool_id={toolId ?? null}
                  create_tool_id={currentToolData?.arg_positions_create_tool_id ?? null}
                  onPositionIdsChange={(ids) =>
                    setFormState((prev) => ({
                      ...prev,
                      arg_position_ids: ids,
                    }))
                  }
                  {...(createArgPositionsAction
                    ? { createArgPositionsAction }
                    : {})}
                  registerFlush={registerFlushCallbacks["arg_positions"]}
                  isAutosaveEnabled={isAutosaveEnabled}
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
                    onOpenModal={handleDirectStepGenerate}
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
                          f.required !== null
                      )
                      .map((f) => ({
                        args_id: f.id!,
                        name: f.name!,
                        description: f.description ?? "",
                        field_type: f.field_type!,
                        required: f.required!,
                        default_value: f.default_value ?? "",
                        generated: f.generated ?? false,
                      }))
                  }
                  disabled={disabled}
                  {...(createArgsOutputsAction
                    ? { createArgsOutputsAction }
                    : {})}

                  registerFlush={registerFlushCallbacks["args_outputs"]}
                  isAutosaveEnabled={isAutosaveEnabled}
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
      createArgPositionsAction,
      createArgsOutputsAction,
      stepResources,
      canRegenerate,
      handleDirectStepGenerate,
      isGenerating,
      argsItems,
      argPositionsItems,
      argPositionByArgId,
      argsOutputsItems,
      argsNameById,
      argsOutputsById,
      registerFlushCallbacks,
      isAutosaveEnabled,
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

      </div>
    </TooltipProvider>
  );
}

// Memoize component to prevent re-renders when only prop references change
export default React.memo(ToolComponent, (prevProps, nextProps) => {
  const prevToolDataAny = prevProps.toolData as ToolDataWithArgPositions | undefined;
  const nextToolDataAny = nextProps.toolData as ToolDataWithArgPositions | undefined;

  // Compare toolData by selected section resource IDs, not object reference
  const prevIds = {
    name: prevProps.toolData?.names?.resource?.name,
    description: prevProps.toolData?.descriptions?.resource?.description,
    args_ids: prevProps.toolData?.args?.current?.map((a) => a.id),
    arg_position_ids: prevToolDataAny?.arg_positions?.current?.map(
      (a: { id?: string | null }) => a.id
    ),
    args_outputs_ids: prevProps.toolData?.args_outputs?.current?.map((a) => a.id),
  };
  const nextIds = {
    name: nextProps.toolData?.names?.resource?.name,
    description: nextProps.toolData?.descriptions?.resource?.description,
    args_ids: nextProps.toolData?.args?.current?.map((a) => a.id),
    arg_position_ids: nextToolDataAny?.arg_positions?.current?.map(
      (a: { id?: string | null }) => a.id
    ),
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
    prevProps.createArgPositionsAction !== nextProps.createArgPositionsAction ||
    prevProps.createArgsOutputsAction !== nextProps.createArgsOutputsAction
  ) {
    return false; // Function props changed, re-render
  }

  // All props are equivalent, skip re-render
  return true;
});
