"use client";

import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  GenericForm,
  type StepStatus,
} from "@/components/common/forms/GenericForm";
import { ReadOnlyBanner } from "@/components/common/forms/ReadOnlyBanner";
import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
import { StepCard } from "@/components/common/forms/StepCard";
import { StepCardAiButton } from "@/components/common/forms/StepCardAiButton";
import { ArgPositions } from "@/components/resources/ArgPositions";
import { Args } from "@/components/resources/Args";
import { ArgsOutputs } from "@/components/resources/ArgsOutputs";
import { Descriptions } from "@/components/resources/Descriptions";
import { Flags } from "@/components/resources/Flags";
import { Names } from "@/components/resources/Names";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useDrafts } from "@/contexts/draft-context";
import { useArtifactAi } from "@/hooks/use-artifact-ai";
import { useFlushRegistry } from "@/hooks/use-flush-registry";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { parseAsBoolean, parseAsString, type Parser } from "nuqs";

type CreateToolIn = InputOf<"/tool/create", "post">;
type CreateToolOut = OutputOf<"/tool/create", "post">;
type UpdateToolIn = InputOf<"/tool/update", "post">;
type UpdateToolOut = OutputOf<"/tool/update", "post">;
type PatchToolDraftIn = InputOf<"/tool/draft", "patch">;
type PatchToolDraftOut = OutputOf<"/tool/draft", "patch">;
type ToolData = OutputOf<"/tool/get", "post">;

type ToolResourceType = "args" | "arg_positions" | "args_outputs";

type ToolFormState = {
  name_id: string | null;
  name: string | null;
  description_id: string | null;
  description: string | null;
  flag_ids: string[];
  args_ids: string[];
  arg_position_ids: string[];
  args_outputs_ids: string[];
  permission_ids: string[];
  pending_ids: string[];
};

const VALID_TOOL_RESOURCE_TYPES: ToolResourceType[] = [
  "args",
  "arg_positions",
  "args_outputs",
];

export interface ToolProps {
  toolId?: string;
  toolData?: ToolData;
  createToolAction?: (input: CreateToolIn) => Promise<CreateToolOut>;
  updateToolAction?: (input: UpdateToolIn) => Promise<UpdateToolOut>;
  patchToolDraftAction?: (input: PatchToolDraftIn) => Promise<PatchToolDraftOut>;
}

