/**
 * Agent.tsx
 * Used to create and edit system agents
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */
"use client";

import { useRouter } from "next/navigation";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import {
  GenericForm,
  type StepStatus,
} from "@/components/common/forms/GenericForm";
import { StepCardAiButton } from "@/components/common/forms/StepCardAiButton";
import { StepCard } from "@/components/common/forms/StepCard";
import { ReadOnlyBanner } from "@/components/common/forms/ReadOnlyBanner";
import {
  Departments,
  type DepartmentResourceItem,
} from "@/components/resources/Departments";
import {
  Descriptions,
  type DescriptionResourceItem,
} from "@/components/resources/Descriptions";
import { Flags } from "@/components/resources/Flags";
import {
  Instructions,
  type InstructionResourceItem,
} from "@/components/resources/Instructions";
import { Models, type ModelResourceItem } from "@/components/resources/Models";
import { Names } from "@/components/resources/Names";
import { Prompts, type PromptResourceItem } from "@/components/resources/Prompts";
import {
  ReasoningLevels,
  type ReasoningLevelResourceItem,
} from "@/components/resources/ReasoningLevels";
import { TemperatureLevels } from "@/components/resources/TemperatureLevels";
import { Tools, type ToolResourceItem } from "@/components/resources/Tools";
import { Voices, type VoiceResourceItem } from "@/components/resources/Voices";
import {
  Qualities,
  type QualitiesResourceItem,
} from "@/components/resources/Qualities";
import {
  Rubrics,
  type RubricsResourceItem,
} from "@/components/resources/Rubrics";
import { useProfile } from "@/contexts/profile-context";
import { useDrafts } from "@/contexts/draft-context";
import { useAgentAi } from "@/hooks/use-agent-ai";
import { useDraftLifecycle } from "@/hooks/use-draft-lifecycle";
import {
  checkHasResourceIds,
  type ResourceConfig,
} from "@/lib/resources/action-builders";
import type { ResourceType } from "@/lib/resources/types";
import {
  getDefaultDepartmentIds,
  transformDepartmentIdsForSubmit,
} from "@/utils/department-picker-helpers";
import {
  parseAsBoolean,
  parseAsString,
  useQueryStates,
  type Parser,
  type Values,
} from "nuqs";

// Type-only import from server page
import type {
  GetAgentOut,
  PatchAgentDraftIn,
  PatchAgentDraftOut,
  CreateAgentIn,
  CreateAgentOut,
  UpdateAgentIn,
  UpdateAgentOut,
} from "@/app/(main)/intelligence/agents/[agentId]/page";
import type { OutputOf } from "@/lib/api/types";



const AGENT_RESOURCES: ResourceConfig[] = [
  { key: "names", formKey: "name_id", flushKey: null, type: "single" },
  {
    key: "descriptions",
    formKey: "description_id",
    flushKey: null,
    type: "single",
  },
  { key: "models", formKey: "model_id", flushKey: null, type: "single" },
  {
    key: "prompts",
    formKey: "prompt_id",
    flushKey: "prompt_id",
    type: "single",
  },
  {
    key: "instructions",
    formKey: "instructions_id",
    flushKey: null,
    type: "single",
  },
  { key: "flags", formKey: "flag_ids", flushKey: null, type: "multi" },
  {
    key: "departments",
    formKey: "department_ids",
    flushKey: null,
    type: "multi",
  },
  { key: "tools", formKey: "tool_ids", flushKey: null, type: "multi" },
  {
    key: "temperature_levels",
    formKey: "temperature_level_id",
    flushKey: null,
    type: "single",
  },
  {
    key: "reasoning_levels",
    formKey: "reasoning_level_id",
    flushKey: null,
    type: "single",
  },
  { key: "voices", formKey: "voice_ids", flushKey: null, type: "multi" },
  { key: "qualities", formKey: "quality_ids", flushKey: null, type: "multi" },
  { key: "rubrics", formKey: "rubric_ids", flushKey: null, type: "multi" },
];

type CanonicalAgentData = OutputOf<"/agent/get", "post">;

const toSingleSection = <
  T extends { id?: string | null; selected?: boolean | null; suggested?: boolean | null },
>(
  items: T[] | null | undefined,
  opts: { show?: boolean; required?: boolean; showAiGenerate?: boolean } = {},
) => {
  const list = items ?? [];
  return {
    resource: list.find((item) => item.selected) ?? null,
    resources: list,
    suggestions: list
      .filter((item) => item.suggested)
      .map((item) => item.id)
      .filter(Boolean),
    show: opts.show ?? true,
    required: opts.required ?? false,
    show_ai_generate: opts.showAiGenerate ?? false,
  };
};

const toMultiSection = <
  T extends { id?: string | null; selected?: boolean | null; suggested?: boolean | null },
>(
  items: T[] | null | undefined,
  opts: { show?: boolean; required?: boolean; showAiGenerate?: boolean } = {},
) => {
  const list = items ?? [];
  return {
    current: list.filter((item) => item.selected),
    resources: list,
    suggestions: list
      .filter((item) => item.suggested)
      .map((item) => item.id)
      .filter(Boolean),
    show: opts.show ?? true,
    required: opts.required ?? false,
    show_ai_generate: opts.showAiGenerate ?? false,
  };
};

const DescriptionsField = Descriptions;
const DepartmentsField = Departments;
const ToolsField = Tools;
const ModelsField = Models;
// JUDGMENT-GATED: TemperatureLevels was refactored to a slider/multi-id API
// (`temperature_level_ids` + `onChange`), but Agent.tsx still drives it with the
// legacy single-id contract (`temperature_level_id`/`onTemperatureLevelIdChange`)
// plus product-gated `temperature_lower`/`temperature_upper` reads that don't
// exist on the model schema. Wiring the genuine type here needs cross-file API
// reconciliation (a product decision), so the wrapper cast is preserved.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TemperatureLevelsField = TemperatureLevels as any;
const ReasoningLevelsField = ReasoningLevels;
const VoicesField = Voices;
const QualitiesField = Qualities;
const RubricsField = Rubrics;
const PromptsField = Prompts;
const InstructionsField = Instructions;

export interface AgentProps {
  agentId?: string;
  // Optional server-provided data and actions (for server-side rendering)
  agentDetail?: GetAgentOut; // For edit mode (agent_id provided)
  agentDetailDefault?: GetAgentOut; // For new mode (agent_id = null)
  createAgentAction?: (input: CreateAgentIn) => Promise<CreateAgentOut>;
  updateAgentAction?: (input: UpdateAgentIn) => Promise<UpdateAgentOut>;
  patchAgentDraftAction?: (
    input: PatchAgentDraftIn,
  ) => Promise<PatchAgentDraftOut>;
}

export default function Agent({
  agentId,
  agentDetail: serverAgentDetail,
  agentDetailDefault: serverAgentDetailDefault,
  createAgentAction,
  updateAgentAction,
  patchAgentDraftAction,
}: AgentProps) {
  const router = useRouter();
  const isEditMode = !!agentId;
  const { profile } = useProfile();
  const { isAutosaveEnabled, selectedDraftId, setSelectedDraftId } = useDrafts();
  const isSuperadmin = true;
  const flushRegistryRef = useRef<
    Map<string, () => Promise<Record<string, unknown> | void>>
  >(new Map());
  // Stabilize server props to prevent unnecessary re-renders from object reference changes
  const stabilizeServerProp = React.useCallback(
    (
      data: typeof serverAgentDetail | typeof serverAgentDetailDefault,
    ): string | null => {
      if (!data) return null;
      if (typeof data === "object" && data !== null) {
        if ("agent_id" in data && data.agent_id) {
          return `agent_id:${String(data.agent_id)}`;
        }
        const keyFields: Record<string, unknown> = {};
        if ("valid_model_ids" in data) {
          keyFields["valid_model_ids"] = Array.isArray(data["valid_model_ids"])
            ? data["valid_model_ids"].length
            : data["valid_model_ids"];
        }
        if ("valid_department_ids" in data) {
          keyFields["valid_department_ids"] = Array.isArray(
            data["valid_department_ids"],
          )
            ? data["valid_department_ids"].sort().join(",")
            : data["valid_department_ids"];
        }
        const sortedKeys = Object.keys(keyFields).sort();
        const hash = sortedKeys
          .map((k) => `${k}:${JSON.stringify(keyFields[k])}`)
          .join("|");
        return `new:${hash.length}:${hash.slice(0, 100)}`;
      }
      return String(data);
    },
    [],
  );

  const agentDetailId = React.useMemo(
    () => stabilizeServerProp(serverAgentDetail),
    [serverAgentDetail, stabilizeServerProp],
  );
  const agentDetailDefaultId = React.useMemo(
    () => stabilizeServerProp(serverAgentDetailDefault),
    [serverAgentDetailDefault, stabilizeServerProp],
  );

  // Use refs to track latest server props (for effect access) and stable props (for render)
  const latestServerAgentDetailRef = React.useRef(serverAgentDetail);
  const latestServerAgentDetailDefaultRef = React.useRef(
    serverAgentDetailDefault,
  );

  // Update latest refs on every render (no effect needed - just sync)
  latestServerAgentDetailRef.current = serverAgentDetail;
  latestServerAgentDetailDefaultRef.current = serverAgentDetailDefault;

  // Use refs to track stable server props - only update when ID changes
  const stableAgentDetailRef = React.useRef<{
    data: typeof serverAgentDetail;
    id: string | null;
  }>({
    data: serverAgentDetail,
    id: agentDetailId,
  });
  const stableAgentDetailDefaultRef = React.useRef<{
    data: typeof serverAgentDetailDefault;
    id: string | null;
  }>({
    data: serverAgentDetailDefault,
    id: agentDetailDefaultId,
  });

  React.useEffect(() => {
    // Only update when ID actually changes, use latest ref for data
    if (stableAgentDetailRef.current.id !== agentDetailId) {
      stableAgentDetailRef.current = {
        data: latestServerAgentDetailRef.current,
        id: agentDetailId,
      };
    }
  }, [agentDetailId]); // Only depend on ID, not object reference

  React.useEffect(() => {
    // Only update when ID actually changes, use latest ref for data
    if (stableAgentDetailDefaultRef.current.id !== agentDetailDefaultId) {
      stableAgentDetailDefaultRef.current = {
        data: latestServerAgentDetailDefaultRef.current,
        id: agentDetailDefaultId,
      };
    }
  }, [agentDetailDefaultId]); // Only depend on ID, not object reference

  // Use stable references
  const agentDetail = stableAgentDetailRef.current.data;
  const agentDetailDefault = stableAgentDetailDefaultRef.current.data;

  const agentData = (
    isEditMode ? agentDetail : agentDetailDefault
  ) as CanonicalAgentData | undefined;
  const sectionData = useMemo(() => {
    if (!agentData) return undefined;
    const flags = agentData.flags ?? [];
    const selectedFlags = flags.filter((flag) => flag.selected);
    return {
      ...agentData,
      names: toSingleSection(agentData.names, {
        show: true,
        required: true,
        showAiGenerate: !!agentData.basic_show_ai_generate,
      }),
      descriptions: toSingleSection(agentData.descriptions, {
        show: true,
        required: false,
        showAiGenerate: !!agentData.basic_show_ai_generate,
      }),
      models: toSingleSection(agentData.models, {
        show: true,
        required: true,
        showAiGenerate: !!agentData.basic_show_ai_generate,
      }),
      prompts: toSingleSection(agentData.prompts, {
        show: true,
        required: false,
        showAiGenerate: !!agentData.general_show_ai_generate,
      }),
      instructions: toSingleSection(agentData.instructions, {
        show: true,
        required: false,
        showAiGenerate: !!agentData.general_show_ai_generate,
      }),
      flags: {
        current: selectedFlags,
        resources: flags,
        show: true,
        required: false,
        show_ai_generate: !!agentData.basic_show_ai_generate,
      },
      departments: {
        ...toMultiSection(
          (agentData.departments ?? []).map((item) => ({
            ...item,
            id: item.department_id ?? null,
          })),
          {
            show: true,
            required: false,
            showAiGenerate: !!agentData.general_show_ai_generate,
          },
        ),
      },
      tools: toMultiSection(agentData.tools, {
        show: true,
        required: false,
        showAiGenerate: !!agentData.general_show_ai_generate,
      }),
      temperature_levels: toSingleSection(agentData.temperature_levels, {
        show: true,
        required: false,
        showAiGenerate: !!agentData.general_show_ai_generate,
      }),
      reasoning_levels: toSingleSection(agentData.reasoning_levels, {
        show: true,
        required: false,
        showAiGenerate: !!agentData.general_show_ai_generate,
      }),
      voices: toMultiSection(agentData.voices, {
        show: true,
        required: false,
        showAiGenerate: !!agentData.general_show_ai_generate,
      }),
      qualities: toMultiSection(agentData.qualities, {
        show: true,
        required: false,
        showAiGenerate: !!agentData.general_show_ai_generate,
      }),
      rubrics: toMultiSection(agentData.rubrics, {
        show: true,
        required: false,
        showAiGenerate: !!agentData.general_show_ai_generate,
      }),
    };
  }, [agentData]);
  const namesSection = sectionData?.names;
  const descriptionsSection = sectionData?.descriptions;
  const modelsSection = sectionData?.models;
  const promptsSection = sectionData?.prompts;
  const instructionsSection = sectionData?.instructions;
  const flagsSection = sectionData?.flags;
  const departmentsSection = sectionData?.departments;
  const toolsSection = sectionData?.tools;
  const temperatureLevelsSection = sectionData?.temperature_levels;
  const reasoningLevelsSection = sectionData?.reasoning_levels;
  const voicesSection = sectionData?.voices;
  const qualitiesSection = sectionData?.qualities;
  const rubricsSection = sectionData?.rubrics;

  // Inline parsers for URL-backed state (search/filter params only - form fields in draftState)
  const agentSearchParamsClient = {
    // Draft ID (URL-backed, updated when draft is created)
    draftId: parseAsString,
    // Search params for filtering (URL-backed for browser back/forward)
    modelSearch: parseAsString,
    toolSearch: parseAsString,
    toolShowSelected: parseAsBoolean,
    modelShowSelected: parseAsBoolean,
    reasoningSearch: parseAsString,
    voiceSearch: parseAsString,
    descriptionSearch: parseAsString,
    promptSearch: parseAsString,
    instructionsSearch: parseAsString,
  } as const;

  // URL-backed state using nuqs (only navigation/search params)
  const [urlParams] = useQueryStates(agentSearchParamsClient, {
    history: "replace",
    shallow: true, // Use shallow routing to prevent server component re-renders
  });

  // Get draftId from URL (managed by nuqs via urlParams)
  const urlDraftId = urlParams.draftId || null;

  // Sync URL draftId to profile context
  useEffect(() => {
    if (urlDraftId !== selectedDraftId) {
      setSelectedDraftId(urlDraftId);
    }
  }, [urlDraftId, selectedDraftId, setSelectedDraftId]);

  // Local draft state (not in URL) - initialized from server data or draft payload
  // Store resource IDs only, not text or resource objects (canonical pattern - matches Persona.tsx)
  type DraftState = {
    name_id: string | null;
    name: string | null;
    description_id: string | null;
    description: string | null;
    prompt_id: string | null;
    // Inline-authored system prompt (creatable): value takes precedence over
    // prompt_id until the server resolves it to an id, mirroring name/description.
    prompt: { system_prompt: string; name: string; description: string } | null;
    modelId: string;
    flag_ids: string[];
    tool_ids: string[];
    departmentIds: string[];
    temperature_level_id: string | null;
    reasoning_level_id: string | null;
    voice_ids: string[];
    quality_ids: string[];
    rubric_ids: string[];
    instructions_id: string | null;
    pending_ids: string[];
  };

  const primaryDepartmentId =
    (
      profile as { primary_department_id?: string | null } | null | undefined
    )?.primary_department_id ?? null;

  const defaultDepartmentIds = useMemo(
    () =>
      getDefaultDepartmentIds(
        isSuperadmin,
        primaryDepartmentId,
      ),
    [isSuperadmin, primaryDepartmentId],
  );

  // Initialize draft state from server data or draft payload
  // Extract resource IDs from server data (canonical pattern - matches Persona.tsx)
  const initialDraftState = useMemo((): DraftState => {
    const data = sectionData;
    if (!data) {
      return {
        name_id: null,
        name: null,
        description_id: null,
        description: null,
        prompt_id: null,
        prompt: null,
        modelId: "",
        flag_ids: [],
        tool_ids: [],
        departmentIds: defaultDepartmentIds,
        temperature_level_id: null,
        reasoning_level_id: null,
        voice_ids: [],
        quality_ids: [],
        rubric_ids: [],
        instructions_id: null,
        pending_ids: [],
      };
    }

    const currentFlagIds: string[] = (data.flags?.current ?? [])
      .map((f) => f.id)
      .filter((id): id is string => !!id);
    const currentDepartments =
      data.departments?.current
        ?.map((d) => d.department_id)
        .filter((id): id is string => !!id) ?? [];
    const currentTools =
      data.tools?.current
        ?.map((t) => t.id)
        .filter((id): id is string => !!id) ?? [];
    const currentVoices =
      data.voices?.current
        ?.map((v) => v.id)
        .filter((id): id is string => !!id) ?? [];
    const currentQualities =
      data.qualities?.current
        ?.map((q) => q.id)
        .filter((id): id is string => !!id) ?? [];
    const currentRubrics =
      data.rubrics?.current
        ?.map((r) => r.id)
        .filter((id): id is string => !!id) ?? [];

    return {
      name_id: data.names?.resource?.id ?? null,
      name: null,
      description_id: data.descriptions?.resource?.id ?? null,
      description: null,
      prompt_id: data.prompts?.resource?.id ?? null,
      prompt: null,
      modelId: data.models?.resource?.id ?? "",
      flag_ids: currentFlagIds,
      tool_ids: currentTools,
      departmentIds: currentDepartments,
      temperature_level_id: data.temperature_levels?.resource?.id ?? null,
      reasoning_level_id: data.reasoning_levels?.resource?.id ?? null,
      voice_ids: currentVoices,
      quality_ids: currentQualities,
      rubric_ids: currentRubrics,
      instructions_id: data.instructions?.resource?.id ?? null,
      pending_ids: data.pending_ids ?? [],
    };
  }, [
    sectionData,
    defaultDepartmentIds,
  ]);

  const [draftState, setDraftState] = useState<DraftState>(initialDraftState);
  // Track previous initialDraftState content to avoid unnecessary updates
  const prevInitialDraftStateRef = useRef<string>(
    JSON.stringify(initialDraftState),
  );

  // Update draft state when server data changes (e.g., draft selected)
  useEffect(() => {
    // Deep compare to avoid unnecessary state updates
    const currentStateStr = prevInitialDraftStateRef.current;
    const newStateStr = JSON.stringify(initialDraftState);

    // Only update if content actually changed
    if (currentStateStr !== newStateStr) {
      prevInitialDraftStateRef.current = newStateStr;
      setDraftState(initialDraftState);
    }
  }, [initialDraftState]);

  const formStateRef = useRef(draftState as Record<string, unknown>);
  useEffect(() => {
    formStateRef.current = draftState as Record<string, unknown>;
  }, [draftState]);

  const hasResourceIds =
    checkHasResourceIds(
      AGENT_RESOURCES,
      draftState as unknown as Record<string, unknown>,
    ) ||
    !!draftState.name ||
    !!draftState.description ||
    draftState.pending_ids.length > 0;

  const flushAllResources = useCallback(async (): Promise<Record<string, unknown>> => {
    const results: Record<string, unknown> = {};
    for (const flush of flushRegistryRef.current.values()) {
      const result = await flush();
      if (result && typeof result === "object") {
        Object.assign(results, result);
      }
    }
    return results;
  }, []);

  const patchActionRef = useRef<
    | ((
        payload: Record<string, unknown>,
      ) => Promise<{ draft_id?: string | null }>)
    | undefined
  >(undefined);

  useEffect(() => {
    if (!patchAgentDraftAction) {
      patchActionRef.current = undefined;
      return;
    }
    patchActionRef.current = async (payload: Record<string, unknown>) => {
      const result = await patchAgentDraftAction({ body: payload } as PatchAgentDraftIn);
      const fs = result?.form_state;
      if (fs) {
        setDraftState((prev) => {
          const next = {
            ...prev,
            name_id: fs.name_id ?? prev.name_id,
            // Clear value fields only once the server has resolved them to
            // IDs — keeping the value would cause infinite re-saves (value
            // takes precedence → new resource → new id → repeat).
            name: fs.name_id ? null : prev.name,
            description_id: fs.description_id ?? prev.description_id,
            description: fs.description_id ? null : prev.description,
            flag_ids: fs.flag_ids ?? prev.flag_ids,
            departmentIds: fs.department_ids ?? prev.departmentIds,
            modelId: fs.model_id ?? prev.modelId,
            tool_ids: fs.tool_ids ?? prev.tool_ids,
            reasoning_level_id:
              fs.reasoning_level_id ?? prev.reasoning_level_id,
            temperature_level_id:
              fs.temperature_level_id ?? prev.temperature_level_id,
            voice_ids: fs.voice_ids ?? prev.voice_ids,
            quality_ids: fs.quality_ids ?? prev.quality_ids,
            rubric_ids: fs.rubric_ids ?? prev.rubric_ids,
            prompt_id: fs.prompt_id ?? prev.prompt_id,
            // Clear the authored prompt value once the server resolved it to an
            // id (same anti-re-save reasoning as name/description above).
            prompt: fs.prompt_id ? null : prev.prompt,
            instructions_id:
              fs.instruction_id ?? prev.instructions_id,
            pending_ids: fs.pending_ids ?? prev.pending_ids,
          };
          // Only set the server-sync absorb flag when state actually changes.
          // (Same fix as Persona / Parameter / Profile.)
          const changed =
            prev.name_id !== next.name_id ||
            prev.name !== next.name ||
            prev.description_id !== next.description_id ||
            prev.description !== next.description ||
            JSON.stringify(prev.flag_ids) !== JSON.stringify(next.flag_ids) ||
            prev.modelId !== next.modelId ||
            prev.reasoning_level_id !== next.reasoning_level_id ||
            prev.temperature_level_id !== next.temperature_level_id ||
            prev.prompt_id !== next.prompt_id ||
            JSON.stringify(prev.prompt) !== JSON.stringify(next.prompt) ||
            prev.instructions_id !== next.instructions_id ||
            JSON.stringify(prev.departmentIds) !== JSON.stringify(next.departmentIds) ||
            JSON.stringify(prev.tool_ids) !== JSON.stringify(next.tool_ids) ||
            JSON.stringify(prev.voice_ids) !== JSON.stringify(next.voice_ids) ||
            JSON.stringify(prev.quality_ids) !== JSON.stringify(next.quality_ids) ||
            JSON.stringify(prev.rubric_ids) !== JSON.stringify(next.rubric_ids) ||
            JSON.stringify(prev.pending_ids) !== JSON.stringify(next.pending_ids);
          if (!changed) return prev;
          serverSyncPendingRef.current = true;
          return next;
        });
      }
      return result;
    };
  }, [patchAgentDraftAction]);

  const buildPatchPayload = useCallback((): Record<string, unknown> => {
    const current = formStateRef.current as unknown as DraftState;
    const payload: Record<string, unknown> = {};

    // Creatables: value takes precedence over ID
    if (current.name != null) payload["name"] = current.name;
    else if (current.name_id) payload["name_id"] = current.name_id;

    if (current.description != null) payload["description"] = current.description;
    else if (current.description_id) payload["description_id"] = current.description_id;

    // Single-select IDs: emit only if truthy
    if (current.modelId) payload["model_id"] = current.modelId;
    // Prompt is a creatable: send the authored value so the server resolves it
    // to a prompt_id (CreatePromptInput), falling back to an already-resolved
    // id. Value takes precedence — same pattern as name/description above.
    // Without this the Monaco-typed prompt never reaches /agent/draft, prompt_id
    // never resolves, and the submit guard ("Prompt selection is required")
    // blocks every create.
    if (current.prompt?.system_prompt) {
      payload["prompt"] = {
        system_prompt: current.prompt.system_prompt,
        name: current.prompt.name ?? "",
        description: current.prompt.description ?? "",
      };
    } else if (current.prompt_id) {
      payload["prompt_id"] = current.prompt_id;
    }
    if (current.instructions_id) payload["instructions_id"] = current.instructions_id;
    if (current.temperature_level_id)
      payload["temperature_level_id"] = current.temperature_level_id;
    if (current.reasoning_level_id)
      payload["reasoning_level_id"] = current.reasoning_level_id;

    // Multi-select ID arrays: emit only if non-empty
    if (current.flag_ids.length > 0) payload["flag_ids"] = current.flag_ids;
    if (current.departmentIds.length > 0)
      payload["department_ids"] = current.departmentIds;
    if (current.tool_ids.length > 0) payload["tool_ids"] = current.tool_ids;
    if (current.voice_ids.length > 0) payload["voice_ids"] = current.voice_ids;
    if (current.quality_ids.length > 0) payload["quality_ids"] = current.quality_ids;
    if (current.rubric_ids.length > 0) payload["rubric_ids"] = current.rubric_ids;

    // Pending state
    if (current.pending_ids.length > 0) payload["pending_ids"] = current.pending_ids;

    return payload;
  }, []);

  // --- Stable value-change handlers (extracted from inline arrows) ---
  const handleNameIdChange = useCallback((nameId: string | null) => {
    setDraftState((prev) => ({ ...prev, name_id: nameId, name: null }));
  }, []);

  const handleNameChange = useCallback((name: string | null) => {
    setDraftState((prev) => ({ ...prev, name, name_id: null }));
  }, []);

  const handleDescriptionIdChange = useCallback((descriptionId: string | null) => {
    setDraftState((prev) => ({
      ...prev,
      description_id: descriptionId,
      description: null,
    }));
  }, []);

  const handleDescriptionChange = useCallback((description: string | null) => {
    setDraftState((prev) => ({
      ...prev,
      description,
      description_id: null,
    }));
  }, []);

  // ─── Per-field pending lifecycle ──────────────────────────────────
  // See Persona.tsx for the canonical pattern and rationale.
  type SingleField = "name_id" | "description_id" | "instructions_id";
  type MultiField = "departmentIds" | "flag_ids" | "voice_ids";

  const handleAcceptPendingField = useCallback(
    (field: SingleField, pendingId: string) => {
      setDraftState((prev) => ({
        ...prev,
        [field]: pendingId,
        ...(field === "name_id" ? { name: null } : {}),
        ...(field === "description_id" ? { description: null } : {}),
        pending_ids: prev.pending_ids.filter((id) => id !== pendingId),
      }));
    },
    [],
  );

  const handleRejectPendingField = useCallback(
    (field: SingleField, pendingId: string) => {
      setDraftState((prev) => ({
        ...prev,
        [field]: prev[field] === pendingId ? null : prev[field],
        pending_ids: prev.pending_ids.filter((id) => id !== pendingId),
      }));
    },
    [],
  );

  const handleAcceptPendingMulti = useCallback(
    (_field: MultiField, pendingIds: string[]) => {
      const removeSet = new Set(pendingIds);
      setDraftState((prev) => ({
        ...prev,
        pending_ids: prev.pending_ids.filter((id) => !removeSet.has(id)),
      }));
    },
    [],
  );

  const handleRejectPendingMulti = useCallback(
    (field: MultiField, pendingIds: string[]) => {
      const removeSet = new Set(pendingIds);
      setDraftState((prev) => ({
        ...prev,
        [field]: (prev[field] as string[]).filter((id) => !removeSet.has(id)),
        pending_ids: prev.pending_ids.filter((id) => !removeSet.has(id)),
      }));
    },
    [],
  );

  const {
    setUrlFormDataRef,
    onFormDataChange,
    flushAllAndSave,
    serverSyncPendingRef,
    formDataRef,
  } = useDraftLifecycle({
    formStateKey: JSON.stringify(draftState),
    patchActionRef,
    isAutosaveEnabled,
    buildPatchPayload,
    setSelectedDraftId,
    hasResourceIds,
    flushRegistryRef,
    formStateRef,
  });

  // No handleSaveAgent needed — Create/Update actions used directly in handleSubmit

  // Get selected model capabilities
  const selectedModelCapabilities = useMemo(() => {
    if (!draftState.modelId) {
      return null;
    }

    const selectedModel = modelsSection?.resources?.find(
      (m) => m.id === draftState.modelId,
    );
    if (!selectedModel) {
      return null;
    }

    // JUDGMENT-GATED: the generated model resource only carries `modality_ids`
    // (string ids), not `input_modalities`/`output_modalities` string arrays.
    // These reads have always resolved to `[]` at runtime (the fields don't
    // exist on the payload), so every `has_*` flag below is currently `false`.
    // Resolving capabilities from `modality_ids` (or extending the API) is a
    // product/runtime decision, so the original `as`-cast behavior is preserved
    // verbatim here. Casting through `unknown` to a precise local shape keeps
    // this lint-clean without `any` while leaving the behavior unchanged.
    const modalityCarrier = selectedModel as unknown as {
      input_modalities?: string[] | null;
      output_modalities?: string[] | null;
    };
    const inputMods = modalityCarrier.input_modalities ?? [];
    const outputMods = modalityCarrier.output_modalities ?? [];

    return {
      input_modalities: inputMods,
      output_modalities: outputMods,
      has_text_output: outputMods.includes("text"),
      has_audio_input: inputMods.includes("audio"),
      has_audio_output: outputMods.includes("audio"),
      has_image_output: outputMods.includes("image"),
      has_video_output: outputMods.includes("video"),
    };
  }, [draftState.modelId, modelsSection?.resources]);

  // handleInputChange removed - use setDraftState directly

  const resetFormAndState = useCallback(() => {
    setDraftState(initialDraftState);
  }, [initialDraftState]);

  // Initialize form from server data (for GenericForm)
  const initializeForm = useCallback(
    (
      _serverData: unknown,
      _isEditMode: boolean,
    ): Partial<Values<Record<string, Parser<unknown>>>> => {
      // GenericForm expects URL params, but we use draftState for form fields
      // So we return empty object - form fields are initialized via draftState
      return {};
    },
    [],
  );

  // Steps configuration for GenericForm (moved before handleReset to fix declaration order)
  const steps = useMemo(() => {
    const baseSteps = [
      {
        id: "basic",
        title: "Basic Information",
        description:
          "Set the agent name, description, departments, and active status.",
        resetFields: [
          "name",
          "description",
          "active",
          "departmentIds",
        ] as string[],
      },
      {
        id: "tools",
        title: "Tools",
        description:
          "Select the tools this agent can use. Tools define what operations the agent can perform.",
        resetFields: ["tool_ids"] as string[],
      },
      {
        id: "model",
        title: "Model",
        description: "Select the AI model for this agent.",
        resetFields: ["modelId"] as string[],
      },
    ];

    // Conditionally add configuration steps based on model capabilities
    const configSteps = [];

    if (selectedModelCapabilities) {
      configSteps.push({
        id: "temperature",
        title: "Temperature",
        description: "Configure the temperature setting for the model.",
        optional: true,
        resetFields: ["temperature_level_id"] as string[],
      });

      if (selectedModelCapabilities.has_text_output) {
        configSteps.push({
          id: "reasoning",
          title: "Reasoning Effort",
          description: "Configure the reasoning effort level.",
          optional: true,
          resetFields: ["reasoning_level_id"] as string[],
        });
      }

      // Only show voice configuration for models with BOTH input and output audio (e.g., gpt-realtime)
      if (
        selectedModelCapabilities.has_audio_input &&
        selectedModelCapabilities.has_audio_output
      ) {
        configSteps.push({
          id: "voice",
          title: "Voices",
          description: "Select voices for audio output.",
          optional: true,
          resetFields: ["voice_ids"] as string[],
        });
      }
    }

    const qualitiesStep = qualitiesSection?.show
      ? {
          id: "qualities",
          title: "Qualities",
          description: "Select the qualities for this agent.",
          optional: true,
          resetFields: ["quality_ids"] as string[],
        }
      : null;

    const rubricsStep = rubricsSection?.show
      ? {
          id: "rubrics",
          title: "Rubrics",
          description: "Select the rubrics for this agent.",
          optional: true,
          resetFields: ["rubric_ids"] as string[],
        }
      : null;

    const instructionsStep = {
      id: "instructions",
      title: "Instructions",
      description: "Define instructions for the agent's behavior.",
      optional: true,
      resetFields: ["instructions_id"] as string[],
    };

    const promptStep = {
      id: "prompt",
      title: "Prompt Instructions",
      description: "Define the system prompt that controls agent behavior.",
      resetFields: ["prompt_id"] as string[],
    };

    return [
      ...baseSteps,
      ...configSteps,
      ...(qualitiesStep ? [qualitiesStep] : []),
      ...(rubricsStep ? [rubricsStep] : []),
      instructionsStep,
      promptStep,
    ];
  }, [selectedModelCapabilities, qualitiesSection?.show, rubricsSection?.show]);

  // Reset handler for GenericForm - resets draftState fields
  // Simplified with constant map (canonical pattern)
  const resetters: Record<
    string,
    (s: DraftState, init: DraftState) => Partial<DraftState>
  > = useMemo(
    () => ({
      name: (_s, init) => ({ name_id: init.name_id }),
      description: (_s, init) => ({ description_id: init.description_id }),
      active: (_s, init) => ({ flag_ids: init.flag_ids }),
      departmentIds: (_s, init) => ({ departmentIds: init.departmentIds }),
      tool_ids: (_s, init) => ({ tool_ids: init.tool_ids }),
      modelId: (_s, init) => ({ modelId: init.modelId }),
      temperature_level_id: (_s, init) => ({
        temperature_level_id: init.temperature_level_id,
      }),
      reasoning_level_id: (_s, init) => ({
        reasoning_level_id: init.reasoning_level_id,
      }),
      voice_ids: (_s, init) => ({ voice_ids: init.voice_ids }),
      quality_ids: (_s, init) => ({ quality_ids: init.quality_ids }),
      rubric_ids: (_s, init) => ({ rubric_ids: init.rubric_ids }),
      prompt_id: (_s, init) => ({ prompt_id: init.prompt_id, prompt: null }),
      instructions_id: (_s, init) => ({
        instructions_id: init.instructions_id,
      }),
    }),
    [],
  );

  const handleReset = useCallback(
    (stepId: string, _fields: string[]) => {
      const step = steps.find((s) => s.id === stepId);
      if (!step || !step.resetFields) return;

      // Map resetFields to draftState fields and reset them
      const resetUpdates: Partial<DraftState> = {};
      step.resetFields.forEach((field) => {
        const resetter = resetters[field];
        if (resetter) {
          Object.assign(resetUpdates, resetter(draftState, initialDraftState));
        }
      });

      setDraftState((prev) => ({ ...prev, ...resetUpdates }));
    },
    [steps, initialDraftState, draftState, resetters],
  );

  // Handle form submission (for GenericForm)
  const handleSubmit = useCallback(
    async (_formData: Values<Record<string, Parser<unknown>>>) => {
      try {
        const flushResults = await flushAllResources();
        const effectiveFormState = {
          ...draftState,
          ...flushResults,
        } as Record<string, unknown>;

        const nameId = effectiveFormState["name_id"] as string | null;
        const descriptionId = effectiveFormState["description_id"] as
          | string
          | null;
        const promptId = effectiveFormState["prompt_id"] as string | null;
        const modelId =
          (effectiveFormState["model_id"] as string | null) ??
          (effectiveFormState["modelId"] as string | null);
        if (!nameId) throw new Error("Agent name is required");
        if (!descriptionId) throw new Error("Agent description is required");
        if (!promptId) throw new Error("Prompt selection is required");
        if (!modelId || modelId.trim().length === 0) {
          throw new Error("Model selection is required");
        }

        const validDepartmentIds =
          departmentsSection?.resources
            ?.map((d) => d.department_id)
            .filter((id): id is string => !!id) ?? [];
        const finalDepartmentIds = transformDepartmentIdsForSubmit(
          ((effectiveFormState["department_ids"] as string[]) ??
            (effectiveFormState["departmentIds"] as string[])) ??
            [],
          isSuperadmin,
          validDepartmentIds,
        );
        const efs = {
          ...effectiveFormState,
          department_ids: finalDepartmentIds,
        } as Record<string, unknown>;

        if (!profile?.id) {
          toast.error("Profile not loaded. Please refresh the page.");
          throw new Error("Profile not loaded");
        }

        const efsTyped = efs as unknown as DraftState;
        const flagIds = efsTyped.flag_ids ?? [];
        const deptIds = (efs["department_ids"] as string[])?.length
          ? (efs["department_ids"] as string[])
          : undefined;
        const tIds = (efs["tool_ids"] as string[])?.length
          ? (efs["tool_ids"] as string[])
          : undefined;
        const vIds = (efs["voice_ids"] as string[])?.length
          ? (efs["voice_ids"] as string[])
          : undefined;

        if (isEditMode && agentId) {
          if (!updateAgentAction) {
            throw new Error("Update action unavailable");
          }
          await updateAgentAction({
            body: {
              agents: [
                {
                  id: agentId,
                  name_id: efsTyped.name_id ?? undefined,
                  name: efsTyped.name ?? undefined,
                  description_id: efsTyped.description_id ?? undefined,
                  description: efsTyped.description ?? undefined,
                  flag_ids: flagIds.length > 0 ? flagIds : undefined,
                  model_id: modelId ?? undefined,
                  department_ids: deptIds,
                  tool_ids: tIds,
                  voice_ids: vIds,
                  reasoning_level_ids: efsTyped.reasoning_level_id
                    ? [efsTyped.reasoning_level_id]
                    : undefined,
                  temperature_level_ids: efsTyped.temperature_level_id
                    ? [efsTyped.temperature_level_id]
                    : undefined,
                  quality_ids: efsTyped.quality_ids?.length
                    ? efsTyped.quality_ids
                    : undefined,
                  rubric_ids: efsTyped.rubric_ids?.length
                    ? efsTyped.rubric_ids
                    : undefined,
                  prompt_id: efsTyped.prompt_id ?? undefined,
                  instruction_ids: efsTyped.instructions_id
                    ? [efsTyped.instructions_id]
                    : undefined,
                },
              ],
            },
          } as UpdateAgentIn);
        } else {
          if (!createAgentAction) {
            throw new Error("Create action unavailable");
          }
          await createAgentAction({
            body: {
              agents: [
                {
                  name_id: efsTyped.name_id ?? undefined,
                  name: efsTyped.name ?? undefined,
                  description_id: efsTyped.description_id ?? undefined,
                  description: efsTyped.description ?? undefined,
                  flag_ids: flagIds.length > 0 ? flagIds : undefined,
                  model_id: modelId ?? undefined,
                  department_ids: deptIds,
                  tool_ids: tIds,
                  voice_ids: vIds,
                  reasoning_level_ids: efsTyped.reasoning_level_id
                    ? [efsTyped.reasoning_level_id]
                    : undefined,
                  temperature_level_ids: efsTyped.temperature_level_id
                    ? [efsTyped.temperature_level_id]
                    : undefined,
                  quality_ids: efsTyped.quality_ids?.length
                    ? efsTyped.quality_ids
                    : undefined,
                  rubric_ids: efsTyped.rubric_ids?.length
                    ? efsTyped.rubric_ids
                    : undefined,
                  prompt_id: efsTyped.prompt_id ?? undefined,
                  instruction_ids: efsTyped.instructions_id
                    ? [efsTyped.instructions_id]
                    : undefined,
                },
              ],
            },
          } as CreateAgentIn);
        }

        toast.success(
          `Agent ${isEditMode ? "updated" : "created"} successfully!`,
        );
        resetFormAndState();
        router.push("/intelligence/agents");
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        toast.error(
          `Failed to ${isEditMode ? "update" : "create"} agent: ${msg}`,
        );
        throw error;
      }
    },
    [
      draftState,
      isEditMode,
      agentId,
      departmentsSection?.resources,
      isSuperadmin,
      profile,
      createAgentAction,
      updateAgentAction,
      flushAllResources,
      resetFormAndState,
      router,
    ],
  );

  // Extract disabled state from can_edit flag (check in both new and edit modes)
  const disabled = useMemo(
    () => (sectionData?.can_edit == null ? false : !sectionData.can_edit),
    [sectionData?.can_edit],
  );

  const isReadonly = disabled; // Alias for backward compatibility

  // Step status calculation for GenericForm
  // Check resource IDs instead of display values (canonical pattern - matches Persona.tsx)
  const getStepStatus = useCallback(
    (
      stepId: string,
      _formData: Values<Record<string, Parser<unknown>>>,
    ): StepStatus => {
      const hasModel = !!draftState.modelId?.trim();
      const hasName = !!draftState.name_id;
      const hasDescription = !!draftState.description_id;
      const hasTools = draftState.tool_ids && draftState.tool_ids.length > 0;

      switch (stepId) {
        case "basic":
          return hasName && hasDescription ? "completed" : "active";
        case "tools":
          if (!hasName || !hasDescription) return "pending";
          return hasTools ? "completed" : "active";
        case "model":
          return hasModel ? "completed" : "active";
        case "temperature":
          if (!hasModel) return "pending";
          // Optional step: completed only if value is chosen
          return draftState.temperature_level_id ? "completed" : "active";
        case "reasoning":
          if (!hasModel) return "pending";
          // Optional step: completed only if value is chosen
          return draftState.reasoning_level_id ? "completed" : "active";
        case "voice":
          if (!hasModel) return "pending";
          // Optional step: completed only if value is chosen
          return draftState.voice_ids.length > 0 ? "completed" : "active";
        case "qualities":
          return draftState.quality_ids.length > 0 ? "completed" : "active";
        case "rubrics":
          return draftState.rubric_ids.length > 0 ? "completed" : "active";
        case "prompt":
          if (!hasModel) return "pending";
          return draftState.prompt_id ? "completed" : "active";
        case "instructions":
          // Instructions are optional: completed only if value is chosen
          if (!hasModel) return "pending";
          return draftState.instructions_id ? "completed" : "active";
        default:
          return "pending";
      }
    },
    [draftState],
  );

  // Helper to check if a resource type can be regenerated
  const canRegenerate = useCallback(
    (resourceType: ResourceType): boolean => {
      switch (resourceType) {
        case "names":
          return namesSection?.resource?.generated ?? false;
        case "descriptions":
          return descriptionsSection?.resource?.generated ?? false;
        case "models":
          return (
            modelsSection?.resources?.some((m) => m.generated) ?? false
          );
        case "prompts":
          return promptsSection?.resources?.some((p) => p.generated) ?? false;
        case "instructions":
          return instructionsSection?.resource?.generated ?? false;
        case "flags":
          return flagsSection?.current?.some((f) => f.generated) ?? false;
        case "departments":
          return departmentsSection?.current?.some((d) => d.generated) ?? false;
        case "reasoning_levels":
          return reasoningLevelsSection?.resource?.generated ?? false;
        case "temperature_levels":
          return temperatureLevelsSection?.resource?.generated ?? false;
        case "voices":
          return voicesSection?.current?.some((v) => v.generated) ?? false;
        case "tools":
          return toolsSection?.current?.some((t) => t.generated) ?? false;
        case "qualities":
          return qualitiesSection?.current?.some((q) => q.generated) ?? false;
        case "rubrics":
          return rubricsSection?.current?.some((r) => r.generated) ?? false;
        default:
          return false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      namesSection?.resource,
      descriptionsSection?.resource,
      modelsSection?.resources,
      promptsSection?.resources,
      instructionsSection?.resource,
      flagsSection?.current,
      departmentsSection?.current,
      reasoningLevelsSection?.resource,
      temperatureLevelsSection?.resource,
      voicesSection?.current,
      toolsSection?.current,
      qualitiesSection?.current,
      rubricsSection?.current,
    ],
  );
  const canRegenerateForStepCard = useCallback(
    (resourceType: string) => canRegenerate(resourceType as ResourceType),
    [canRegenerate],
  );

  // AI generation hook
  const { isGenerating, generate } = useAgentAi({});
  const isGeneratingForStepCard = useCallback(
    (resourceType: string) => isGenerating(resourceType as ResourceType),
    [isGenerating],
  );

  // Multi-generation handler - accepts list of resource types and optional user instructions
  const handleGenerateResources = useCallback(
    async (
      resourceTypes: ResourceType[],
      userInstructions?: string,
    ) => {
      let currentDraftId =
        (formDataRef.current["draftId"] as string | undefined) ?? null;
      if (!currentDraftId) currentDraftId = await flushAllAndSave();
      if (!currentDraftId) {
        toast.error("Please save a draft before generating with AI");
        return;
      }

      generate(resourceTypes, {
        draft_id: currentDraftId,
        artifact_id: agentId || null,
        user_instructions: userInstructions ? [userInstructions] : null,
      });
    },
    [
      agentId,
      generate,
      formDataRef,
      flushAllAndSave,
    ],
  );

  // Individual generation handlers
  const handleGenerateTemperatureLevels = useCallback(
    async () => handleGenerateResources(["temperature_levels"]),
    [handleGenerateResources],
  );

  // Step-to-resources mapping for multi-generation
  const stepResources: Record<string, ResourceType[]> = useMemo(
    () => ({
      basic: ["names", "descriptions", "departments", "flags"],
      model: ["models"],
      temperature: ["temperature_levels"],
      reasoning: ["reasoning_levels"],
      voice: ["voices"],
      prompt: ["prompts"],
      instructions: ["instructions"],
      tools: ["tools"],
      qualities: ["qualities"],
      rubrics: ["rubrics"],
      all: [
        "names",
        "descriptions",
        "models",
        "prompts",
        "instructions",
        "flags",
        "departments",
        "reasoning_levels",
        "temperature_levels",
        "voices",
        "tools",
        "qualities",
        "rubrics",
      ],
    }),
    [],
  );

  const handleDirectStepGenerate = useCallback(
    (stepId: string, _mode: "generate" | "regenerate") => {
      const resources = stepResources[stepId];
      if (resources) {
        handleGenerateResources(resources);
      }
    },
    [stepResources, handleGenerateResources],
  );

  const mergedNames = namesSection?.resources ?? [];
  const mergedDescriptions: DescriptionResourceItem[] = (
    descriptionsSection?.resources ?? []
  ).map((d) => ({
    id: d.id ?? null,
    description: d.description ?? null,
    generated: d.generated ?? null,
    suggested: d.suggested ?? null,
    pending: d.pending ?? null,
  }));
  const mergedModels: ModelResourceItem[] = (
    modelsSection?.resources ?? []
  ).map((m) => ({
    id: m.id ?? null,
    name: m.name ?? null,
    description: m.description ?? null,
    modality_ids: m.modality_ids ?? null,
    suggested: m.suggested ?? null,
    pending: m.pending ?? null,
  }));
  const mergedPrompts: PromptResourceItem[] = (
    promptsSection?.resources ?? []
  ).map((p) => ({
    id: p.id ?? null,
    name: p.name ?? null,
    description: p.description ?? null,
    system_prompt: p.system_prompt ?? null,
    generated: p.generated ?? null,
    pending: p.pending ?? null,
  }));
  const mergedInstructions: InstructionResourceItem[] = (
    instructionsSection?.resources ?? []
  ).map((i) => ({
    id: i.id ?? null,
    template: i.template ?? null,
    generated: i.generated ?? null,
    suggested: i.suggested ?? null,
    pending: i.pending ?? null,
  }));
  const mergedTemperatureLevels = temperatureLevelsSection?.resources ?? [];
  const mergedReasoningLevels: ReasoningLevelResourceItem[] = (
    reasoningLevelsSection?.resources ?? []
  ).map((r) => ({
    id: r.id ?? null,
    reasoning_level: r.reasoning_level ?? null,
    generated: r.generated ?? null,
    suggested: r.suggested ?? null,
    pending: r.pending ?? null,
  }));
  const mergedTools: ToolResourceItem[] = (toolsSection?.resources ?? []).map(
    (t) => ({
      id: t.id ?? null,
      name: t.name ?? null,
      description: t.description ?? null,
      generated: t.generated ?? null,
      suggested: t.suggested ?? null,
      pending: t.pending ?? null,
    }),
  );
  const mergedVoices: VoiceResourceItem[] = (
    voicesSection?.resources ?? []
  ).map((v) => ({
    id: v.id ?? null,
    voice: v.voice ?? null,
    generated: v.generated ?? null,
    suggested: v.suggested ?? null,
    pending: v.pending ?? null,
  }));
  const mergedDepartments = departmentsSection?.resources ?? [];
  const mergedQualities: QualitiesResourceItem[] = (
    qualitiesSection?.resources ?? []
  ).map((q) => ({
    id: q.id ?? null,
    quality: q.quality ?? null,
    generated: q.generated ?? null,
    suggested: q.suggested ?? null,
    pending: q.pending ?? null,
  }));
  const mergedRubrics: RubricsResourceItem[] = (
    rubricsSection?.resources ?? []
  ).map((r) => ({
    id: r.id ?? null,
    name: r.name ?? null,
    description: r.description ?? null,
    generated: r.generated ?? null,
    suggested: r.suggested ?? null,
    pending: r.pending ?? null,
  }));

  return (
    <div className="space-y-6 py-4 px-4">
        <ReadOnlyBanner
          disabled={disabled}
          disabledReason={sectionData?.disabled_reason ?? null}
          entityType="agent"
        />
        <div className="w-full">
          <GenericForm
            nuqsParsers={
              agentSearchParamsClient as Record<string, Parser<unknown>>
            }
            onFormDataChange={onFormDataChange}
            steps={steps}
            getStepStatus={getStepStatus}
            serverData={sectionData}
            initializeForm={initializeForm}
            formFieldKeys={[]} // Form fields are in draftState, not URL params
            onReset={handleReset}
            resetSuccessMessage={(stepId) => {
              switch (stepId) {
                case "basic":
                  return "Basic information reset";
                case "tools":
                  return "Tools reset";
                case "model":
                  return "Model reset";
                case "temperature":
                  return "Temperature reset";
                case "reasoning":
                  return "Reasoning effort reset";
                case "voice":
                  return "Voices reset";
                case "prompt":
                  return "Prompt reset";
                case "instructions":
                  return "Instructions reset";
                case "qualities":
                  return "Qualities reset";
                case "rubrics":
                  return "Rubrics reset";
                default:
                  return "Reset";
              }
            }}
            onSubmit={handleSubmit}
            submitButton={{
              backUrl: "/intelligence/agents",
              backLabel: "Back",
              createLabel: "Create Agent",
              updateLabel: "Update Agent",
            }}
            isReadonly={isReadonly}
            isEditMode={isEditMode}
            registerSetFormData={(setter) => {
              setUrlFormDataRef.current = setter as (
                updates: Record<string, unknown>,
              ) => void;
            }}
            renderStep={({
              stepId,
              stepStatus,
              stepTitle,
              stepDescription,
              stepNumber,
              formData: stepFormData,
              setFormData: setStepFormData,
              onReset,
            }) => {
              switch (stepId) {
                case "basic": {
                  const descriptionSearch =
                    (stepFormData["descriptionSearch"] as
                      | string
                      | null
                      | undefined) || "";
                  return (
                    <StepCard
                      stepStatus={stepStatus}
                      stepNumber={stepNumber}
                      stepTitle={stepTitle}
                      stepDescription={stepDescription}
                      isReadonly={isReadonly}
                      isEditMode={isEditMode}
                      customHeader={
                        <Names
                          name_id={draftState.name_id}
                          name_resource={namesSection?.resource ?? null}
                          show_name={namesSection?.show ?? true}
                          names={mergedNames}
                          disabled={isReadonly}
                          onNameIdChange={handleNameIdChange}
                          onNameChange={handleNameChange}
                          onAcceptPending={(pendingId) =>
                            handleAcceptPendingField("name_id", pendingId)
                          }
                          onRejectPending={(pendingId) =>
                            handleRejectPendingField("name_id", pendingId)
                          }
                          placeholder="e.g., Customer Support Agent"
                          defaultName="New Agent"
                          required={namesSection?.required ?? false}
                          hideDescription={true}
                        />
                      }
                      resetFields={[
                        "name",
                        "description",
                        "active",
                        "departmentIds",
                      ]}
                      actions={
                        stepResources["basic"] &&
                        stepResources["basic"].length > 0 &&
                        (sectionData?.names?.show_ai_generate ||
                          sectionData?.descriptions?.show_ai_generate ||
                          sectionData?.departments?.show_ai_generate ||
                          sectionData?.flags?.show_ai_generate) ? (
                          <StepCardAiButton
                            stepId="basic"
                            resourceTypes={stepResources["basic"] ?? []}
                            canRegenerate={canRegenerateForStepCard}
                            isGenerating={isGeneratingForStepCard}
                            onOpenModal={handleDirectStepGenerate}
                            disabled={isReadonly}
                          />
                        ) : undefined
                      }
                      {...(onReset ? { onReset } : {})}
                      resetLabel="Reset"
                    >
                      <div className="space-y-4">
                        {/* Description field - using Descriptions resource component */}
                        <DescriptionsField
                          description_id={draftState.description_id}
                          description_resource={
                            descriptionsSection?.resource ?? null
                          }
                          show_description={descriptionsSection?.show ?? true}
                          descriptions={mergedDescriptions}
                          disabled={isReadonly}
                          onDescriptionIdChange={handleDescriptionIdChange}
                          onDescriptionChange={handleDescriptionChange}
                          onAcceptPending={(pendingId: string) =>
                            handleAcceptPendingField("description_id", pendingId)
                          }
                          onRejectPending={(pendingId: string) =>
                            handleRejectPendingField("description_id", pendingId)
                          }
                          searchTerm={descriptionSearch}
                          onSearchChange={(term: string) =>
                            setStepFormData({ descriptionSearch: term || null })
                          }
                          label="Description"
                          placeholder="Detailed behavior description and personality traits"
                          required={descriptionsSection?.required ?? false}
                          rows={4}
                          data-testid="input-agent-description"
                        />

                        {/* Department Selection */}
                        <DepartmentsField
                          department_ids={draftState.departmentIds || []}
                          department_resources={(
                            departmentsSection?.current ?? []
                          ).map(
                            (d): DepartmentResourceItem => ({
                              department_id: d.department_id ?? null,
                              name: d.name ?? null,
                              description: d.description ?? null,
                              generated: d.generated ?? null,
                              suggested: d.suggested ?? null,
                              pending: d.pending ?? null,
                            }),
                          )}
                          show_departments={
                            departmentsSection?.show ?? false
                          }
                          departments={(mergedDepartments ?? []).map(
                            (d): DepartmentResourceItem => ({
                              department_id: d.department_id ?? null,
                              name: d.name ?? null,
                              description: d.description ?? null,
                              generated: d.generated ?? null,
                              suggested: d.suggested ?? null,
                              pending: d.pending ?? null,
                            }),
                          )}
                          disabled={isReadonly}
                          onChange={(ids: string[]) => {
                            setDraftState((prev) => ({
                              ...prev,
                              departmentIds: ids,
                            }));
                          }}
                          onAcceptPending={(pendingIds: string[]) =>
                            handleAcceptPendingMulti("departmentIds", pendingIds)
                          }
                          onRejectPending={(pendingIds: string[]) =>
                            handleRejectPendingMulti("departmentIds", pendingIds)
                          }
                          required={departmentsSection?.required ?? false}
                        />

                        <Flags
                          flags={flagsSection?.resources ?? []}
                          values={(() => {
                            const map: Record<string, boolean | null> = {};
                            const rows = flagsSection?.resources ?? [];
                            const byId = new Map(
                              rows
                                .filter((f) => f.id)
                                .map((f) => [f.id as string, f] as const)
                            );
                            for (const id of draftState.flag_ids) {
                              const row = byId.get(id);
                              if (!row) continue;
                              const type = row.type ?? row.name;
                              if (type && row.value != null) map[type] = row.value;
                            }
                            return map;
                          })()}
                          show_flags={flagsSection?.show ?? false}
                          columns={1}
                          label="Flags"
                          disabled={isReadonly}
                          onChange={(type: string, next: boolean | null) => {
                            setDraftState((prev) => {
                              const rows = (flagsSection?.resources ?? [])
                                .filter((f) => (f.type ?? f.name) === type);
                              const rowIds = new Set(
                                rows.map((r) => r.id).filter((id): id is string => !!id)
                              );
                              const retained = prev.flag_ids.filter((id) => !rowIds.has(id));
                              const target =
                                next == null ? null : rows.find((r) => r.value === next)?.id ?? null;
                              return {
                                ...prev,
                                flag_ids: target ? [...retained, target] : retained,
                              };
                            });
                          }}
                          onAcceptPending={(pendingIds) =>
                            handleAcceptPendingMulti("flag_ids", pendingIds)
                          }
                          onRejectPending={(pendingIds) =>
                            handleRejectPendingMulti("flag_ids", pendingIds)
                          }
                        />
                      </div>
                    </StepCard>
                  );
                }

                case "tools": {
                  const toolSearch =
                    (stepFormData["toolSearch"] as string) || "";
                  const toolShowSelected =
                    (stepFormData["toolShowSelected"] as boolean) ?? false;
                  return (
                    <StepCard
                      stepStatus={stepStatus}
                      stepNumber={stepNumber}
                      stepTitle={stepTitle}
                      stepDescription={stepDescription}
                      isReadonly={isReadonly}
                      isEditMode={isEditMode}
                      searchTerm={toolSearch}
                      onSearchChange={(term) =>
                        setStepFormData({ toolSearch: term || null })
                      }
                      searchPlaceholder="Search tools..."
                      filters={[
                        {
                          key: "showSelected",
                          label: "Show selected",
                          value: toolShowSelected,
                          onChange: (value: boolean) =>
                            setStepFormData({
                              toolShowSelected: value || null,
                            }),
                        },
                      ]}
                      resetFields={["tool_ids"]}
                      {...(onReset ? { onReset } : {})}
                      resetLabel="Reset"
                      actions={
                        stepResources["tools"] &&
                        stepResources["tools"].length > 0 &&
                        sectionData?.tools?.show_ai_generate ? (
                          <StepCardAiButton
                            stepId="tools"
                            resourceTypes={stepResources["tools"] ?? []}
                            canRegenerate={canRegenerateForStepCard}
                            isGenerating={isGeneratingForStepCard}
                            onOpenModal={handleDirectStepGenerate}
                            disabled={isReadonly}
                          />
                        ) : undefined
                      }
                    >
                      <ToolsField
                        tool_ids={draftState.tool_ids}
                        tool_resources={(toolsSection?.current ?? []).map(
                          (t): ToolResourceItem => ({
                            id: t.id ?? null,
                            name: t.name ?? null,
                            description: t.description ?? null,
                            generated: t.generated ?? null,
                            suggested: t.suggested ?? null,
                            pending: t.pending ?? null,
                          }),
                        )}
                        show_tools={toolsSection?.show ?? false}
                        tools={mergedTools}
                        disabled={isReadonly}
                        onChange={(ids: string[]) =>
                          setDraftState((prev) => ({ ...prev, tool_ids: ids }))
                        }
                        label="Tools"
                        description="Select the tools this agent can use. Tools define what operations the agent can perform."
                        required={toolsSection?.required ?? false}
                        searchTerm={toolSearch}
                        onSearchChange={(term: string) =>
                          setStepFormData({ toolSearch: term || null })
                        }
                        showSelectedFilter={toolShowSelected}
                        onShowSelectedChange={(value: boolean) =>
                          setStepFormData({ toolShowSelected: value })
                        }
                      />
                    </StepCard>
                  );
                }

                case "model": {
                  const modelSearch =
                    (stepFormData["modelSearch"] as string) || "";
                  const modelShowSelected =
                    (stepFormData["modelShowSelected"] as boolean) ?? false;
                  return (
                    <StepCard
                      stepStatus={stepStatus}
                      stepNumber={stepNumber}
                      stepTitle={stepTitle}
                      stepDescription={stepDescription}
                      isReadonly={isReadonly}
                      isEditMode={isEditMode}
                      searchTerm={modelSearch}
                      onSearchChange={(term) =>
                        setStepFormData({ modelSearch: term || null })
                      }
                      searchPlaceholder="Search models..."
                      filters={[
                        {
                          key: "showSelected",
                          label: "Show selected",
                          value: modelShowSelected,
                          onChange: (value: boolean) =>
                            setStepFormData({
                              modelShowSelected: value || null,
                            }),
                        },
                      ]}
                      resetFields={["modelId"]}
                      actions={
                        stepResources["model"] &&
                        stepResources["model"].length > 0 &&
                        sectionData?.models?.show_ai_generate ? (
                          <StepCardAiButton
                            stepId="model"
                            resourceTypes={stepResources["model"] ?? []}
                            canRegenerate={canRegenerateForStepCard}
                            isGenerating={isGeneratingForStepCard}
                            onOpenModal={handleDirectStepGenerate}
                            disabled={isReadonly}
                          />
                        ) : undefined
                      }
                      {...(onReset ? { onReset } : {})}
                      resetLabel="Reset"
                    >
                      <ModelsField
                        model_id={draftState.modelId || null}
                        model_resource={
                          modelsSection?.resource
                            ? {
                                id: modelsSection.resource.id ?? null,
                                name: modelsSection.resource.name ?? null,
                                description:
                                  modelsSection.resource.description ?? null,
                                modality_ids:
                                  modelsSection.resource.modality_ids ?? null,
                                suggested:
                                  modelsSection.resource.suggested ?? null,
                                pending: modelsSection.resource.pending ?? null,
                              }
                            : null
                        }
                        show_models={modelsSection?.show ?? true}
                        models={mergedModels}
                        disabled={isReadonly}
                        onModelIdChange={(modelId: string | null) => {
                          setDraftState((prev) => ({
                            ...prev,
                            modelId: modelId || "",
                          }));
                        }}
                        label="Model"
                        required={modelsSection?.required ?? true}
                        id="model"
                        helpText="Select the AI model for this agent."
                        searchTerm={modelSearch}
                        onSearchChange={(term: string) =>
                          setStepFormData({ modelSearch: term || null })
                        }
                        showSelectedFilter={modelShowSelected}
                        onShowSelectedChange={(value: boolean) =>
                          setStepFormData({ modelShowSelected: value })
                        }
                      />
                    </StepCard>
                  );
                }

                case "temperature": {
                  const selectedModel = modelsSection?.resources?.find(
                    (m) => m.id === draftState.modelId,
                  );
                  // JUDGMENT-GATED: see `selectedModelCapabilities` above — the
                  // generated model resource has no `temperature_lower`/`upper`
                  // fields, so these have always resolved to `null` at runtime.
                  // Behavior preserved verbatim pending a product/runtime
                  // decision on sourcing temperature bounds.
                  const selectedModelTemp = selectedModel as unknown as {
                    temperature_lower?: number | null;
                    temperature_upper?: number | null;
                  } | undefined;

                  return (
                    <StepCard
                      stepStatus={stepStatus}
                      stepNumber={stepNumber}
                      stepTitle={stepTitle}
                      stepDescription={stepDescription}
                      isReadonly={isReadonly}
                      isEditMode={isEditMode}
                      resetFields={["temperature_level_id"]}
                      {...(onReset ? { onReset } : {})}
                      resetLabel="Reset"
                      actions={
                        stepResources["temperature"] &&
                        stepResources["temperature"].length > 0 &&
                        sectionData?.temperature_levels?.show_ai_generate ? (
                          <StepCardAiButton
                            stepId="temperature"
                            resourceTypes={stepResources["temperature"] ?? []}
                            canRegenerate={canRegenerateForStepCard}
                            isGenerating={isGeneratingForStepCard}
                            onOpenModal={handleDirectStepGenerate}
                            disabled={isReadonly}
                          />
                        ) : undefined
                      }
                    >
                      <TemperatureLevelsField
                        temperature_level_id={draftState.temperature_level_id}
                        temperature_level_resource={
                          (temperatureLevelsSection?.resource ??
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            null) as any
                        }
                        show_temperature_levels={
                          temperatureLevelsSection?.show ?? true
                        }
                        temperature_level_suggestions={
                          temperatureLevelsSection?.suggestions ?? []
                        }
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        temperature_levels={mergedTemperatureLevels as any[]}
                        temperature_lower={
                          selectedModelTemp?.temperature_lower ?? null
                        }
                        temperature_upper={
                          selectedModelTemp?.temperature_upper ?? null
                        }
                        disabled={isReadonly}
                        onTemperatureLevelIdChange={(id: string | null) =>
                          setDraftState((prev) => ({
                            ...prev,
                            temperature_level_id: id,
                          }))
                        }
                        onGenerate={handleGenerateTemperatureLevels}
                        showSlider={true}

                        showAiGenerate={false}
                      />
                    </StepCard>
                  );
                }

                case "reasoning": {
                  return (
                    <StepCard
                      stepStatus={stepStatus}
                      stepNumber={stepNumber}
                      stepTitle={stepTitle}
                      stepDescription={stepDescription}
                      isReadonly={isReadonly}
                      isEditMode={isEditMode}
                      resetFields={["reasoning_level_id"]}
                      {...(onReset ? { onReset } : {})}
                      resetLabel="Reset"
                      actions={
                        stepResources["reasoning"] &&
                        stepResources["reasoning"].length > 0 &&
                        sectionData?.reasoning_levels?.show_ai_generate ? (
                          <StepCardAiButton
                            stepId="reasoning"
                            resourceTypes={stepResources["reasoning"] ?? []}
                            canRegenerate={canRegenerateForStepCard}
                            isGenerating={isGeneratingForStepCard}
                            onOpenModal={handleDirectStepGenerate}
                            disabled={isReadonly}
                          />
                        ) : undefined
                      }
                    >
                      <ReasoningLevelsField
                        reasoning_level_id={draftState.reasoning_level_id}
                        reasoning_level_resource={
                          reasoningLevelsSection?.resource
                            ? {
                                id: reasoningLevelsSection.resource.id ?? null,
                                reasoning_level:
                                  reasoningLevelsSection.resource
                                    .reasoning_level ?? null,
                                generated:
                                  reasoningLevelsSection.resource.generated ??
                                  null,
                                suggested:
                                  reasoningLevelsSection.resource.suggested ??
                                  null,
                                pending:
                                  reasoningLevelsSection.resource.pending ??
                                  null,
                              }
                            : null
                        }
                        show_reasoning_levels={
                          reasoningLevelsSection?.show ?? true
                        }
                        reasoning_levels={mergedReasoningLevels}
                        disabled={isReadonly}
                        onReasoningLevelIdChange={(id: string | null) =>
                          setDraftState((prev) => ({
                            ...prev,
                            reasoning_level_id: id,
                          }))
                        }
                      />
                    </StepCard>
                  );
                }

                case "voice": {
                  return (
                    <StepCard
                      stepStatus={stepStatus}
                      stepNumber={stepNumber}
                      stepTitle={stepTitle}
                      stepDescription={stepDescription}
                      isReadonly={isReadonly}
                      isEditMode={isEditMode}
                      resetFields={["voice_ids"]}
                      {...(onReset ? { onReset } : {})}
                      resetLabel="Reset"
                      actions={
                        stepResources["voice"] &&
                        stepResources["voice"].length > 0 &&
                        sectionData?.voices?.show_ai_generate ? (
                          <StepCardAiButton
                            stepId="voice"
                            resourceTypes={stepResources["voice"] ?? []}
                            canRegenerate={canRegenerateForStepCard}
                            isGenerating={isGeneratingForStepCard}
                            onOpenModal={handleDirectStepGenerate}
                            disabled={isReadonly}
                          />
                        ) : undefined
                      }
                    >
                      <VoicesField
                        voice_ids={draftState.voice_ids}
                        voice_resources={(voicesSection?.current ?? []).map(
                          (v): VoiceResourceItem => ({
                            id: v.id ?? null,
                            voice: v.voice ?? null,
                            generated: v.generated ?? null,
                            suggested: v.suggested ?? null,
                            pending: v.pending ?? null,
                          }),
                        )}
                        show_voices={voicesSection?.show ?? true}
                        voices={mergedVoices}
                        disabled={isReadonly}
                        onVoiceIdsChange={(ids: string[]) =>
                          setDraftState((prev) => ({ ...prev, voice_ids: ids }))
                        }
                        onAcceptPending={(pendingIds: string[]) =>
                          handleAcceptPendingMulti("voice_ids", pendingIds)
                        }
                        onRejectPending={(pendingIds: string[]) =>
                          handleRejectPendingMulti("voice_ids", pendingIds)
                        }
                      />
                    </StepCard>
                  );
                }

                case "qualities": {
                  return (
                    <StepCard
                      stepStatus={stepStatus}
                      stepNumber={stepNumber}
                      stepTitle={stepTitle}
                      stepDescription={stepDescription}
                      isReadonly={isReadonly}
                      isEditMode={isEditMode}
                      resetFields={["quality_ids"]}
                      {...(onReset ? { onReset } : {})}
                      resetLabel="Reset"
                      actions={
                        stepResources["qualities"] &&
                        stepResources["qualities"].length > 0 &&
                        sectionData?.qualities?.show_ai_generate ? (
                          <StepCardAiButton
                            stepId="qualities"
                            resourceTypes={stepResources["qualities"] ?? []}
                            canRegenerate={canRegenerateForStepCard}
                            isGenerating={isGeneratingForStepCard}
                            onOpenModal={handleDirectStepGenerate}
                            disabled={isReadonly}
                          />
                        ) : undefined
                      }
                    >
                      <QualitiesField
                        quality_ids={draftState.quality_ids}
                        quality_resources={(qualitiesSection?.current ?? []).map(
                          (q): QualitiesResourceItem => ({
                            id: q.id ?? null,
                            quality: q.quality ?? null,
                            generated: q.generated ?? null,
                            suggested: q.suggested ?? null,
                            pending: q.pending ?? null,
                          }),
                        )}
                        show_qualities={qualitiesSection?.show ?? false}
                        qualities={mergedQualities}
                        disabled={isReadonly}
                        onChange={(ids: string[]) =>
                          setDraftState((prev) => ({
                            ...prev,
                            quality_ids: ids,
                          }))
                        }
                        label="Qualities"
                      />
                    </StepCard>
                  );
                }

                case "rubrics": {
                  return (
                    <StepCard
                      stepStatus={stepStatus}
                      stepNumber={stepNumber}
                      stepTitle={stepTitle}
                      stepDescription={stepDescription}
                      isReadonly={isReadonly}
                      isEditMode={isEditMode}
                      resetFields={["rubric_ids"]}
                      {...(onReset ? { onReset } : {})}
                      resetLabel="Reset"
                      actions={
                        stepResources["rubrics"] &&
                        stepResources["rubrics"].length > 0 &&
                        sectionData?.rubrics?.show_ai_generate ? (
                          <StepCardAiButton
                            stepId="rubrics"
                            resourceTypes={stepResources["rubrics"] ?? []}
                            canRegenerate={canRegenerateForStepCard}
                            isGenerating={isGeneratingForStepCard}
                            onOpenModal={handleDirectStepGenerate}
                            disabled={isReadonly}
                          />
                        ) : undefined
                      }
                    >
                      <RubricsField
                        rubric_ids={draftState.rubric_ids}
                        rubric_resources={(rubricsSection?.current ?? []).map(
                          (r): RubricsResourceItem => ({
                            id: r.id ?? null,
                            name: r.name ?? null,
                            description: r.description ?? null,
                            generated: r.generated ?? null,
                            suggested: r.suggested ?? null,
                            pending: r.pending ?? null,
                          }),
                        )}
                        show_rubrics={rubricsSection?.show ?? false}
                        rubrics={mergedRubrics}
                        disabled={isReadonly}
                        onChange={(ids: string[]) =>
                          setDraftState((prev) => ({
                            ...prev,
                            rubric_ids: ids,
                          }))
                        }
                        label="Rubrics"
                      />
                    </StepCard>
                  );
                }

                case "prompt": {
                  const promptSearch =
                    (stepFormData["promptSearch"] as string) || "";
                  return (
                    <StepCard
                      stepStatus={stepStatus}
                      stepNumber={stepNumber}
                      stepTitle={stepTitle}
                      stepDescription={stepDescription}
                      isReadonly={isReadonly}
                      isEditMode={isEditMode}
                      resetFields={["prompt_id"]}
                      {...(onReset ? { onReset } : {})}
                      resetLabel="Reset"
                      actions={
                        stepResources["prompt"] &&
                        stepResources["prompt"].length > 0 &&
                        sectionData?.prompts?.show_ai_generate ? (
                          <StepCardAiButton
                            stepId="prompt"
                            resourceTypes={stepResources["prompt"] ?? []}
                            canRegenerate={canRegenerateForStepCard}
                            isGenerating={isGeneratingForStepCard}
                            onOpenModal={handleDirectStepGenerate}
                            disabled={isReadonly}
                          />
                        ) : undefined
                      }
                    >
                      <PromptsField
                        prompt_id={draftState.prompt_id}
                        prompt_resource={
                          promptsSection?.resource
                            ? {
                                id: promptsSection.resource.id ?? null,
                                name: promptsSection.resource.name ?? null,
                                description:
                                  promptsSection.resource.description ?? null,
                                system_prompt:
                                  promptsSection.resource.system_prompt ?? null,
                                generated:
                                  promptsSection.resource.generated ?? null,
                                pending: promptsSection.resource.pending ?? null,
                              }
                            : null
                        }
                        show_prompts={promptsSection?.show ?? true}
                        prompts={mergedPrompts}
                        disabled={isReadonly}
                        onPromptIdChange={(id: string | null) => {
                          setDraftState((prev) => ({ ...prev, prompt_id: id, prompt: null }));
                        }}
                        onPromptChange={(
                          prompt: {
                            system_prompt: string;
                            name: string;
                            description: string;
                          } | null,
                        ) => {
                          setDraftState((prev) => ({ ...prev, prompt, prompt_id: null }));
                        }}
                        searchTerm={promptSearch}
                        onSearchChange={(term: string) =>
                          setStepFormData({ promptSearch: term || null })
                        }
                      />
                    </StepCard>
                  );
                }

                case "instructions": {
                  const instructionsSearch =
                    (stepFormData["instructionsSearch"] as string) || "";
                  return (
                    <StepCard
                      stepStatus={stepStatus}
                      stepNumber={stepNumber}
                      stepTitle={stepTitle}
                      stepDescription={stepDescription}
                      isReadonly={isReadonly}
                      isEditMode={isEditMode}
                      resetFields={["instructions_id"]}
                      {...(onReset ? { onReset } : {})}
                      resetLabel="Reset"
                      actions={
                        stepResources["instructions"] &&
                        stepResources["instructions"].length > 0 &&
                        sectionData?.instructions?.show_ai_generate ? (
                          <StepCardAiButton
                            stepId="instructions"
                            resourceTypes={stepResources["instructions"] ?? []}
                            canRegenerate={canRegenerateForStepCard}
                            isGenerating={isGeneratingForStepCard}
                            onOpenModal={handleDirectStepGenerate}
                            disabled={isReadonly}
                          />
                        ) : undefined
                      }
                    >
                      <InstructionsField
                        instructions_id={draftState.instructions_id}
                        instructions_resource={
                          instructionsSection?.resource
                            ? {
                                id: instructionsSection.resource.id ?? null,
                                template:
                                  instructionsSection.resource.template ?? null,
                                generated:
                                  instructionsSection.resource.generated ??
                                  null,
                                suggested:
                                  instructionsSection.resource.suggested ??
                                  null,
                                pending:
                                  instructionsSection.resource.pending ?? null,
                              }
                            : null
                        }
                        show_instructions={instructionsSection?.show ?? true}
                        instructions={mergedInstructions}
                        disabled={isReadonly}
                        onInstructionsIdChange={(id: string | null) =>
                          setDraftState((prev) => ({
                            ...prev,
                            instructions_id: id,
                          }))
                        }
                        onAcceptPending={(pendingId: string) =>
                          handleAcceptPendingField("instructions_id", pendingId)
                        }
                        onRejectPending={(pendingId: string) =>
                          handleRejectPendingField("instructions_id", pendingId)
                        }
                        searchTerm={instructionsSearch}
                        onSearchChange={(term: string) =>
                          setStepFormData({ instructionsSearch: term || null })
                        }
                      />
                    </StepCard>
                  );
                }
                default:
                  return null;
              }
            }}
          />
        </div>

    </div>
  );
}