function ToolComponent({
  toolId,
  toolData,
  createToolAction,
  updateToolAction,
  patchToolDraftAction,
}: ToolProps) {
  const router = useRouter();
  const isEditMode = !!toolId;
  const { selectedDraftId, setSelectedDraftId, isAutosaveEnabled } = useDrafts();
  const { flushAllResources } =
    useFlushRegistry<Record<string, unknown>>([]);
  const { isGenerating, generate } = useArtifactAi({
    artifactType: "tool",
    validResourceTypes: VALID_TOOL_RESOURCE_TYPES,
  });

  const toolDataRef = useRef(toolData);
  useEffect(() => {
    toolDataRef.current = toolData;
  }, [toolData]);

  const toolSearchParamsClient = useMemo(
    () => ({
      draftId: parseAsString,
      argsSearch: parseAsString,
      argPositionsSearch: parseAsString,
      argsOutputsSearch: parseAsString,
      permissionsSearch: parseAsString,
      argsShowSelected: parseAsBoolean,
      argPositionsShowSelected: parseAsBoolean,
      argsOutputsShowSelected: parseAsBoolean,
      permissionsShowSelected: parseAsBoolean,
    }),
    []
  );

  const s = toolData;
  const selectedName = s?.names?.find((item) => item.selected) ?? null;
  const selectedDescription = s?.descriptions?.find((item) => item.selected) ?? null;

  const getInitialFormState = useCallback((): ToolFormState => {
    return {
      name_id: selectedName?.id ?? null,
      name: null,
      description_id: selectedDescription?.id ?? null,
      description: null,
      flag_ids: (s?.flags?.filter((item) => item.selected) ?? [])
        .map((item) => item.id)
        .filter((id): id is string => !!id),
      args_ids: (s?.args?.filter((item) => item.selected) ?? [])
        .map((item) => item.id)
        .filter((id): id is string => !!id),
      arg_position_ids: (s?.arg_positions?.filter((item) => item.selected) ?? [])
        .map((item) => item.id)
        .filter((id): id is string => !!id),
      args_outputs_ids: (s?.args_outputs?.filter((item) => item.selected) ?? [])
        .map((item) => item.id)
        .filter((id): id is string => !!id),
      permission_ids: (s?.permissions?.filter((item) => item.selected) ?? [])
        .map((item) => item.id)
        .filter((id): id is string => !!id),
      pending_ids: (s?.pending_ids ?? []) as string[],
    };
  }, [s, selectedDescription, selectedName]);

  const [formState, setFormState] = useState<ToolFormState>(getInitialFormState);
  const formStateRef = useRef(formState);
  useEffect(() => {
    formStateRef.current = formState;
  }, [formState]);

  useEffect(() => {
    setFormState(getInitialFormState());
  }, [getInitialFormState]);

  const argsItems = useMemo(
    () =>
      (s?.args ?? [])
        .filter((item) => item.id && item.name)
        .map((item) => ({
          id: item.id!,
          name: item.name!,
          description: item.description ?? "",
          field_type: item.field_type ?? "",
          required: item.required ?? false,
          generated: item.generated ?? false,
          suggested: item.suggested ?? false,
          pending: item.pending ?? false,
        })),
    [s?.args]
  );

  const argPositionItems = useMemo(
    () =>
      (s?.arg_positions ?? [])
        .filter((item) => item.id && item.args_id && item.value !== null && item.value !== undefined)
        .map((item) => ({
          id: item.id!,
          args_id: item.args_id!,
          value: item.value!,
          generated: item.generated ?? false,
          suggested: item.suggested ?? false,
          pending: item.pending ?? false,
        }))
        .sort((a, b) => a.value - b.value),
    [s?.arg_positions]
  );

  const argPositionByArgId = useMemo(() => {
    const mapping = new Map<
      string,
      { id: string; value: number; suggested: boolean; pending: boolean }
    >();
    argPositionItems.forEach((item) => {
      mapping.set(item.args_id, {
        id: item.id,
        value: item.value,
        suggested: item.suggested,
        pending: item.pending,
      });
    });
    return mapping;
  }, [argPositionItems]);

  const argsOutputsItems = useMemo(
    () =>
      (s?.args_outputs ?? [])
        .filter((item) => item.id && item.args_id && item.name)
        .map((item) => ({
          id: item.id!,
          args_id: item.args_id!,
          name: item.name!,
          template: item.template ?? "",
          generated: item.generated ?? false,
          suggested: item.suggested ?? false,
          pending: item.pending ?? false,
        })),
    [s?.args_outputs]
  );

  const permissionsItems = useMemo(
    () =>
      (s?.permissions ?? [])
        .filter((item) => item.id && item.name)
        .map((item) => ({
          id: item.id!,
          name: item.name!,
          description: item.description ?? "",
          artifact: item.artifact ?? "",
          operation: item.operation ?? "",
          generated: item.generated ?? false,
          suggested: item.suggested ?? false,
          pending: item.pending ?? false,
        })),
    [s?.permissions]
  );

  const argsNameById = useMemo(() => {
    const mapping = new Map<string, string>();
    argsItems.forEach((item) => {
      mapping.set(item.id, item.name);
    });
    return mapping;
  }, [argsItems]);

  const argsOutputsById = useMemo(() => {
    const mapping = new Map<string, { id: string; args_id: string }>();
    argsOutputsItems.forEach((item) => {
      mapping.set(item.id, item);
    });
    return mapping;
  }, [argsOutputsItems]);

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
      if (JSON.stringify(nextArgsOutputs) === JSON.stringify(prev.args_outputs_ids)) {
        return prev;
      }
      return { ...prev, args_outputs_ids: nextArgsOutputs };
    });
  }, [argsOutputsById]);

  useEffect(() => {
    setFormState((prev) => {
      const selectedArgs = new Set(prev.args_ids);
      const nextArgPositionIds = prev.args_ids
        .map((argId) => argPositionByArgId.get(argId))
        .filter((item): item is NonNullable<typeof item> => !!item)
        .sort((a, b) => a.value - b.value)
        .map((item) => item.id)
        .filter((positionId) => {
          const relatedArg = [...argPositionByArgId.entries()].find(
            ([, value]) => value.id === positionId
          )?.[0];
          return relatedArg ? selectedArgs.has(relatedArg) : false;
        });
      if (JSON.stringify(nextArgPositionIds) === JSON.stringify(prev.arg_position_ids)) {
        return prev;
      }
      return { ...prev, arg_position_ids: nextArgPositionIds };
    });
  }, [argPositionByArgId]);

  const [draftId, setDraftId] = useState<string | null>(null);
  const setUrlFormDataRef = useRef<null | ((updates: Record<string, unknown>) => void)>(null);
  const formDataRef = useRef<Record<string, unknown>>({});

  const onFormDataChange = useCallback((fd: Record<string, unknown>) => {
    formDataRef.current = fd;
    const nextDraftId = (fd["draftId"] as string | undefined) ?? null;
    setDraftId((prev) => (prev === nextDraftId ? prev : nextDraftId));
  }, []);

  useEffect(() => {
    if (draftId !== selectedDraftId) {
      setSelectedDraftId(draftId);
    }
  }, [draftId, selectedDraftId, setSelectedDraftId]);

  const patchToolDraftActionRef = useRef(patchToolDraftAction);
  useEffect(() => {
    patchToolDraftActionRef.current = patchToolDraftAction;
  }, [patchToolDraftAction]);

  const serverSyncPendingRef = useRef(false);
  const draftPatchKey = useMemo(() => {
    if (serverSyncPendingRef.current) return undefined;
    return JSON.stringify({
      draftId: draftId || null,
      name: formState.name || null,
      description: formState.description || null,
      name_id: formState.name_id,
      description_id: formState.description_id,
      flag_ids: formState.flag_ids,
      args_ids: formState.args_ids,
      arg_position_ids: formState.arg_position_ids,
      args_outputs_ids: formState.args_outputs_ids,
      permission_ids: formState.permission_ids,
      pending_ids: formState.pending_ids,
    });
  }, [draftId, formState]);

  const lastPatchedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!draftPatchKey || !patchToolDraftActionRef.current) {
      return;
    }

    const hasContent =
      !!formState.name_id ||
      !!formState.name ||
      !!formState.description_id ||
      !!formState.description ||
      formState.flag_ids.length > 0 ||
      formState.args_ids.length > 0 ||
      formState.arg_position_ids.length > 0 ||
      formState.args_outputs_ids.length > 0 ||
      formState.permission_ids.length > 0 ||
      formState.pending_ids.length > 0;

    if (!hasContent || lastPatchedKeyRef.current === draftPatchKey) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const current = formStateRef.current;
        const payload: Record<string, unknown> = {
          draft_id: draftId || null,
          input_draft_id: draftId || null,
          flag_ids: current.flag_ids.length > 0 ? current.flag_ids : null,
          arg_ids: current.args_ids,
          arg_position_ids: current.arg_position_ids,
          args_output_ids: current.args_outputs_ids,
          args_outputs_ids: current.args_outputs_ids,
          permission_ids: current.permission_ids,
          pending_ids: current.pending_ids,
        };

        if (current.name && !current.name_id) {
          payload["name"] = current.name;
        } else {
          payload["name_id"] = current.name_id;
        }

        if (current.description && !current.description_id) {
          payload["description"] = current.description;
        } else {
          payload["description_id"] = current.description_id;
        }

        const result = await patchToolDraftActionRef.current?.({
          body: payload,
        } as PatchToolDraftIn);

        if (!result) {
          return;
        }

        lastPatchedKeyRef.current = draftPatchKey;

        if (result.draft_id && result.draft_id !== draftId) {
          setUrlFormDataRef.current?.({ draftId: result.draft_id });
        }

        const fs = (result as PatchToolDraftOut).form_state;
        if (fs) {
          serverSyncPendingRef.current = true;
          setFormState((prev) => ({
            ...prev,
            // Fall back to prev for ids/arrays so a server that omits a field
            // doesn't wipe user's existing selection.
            name_id: fs.name_id ?? prev.name_id,
            // Clear value fields only once the server has resolved them to
            // IDs — keeping the value would cause infinite re-saves (value
            // takes precedence → new resource → new id → repeat).
            name: fs.name_id ? null : prev.name,
            description_id: fs.description_id ?? prev.description_id,
            description: fs.description_id ? null : prev.description,
            flag_ids: fs.flag_ids ?? prev.flag_ids,
            args_ids: fs.arg_ids ?? prev.args_ids,
            arg_position_ids: fs.arg_position_ids ?? prev.arg_position_ids,
            args_outputs_ids: fs.args_outputs_ids ?? fs.args_output_ids ?? prev.args_outputs_ids,
            permission_ids: fs.permission_ids ?? prev.permission_ids,
            pending_ids: fs.pending_ids ?? prev.pending_ids,
          }));
          requestAnimationFrame(() => {
            serverSyncPendingRef.current = false;
          });
        }
      } catch {
        // API error handling is already centralized server-side.
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [draftPatchKey, draftId, formState]);

  // Per-type boolean view of flag_ids, built from the catalog. Rendered by Flags.
  const flagValues = useMemo<Record<string, boolean | null>>(() => {
    const map: Record<string, boolean | null> = {};
    const byId = new Map(
      (s?.flags ?? [])
        .filter((f) => f.id)
        .map((f) => [f.id as string, f])
    );
    for (const id of formState.flag_ids) {
      const row = byId.get(id);
      if (!row) continue;
      const type = row.type ?? row.name;
      if (type && row.value != null) map[type] = row.value;
    }
    return map;
  }, [formState.flag_ids, s?.flags]);

  type ToolFlagRow = NonNullable<NonNullable<typeof s>["flags"]>[number];
  const flagRowsByType = useMemo(() => {
    const map = new Map<string, ToolFlagRow[]>();
    for (const f of s?.flags ?? []) {
      const t = f.type ?? f.name;
      if (!t) continue;
      const list = map.get(t) ?? [];
      list.push(f);
      map.set(t, list);
    }
    return map;
  }, [s?.flags]);

  const handleFlagToggle = useCallback(
    (type: string, next: boolean | null) => {
      setFormState((prev) => {
        const rows = flagRowsByType.get(type) ?? [];
        const rowIdsForType = new Set(
          rows.map((r) => r.id).filter((id): id is string => !!id)
        );
        const retained = prev.flag_ids.filter((id) => !rowIdsForType.has(id));
        const target =
          next == null ? null : rows.find((r) => r.value === next)?.id ?? null;
        const nextIds = target ? [...retained, target] : retained;
        return { ...prev, flag_ids: nextIds };
      });
    },
    [flagRowsByType]
  );

  // --- Stable value-change handlers (extracted from inline arrows) ---
  const handleNameIdChange = useCallback((id: string | null) => {
    setFormState((prev) => ({
      ...prev,
      name_id: id,
      name: id ? null : prev.name,
    }));
  }, []);

  const handleNameChange = useCallback((name: string) => {
    setFormState((prev) => ({
      ...prev,
      name,
      name_id: null,
    }));
  }, []);

  const handleDescriptionIdChange = useCallback((id: string | null) => {
    setFormState((prev) => ({
      ...prev,
      description_id: id,
      description: id ? null : prev.description,
    }));
  }, []);

  const handleDescriptionChange = useCallback((description: string) => {
    setFormState((prev) => ({
      ...prev,
      description,
      description_id: null,
    }));
  }, []);

  const handleGenerateResources = useCallback(
    async (resourceTypes: ToolResourceType[]) => {
      const currentDraftId =
        (formDataRef.current["draftId"] as string | undefined) ?? draftId ?? null;
      generate(resourceTypes, {
        draft_id: currentDraftId,
        artifact_id: toolId ?? null,
      });
    },
    [draftId, generate, toolId]
  );

  const disabled = useMemo(() => !toolData?.can_edit, [toolData?.can_edit]);

  const handleSubmit = useCallback(
    async (_formData: Record<string, unknown>) => {
      if (!isAutosaveEnabled) {
        await flushAllResources();
      }

      if (!formState.name_id && !formState.name?.trim()) {
        toast.error("Tool name is required");
        throw new Error("Tool name is required");
      }

      try {
        if (isEditMode && toolId && updateToolAction) {
          await updateToolAction({
            body: {
              tools: [
                {
                  id: toolId,
                  ...(formState.name_id
                    ? { name_id: formState.name_id }
                    : { name: formState.name }),
                  ...(formState.description_id
                    ? { description_id: formState.description_id }
                    : { description: formState.description || null }),
                  flag_ids: formState.flag_ids.length ? formState.flag_ids : null,
                  args_ids: formState.args_ids.length ? formState.args_ids : null,
                  arg_positions_ids: formState.arg_position_ids.length
                    ? formState.arg_position_ids
                    : null,
                  args_outputs_ids: formState.args_outputs_ids.length
                    ? formState.args_outputs_ids
                    : null,
                  permission_ids: formState.permission_ids.length
                    ? formState.permission_ids
                    : null,
                },
              ],
              group_id: toolData?.group_id ?? null,
            },
          } as UpdateToolIn);
        } else if (createToolAction) {
          await createToolAction({
            body: {
              tools: [
                {
                  ...(formState.name_id
                    ? { name_id: formState.name_id }
                    : { name: formState.name }),
                  ...(formState.description_id
                    ? { description_id: formState.description_id }
                    : { description: formState.description || null }),
                  flag_ids: formState.flag_ids.length ? formState.flag_ids : null,
                  args_ids: formState.args_ids.length ? formState.args_ids : null,
                  arg_positions_ids: formState.arg_position_ids.length
                    ? formState.arg_position_ids
                    : null,
                  args_outputs_ids: formState.args_outputs_ids.length
                    ? formState.args_outputs_ids
                    : null,
                  permission_ids: formState.permission_ids.length
                    ? formState.permission_ids
                    : null,
                },
              ],
              group_id: toolData?.group_id ?? null,
            },
          } as CreateToolIn);
        } else {
          throw new Error("Save action not available");
        }

        toast.success(`Tool ${isEditMode ? "updated" : "created"} successfully`);
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
      createToolAction,
      flushAllResources,
      formState,
      isAutosaveEnabled,
      isEditMode,
      router,
      toolData?.group_id,
      toolId,
      updateToolAction,
    ]
  );

  const getStepStatus = useCallback(
    (stepId: string): StepStatus => {
      const hasName = !!formState.name_id || !!formState.name?.trim();
      const hasDescription =
        !!formState.description_id || !!formState.description?.trim();

      switch (stepId) {
        case "basic":
          return hasName && hasDescription ? "completed" : "active";
        case "args":
          if (!hasName) return "pending";
          return formState.args_ids.length > 0 ? "completed" : "active";
        case "arg_positions":
          if (!hasName) return "pending";
          return formState.arg_position_ids.length > 0 ? "completed" : "active";
        case "args_outputs":
          if (!hasName) return "pending";
          return formState.args_outputs_ids.length > 0 ? "completed" : "active";
        case "permissions":
          if (!hasName) return "pending";
          return formState.permission_ids.length > 0 ? "completed" : "active";
        default:
          return "pending";
      }
    },
    [formState]
  );

  const stepResources: Record<string, ToolResourceType[]> = useMemo(
    () => ({
      args: ["args"],
      arg_positions: ["arg_positions"],
      args_outputs: ["args_outputs"],
      all: ["args", "arg_positions", "args_outputs"],
    }),
    []
  );

  const handleDirectStepGenerate = useCallback(
    (stepId: string) => {
      const resources = stepResources[stepId];
      if (resources) {
        void handleGenerateResources(resources);
      }
    },
    [handleGenerateResources, stepResources]
  );

  const steps = useMemo(
    () => [
      {
        id: "basic",
        title: "Basic Information",
        description: "Set the tool name, description, and status.",
        resetFields: ["name", "description", "flag_ids"],
      },
      {
        id: "args",
        title: "Args",
        description: "Select and edit args for this tool.",
        filters: [{ key: "argsShowSelected", label: "Show selected" }],
        resetFields: ["args_ids"],
      },
      {
        id: "arg_positions",
        title: "Arg Positions",
        description: "Arrange argument ordering for this tool.",
        filters: [{ key: "argPositionsShowSelected", label: "Show selected" }],
        resetFields: ["arg_position_ids"],
      },
      {
        id: "args_outputs",
        title: "Args Outputs",
        description: "Select and edit output templates for this tool.",
        filters: [{ key: "argsOutputsShowSelected", label: "Show selected" }],
        resetFields: ["args_outputs_ids"],
      },
      {
        id: "permissions",
        title: "Permissions",
        description: "Select the permissions this tool can use.",
        filters: [{ key: "permissionsShowSelected", label: "Show selected" }],
        resetFields: ["permission_ids"],
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
      "permissionsSearch",
      "argsShowSelected",
      "argPositionsShowSelected",
      "argsOutputsShowSelected",
      "permissionsShowSelected",
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
      case "permissions":
        return "Permissions reset";
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
            name: null,
            name_id: null,
            description: null,
            description_id: null,
            flag_ids: [],
          };
        case "args":
          return { ...prev, args_ids: [] };
        case "arg_positions":
          return { ...prev, arg_position_ids: [] };
        case "args_outputs":
          return { ...prev, args_outputs_ids: [] };
        case "permissions":
          return { ...prev, permission_ids: [] };
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

  const canRegenerate = useCallback(
    (resourceType: ToolResourceType) => {
      switch (resourceType) {
        case "args":
          return (s?.args ?? []).some((item) => item.selected && item.generated);
        case "arg_positions":
          return (s?.arg_positions ?? []).some((item) => item.selected && item.generated);
        case "args_outputs":
          return (s?.args_outputs ?? []).some((item) => item.selected && item.generated);
        default:
          return false;
      }
    },
    [s?.arg_positions, s?.args, s?.args_outputs]
  );

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
              customHeader={
                <Names
                  name_id={formState.name_id}
                  name_resource={selectedName}
                  show_name
                  names={s?.names ?? []}
                  disabled={disabled}
                  onNameIdChange={handleNameIdChange}
                  onNameChange={handleNameChange}
                  placeholder="e.g., Calculator"
                  defaultName="New Tool"
                  hideDescription={true}
                  required={true}
                />
              }
              resetFields={["name", "description", "flag_ids"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <div className="space-y-4">
                <Descriptions
                  description_id={formState.description_id}
                  description_resource={selectedDescription}
                  show_description
                  descriptions={s?.descriptions ?? []}
                  disabled={disabled}
                  onDescriptionIdChange={handleDescriptionIdChange}
                  onDescriptionChange={handleDescriptionChange}
                />
                <Flags
                  values={flagValues}
                  flags={s?.flags ?? []}
                  show_flags
                  columns={1}
                  disabled={disabled}
                  onChange={handleFlagToggle}
                  label="Flags"
                />
              </div>
            </StepCard>
          );

        case "args": {
          const argsSearch = ((formData["argsSearch"] as string | undefined) ?? "").trim().toLowerCase();
          const argsShowSelected = Boolean(formData["argsShowSelected"]);
          let filteredArgs = argsItems;
          if (argsShowSelected) {
            filteredArgs = filteredArgs.filter((item) => formState.args_ids.includes(item.id));
          }
          if (argsSearch) {
            filteredArgs = filteredArgs.filter((item) =>
              `${item.name} ${item.description}`.toLowerCase().includes(argsSearch)
            );
          }

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
              searchTerm={(formData["argsSearch"] as string | undefined) ?? ""}
              onSearchChange={(term) => setFormData({ argsSearch: term || null })}
              searchPlaceholder="Search args..."
              {...(filters ? { filters } : {})}
              actions={
                toolData?.args_show_ai_generate ? (
                  <StepCardAiButton
                    stepId="args"
                    resourceTypes={stepResources["args"] ?? []}
                    canRegenerate={(rt) => canRegenerate(rt as ToolResourceType)}
                    isGenerating={(rt) => isGenerating(rt as ToolResourceType)}
                    onOpenModal={(step) => handleDirectStepGenerate(step)}
                    disabled={disabled}
                  />
                ) : undefined
              }
            >
              <div className="space-y-6">
                <SelectableGrid
                  items={filteredArgs}
                  selectedId={null}
                  selectedIds={formState.args_ids}
                  onSelect={(argsId) =>
                    setFormState((prev) => {
                      const isSelected = prev.args_ids.includes(argsId);
                      return {
                        ...prev,
                        args_ids: isSelected
                          ? prev.args_ids.filter((id) => id !== argsId)
                          : [...prev.args_ids, argsId],
                      };
                    })
                  }
                  getId={(item) => item.id}
                  renderItem={(item, isSelected) => (
                    <div
                      className={cn(
                        "relative flex flex-col gap-2 rounded-xl border bg-card p-4 text-left text-card-foreground shadow-sm transition-all",
                        "hover:bg-accent/50 hover:shadow-md",
                        isSelected && "ring-2 ring-primary bg-accent",
                        item.suggested && !isSelected && "ring-2 ring-primary/40",
                        item.pending && "ring-2 ring-success bg-success/10"
                      )}
                    >
                      {isSelected && (
                        <div className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                          <Check className="h-3.5 w-3.5 text-primary-foreground" />
                        </div>
                      )}
                      <div className="space-y-1">
                        <div className="text-sm font-semibold leading-tight">{item.name}</div>
                        {item.description ? (
                          <div className="line-clamp-2 text-xs text-muted-foreground">
                            {item.description}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {item.field_type ? (
                          <span className="rounded-md border px-2 py-0.5">{item.field_type}</span>
                        ) : null}
                        {item.required ? (
                          <span className="rounded-md border px-2 py-0.5">Required</span>
                        ) : null}
                        {item.pending ? (
                          <span className="rounded-md border px-2 py-0.5">Pending</span>
                        ) : null}
                      </div>
                    </div>
                  )}
                  emptyMessage={argsSearch ? "No args match your search." : "No args available yet."}
                  disabled={disabled}
                />

                <Args
                  args_ids={formState.args_ids}
                  input_args_fields={argsItems
                    .filter((item) => formState.args_ids.includes(item.id))
                    .map((item) => ({
                      args_id: item.id,
                      name: item.name,
                      description: item.description,
                      field_type: item.field_type,
                      required: item.required,
                      default_value: "",
                      generated: item.generated,
                    }))}
                  disabled={disabled}
                />
              </div>
            </StepCard>
          );
        }

        case "arg_positions": {
          const argPositionsSearch = ((formData["argPositionsSearch"] as string | undefined) ?? "").trim().toLowerCase();
          const argPositionsShowSelected = Boolean(formData["argPositionsShowSelected"]);
          let filteredArgs = argsItems.filter((item) => formState.args_ids.includes(item.id));
          if (argPositionsShowSelected) {
            filteredArgs = filteredArgs.filter((item) => {
              const position = argPositionByArgId.get(item.id);
              return position ? formState.arg_position_ids.includes(position.id) : false;
            });
          }
          if (argPositionsSearch) {
            filteredArgs = filteredArgs.filter((item) =>
              `${item.name} ${item.description}`.toLowerCase().includes(argPositionsSearch)
            );
          }

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
              searchTerm={(formData["argPositionsSearch"] as string | undefined) ?? ""}
              onSearchChange={(term) => setFormData({ argPositionsSearch: term || null })}
              searchPlaceholder="Search arg positions..."
              {...(filters ? { filters } : {})}
              actions={
                toolData?.args_show_ai_generate ? (
                  <StepCardAiButton
                    stepId="arg_positions"
                    resourceTypes={stepResources["arg_positions"] ?? []}
                    canRegenerate={(rt) => canRegenerate(rt as ToolResourceType)}
                    isGenerating={(rt) => isGenerating(rt as ToolResourceType)}
                    onOpenModal={(step) => handleDirectStepGenerate(step)}
                    disabled={disabled}
                  />
                ) : undefined
              }
            >
              <div className="space-y-6">
                <SelectableGrid
                  items={filteredArgs}
                  selectedId={null}
                  selectedIds={formState.args_ids}
                  onSelect={() => {}}
                  getId={(item) => item.id}
                  renderItem={(item) => {
                    const position = argPositionByArgId.get(item.id);
                    return (
                      <div
                        className={cn(
                          "relative flex flex-col gap-2 rounded-xl border bg-card p-4 text-left text-card-foreground shadow-sm transition-all",
                          position?.suggested && "ring-2 ring-primary/40",
                          position?.pending && "ring-2 ring-success bg-success/10"
                        )}
                      >
                        <div className="space-y-1">
                          <div className="text-sm font-semibold leading-tight">{item.name}</div>
                          <div className="text-xs text-muted-foreground">
                            Position: {(position?.value ?? 0) + 1}
                          </div>
                        </div>
                      </div>
                    );
                  }}
                  emptyMessage={
                    argPositionsSearch
                      ? "No args match your search."
                      : "No selected args available for positions."
                  }
                  disabled
                />

                <ArgPositions
                  args_ids={formState.args_ids}
                  args_resources={argsItems.map((item) => ({
                    id: item.id,
                    name: item.name,
                  }))}
                  arg_position_ids={formState.arg_position_ids}
                  arg_position_resources={argPositionItems.map((item) => ({
                    id: item.id,
                    args_id: item.args_id,
                    value: item.value,
                    generated: item.generated,
                  }))}
                  disabled={disabled}
                  tool_id={toolId ?? null}
                  onPositionIdsChange={(ids) =>
                    setFormState((prev) => ({ ...prev, arg_position_ids: ids }))
                  }
                />
              </div>
            </StepCard>
          );
        }

        case "args_outputs": {
          const argsOutputsSearch = ((formData["argsOutputsSearch"] as string | undefined) ?? "").trim().toLowerCase();
          const argsOutputsShowSelected = Boolean(formData["argsOutputsShowSelected"]);
          const selectedArgs = new Set(formState.args_ids);
          let filteredOutputs = argsOutputsItems;
          if (selectedArgs.size > 0) {
            filteredOutputs = filteredOutputs.filter((item) => selectedArgs.has(item.args_id));
          }
          if (argsOutputsShowSelected) {
            filteredOutputs = filteredOutputs.filter((item) =>
              formState.args_outputs_ids.includes(item.id)
            );
          }
          if (argsOutputsSearch) {
            filteredOutputs = filteredOutputs.filter((item) =>
              `${item.name} ${item.template} ${argsNameById.get(item.args_id) ?? ""}`
                .toLowerCase()
                .includes(argsOutputsSearch)
            );
          }

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
              searchTerm={(formData["argsOutputsSearch"] as string | undefined) ?? ""}
              onSearchChange={(term) => setFormData({ argsOutputsSearch: term || null })}
              searchPlaceholder="Search args outputs..."
              {...(filters ? { filters } : {})}
              actions={
                toolData?.args_show_ai_generate ? (
                  <StepCardAiButton
                    stepId="args_outputs"
                    resourceTypes={stepResources["args_outputs"] ?? []}
                    canRegenerate={(rt) => canRegenerate(rt as ToolResourceType)}
                    isGenerating={(rt) => isGenerating(rt as ToolResourceType)}
                    onOpenModal={(step) => handleDirectStepGenerate(step)}
                    disabled={disabled}
                  />
                ) : undefined
              }
            >
              <div className="space-y-6">
                <SelectableGrid
                  items={filteredOutputs}
                  selectedId={null}
                  selectedIds={formState.args_outputs_ids}
                  onSelect={(outputId) =>
                    setFormState((prev) => {
                      const isSelected = prev.args_outputs_ids.includes(outputId);
                      if (isSelected) {
                        return {
                          ...prev,
                          args_outputs_ids: prev.args_outputs_ids.filter((id) => id !== outputId),
                        };
                      }
                      const output = argsOutputsById.get(outputId);
                      const nextArgsIds =
                        output && !prev.args_ids.includes(output.args_id)
                          ? [...prev.args_ids, output.args_id]
                          : prev.args_ids;
                      return {
                        ...prev,
                        args_ids: nextArgsIds,
                        args_outputs_ids: [...prev.args_outputs_ids, outputId],
                      };
                    })
                  }
                  getId={(item) => item.id}
                  renderItem={(item, isSelected) => (
                    <div
                      className={cn(
                        "relative flex flex-col gap-2 rounded-xl border bg-card p-4 text-left text-card-foreground shadow-sm transition-all",
                        "hover:bg-accent/50 hover:shadow-md",
                        isSelected && "ring-2 ring-primary bg-accent",
                        item.suggested && !isSelected && "ring-2 ring-primary/40",
                        item.pending && "ring-2 ring-success bg-success/10"
                      )}
                    >
                      {isSelected && (
                        <div className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                          <Check className="h-3.5 w-3.5 text-primary-foreground" />
                        </div>
                      )}
                      <div className="space-y-1">
                        <div className="text-sm font-semibold leading-tight">{item.name}</div>
                        <div className="text-xs text-muted-foreground">
                          Arg: {argsNameById.get(item.args_id) ?? "Arg"}
                        </div>
                      </div>
                      {item.template ? (
                        <div className="line-clamp-2 text-xs font-mono text-muted-foreground">
                          {item.template}
                        </div>
                      ) : null}
                    </div>
                  )}
                  emptyMessage={
                    argsOutputsSearch
                      ? "No args outputs match your search."
                      : "No args outputs available yet."
                  }
                  disabled={disabled}
                />

                <ArgsOutputs
                  args_outputs_ids={formState.args_outputs_ids}
                  output_args_outputs={argsOutputsItems
                    .filter((item) => formState.args_outputs_ids.includes(item.id))
                    .map((item) => ({
                      args_outputs_id: item.id,
                      args_id: item.args_id,
                      name: item.name,
                      template: item.template,
                      generated: item.generated,
                    }))}
                  input_args_fields={argsItems
                    .filter((item) => formState.args_ids.includes(item.id))
                    .map((item) => ({
                      args_id: item.id,
                      name: item.name,
                      description: item.description,
                      field_type: item.field_type,
                      required: item.required,
                      default_value: "",
                      generated: item.generated,
                    }))}
                  disabled={disabled}
                />
              </div>
            </StepCard>
          );
        }

        case "permissions": {
          const permissionsSearch = ((formData["permissionsSearch"] as string | undefined) ?? "").trim().toLowerCase();
          const permissionsShowSelected = Boolean(formData["permissionsShowSelected"]);
          let filteredPermissions = permissionsItems;
          if (permissionsShowSelected) {
            filteredPermissions = filteredPermissions.filter((item) =>
              formState.permission_ids.includes(item.id)
            );
          }
          if (permissionsSearch) {
            filteredPermissions = filteredPermissions.filter((item) =>
              `${item.name} ${item.description} ${item.artifact} ${item.operation}`
                .toLowerCase()
                .includes(permissionsSearch)
            );
          }

          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              resetFields={["permission_ids"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              searchTerm={(formData["permissionsSearch"] as string | undefined) ?? ""}
              onSearchChange={(term) => setFormData({ permissionsSearch: term || null })}
              searchPlaceholder="Search permissions..."
              {...(filters ? { filters } : {})}
            >
              <SelectableGrid
                items={filteredPermissions}
                selectedId={null}
                selectedIds={formState.permission_ids}
                onSelect={(permissionId) =>
                  setFormState((prev) => {
                    const isSelected = prev.permission_ids.includes(permissionId);
                    return {
                      ...prev,
                      permission_ids: isSelected
                        ? prev.permission_ids.filter((id) => id !== permissionId)
                        : [...prev.permission_ids, permissionId],
                    };
                  })
                }
                getId={(item) => item.id}
                renderItem={(item, isSelected) => (
                  <div
                    className={cn(
                      "relative flex flex-col gap-2 rounded-xl border bg-card p-4 text-left text-card-foreground shadow-sm transition-all",
                      "hover:bg-accent/50 hover:shadow-md",
                      isSelected && "ring-2 ring-primary bg-accent",
                      item.suggested && !isSelected && "ring-2 ring-primary/40",
                      item.pending && "ring-2 ring-success bg-success/10"
                    )}
                  >
                    {isSelected && (
                      <div className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                        <Check className="h-3.5 w-3.5 text-primary-foreground" />
                      </div>
                    )}
                    <div className="space-y-1">
                      <div className="text-sm font-semibold leading-tight">{item.name}</div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        {item.artifact} / {item.operation}
                      </div>
                      {item.description ? (
                        <div className="line-clamp-2 text-xs text-muted-foreground">
                          {item.description}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {item.generated ? (
                        <span className="rounded-md border px-2 py-0.5">Generated</span>
                      ) : null}
                      {item.pending ? (
                        <span className="rounded-md border px-2 py-0.5">Pending</span>
                      ) : null}
                    </div>
                  </div>
                )}
                emptyMessage={
                  permissionsSearch
                    ? "No permissions match your search."
                    : "No permissions available yet."
                }
                disabled={disabled}
              />
            </StepCard>
          );
        }

        default:
          return null;
      }
    },
    [
      argPositionByArgId,
      argPositionItems,
      argsItems,
      argsNameById,
      argsOutputsById,
      argsOutputsItems,
      canRegenerate,
      disabled,
      formState,
      handleDirectStepGenerate,
      isAutosaveEnabled,
      isEditMode,
      isGenerating,
      permissionsItems,
      s?.args,
      s?.args_outputs,
      s?.descriptions,
      s?.flags,
      s?.names,
      selectedDescription,
      selectedName,
      stepResources,
      toolData?.args_show_ai_generate,
      toolId,
    ]
  );

  return (
    <TooltipProvider>
      <div className="w-full space-y-8 p-6" data-page={`tool-${isEditMode ? "edit" : "new"}`}>
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

export default ToolComponent;
