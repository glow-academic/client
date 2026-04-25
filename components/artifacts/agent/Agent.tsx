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
import { Departments } from "@/components/resources/Departments";
import { Descriptions } from "@/components/resources/Descriptions";
import { Flags } from "@/components/resources/Flags";
import { Instructions } from "@/components/resources/Instructions";
import { Models } from "@/components/resources/Models";
import { Names } from "@/components/resources/Names";
import { Prompts } from "@/components/resources/Prompts";
import { ReasoningLevels } from "@/components/resources/ReasoningLevels";
import { TemperatureLevels } from "@/components/resources/TemperatureLevels";
import { Tools } from "@/components/resources/Tools";
import { Voices } from "@/components/resources/Voices";
import { Qualities } from "@/components/resources/Qualities";
import { Rubrics } from "@/components/resources/Rubrics";
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

const DescriptionsField = Descriptions as any;
const DepartmentsField = Departments as any;
const ToolsField = Tools as any;
const ModelsField = Models as any;
const TemperatureLevelsField = TemperatureLevels as any;
const ReasoningLevelsField = ReasoningLevels as any;
const VoicesField = Voices as any;
const QualitiesField = Qualities as any;
const RubricsField = Rubrics as any;
const PromptsField = Prompts as any;
const InstructionsField = Instructions as any;

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
  const registerFlushCallbacks = useMemo(
    () => ({
      prompts: (
        flush: () => Promise<{ prompt_id: string | null } | void>,
      ) => {
        flushRegistryRef.current.set("prompts", flush);
      },
    }),
    [],
  );

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
  const sectionData = useMemo<any>(() => {
    if (!agentData) return undefined;
    const flags = (agentData.flags ?? []) as any[];
    const selectedFlags = flags.filter((flag: any) => flag.selected);
    return {
      ...agentData,
      names: toSingleSection(agentData.names as any, {
        show: true,
        required: true,
        showAiGenerate: !!agentData.basic_show_ai_generate,
      }),
      descriptions: toSingleSection(agentData.descriptions as any, {
        show: true,
        required: false,
        showAiGenerate: !!agentData.basic_show_ai_generate,
      }),
      models: toSingleSection(agentData.models as any, {
        show: true,
        required: true,
        showAiGenerate: !!agentData.basic_show_ai_generate,
      }),
      prompts: toSingleSection(agentData.prompts as any, {
        show: true,
        required: false,
        showAiGenerate: !!agentData.general_show_ai_generate,
      }),
      instructions: toSingleSection(agentData.instructions as any, {
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
          ((agentData.departments ?? []) as any[]).map((item: any) => ({
            ...item,
            id: item.department_id,
          })) as any,
          {
            show: true,
            required: false,
            showAiGenerate: !!agentData.general_show_ai_generate,
          },
        ),
      },
      tools: toMultiSection(agentData.tools as any, {
        show: true,
        required: false,
        showAiGenerate: !!agentData.general_show_ai_generate,
      }),
      temperature_levels: toSingleSection(agentData.temperature_levels as any, {
        show: true,
        required: false,
        showAiGenerate: !!agentData.general_show_ai_generate,
      }),
      reasoning_levels: toSingleSection(agentData.reasoning_levels as any, {
        show: true,
        required: false,
        showAiGenerate: !!agentData.general_show_ai_generate,
      }),
      voices: toMultiSection(agentData.voices as any, {
        show: true,
        required: false,
        showAiGenerate: !!agentData.general_show_ai_generate,
      }),
      qualities: toMultiSection(agentData.qualities as any, {
        show: true,
        required: false,
        showAiGenerate: !!agentData.general_show_ai_generate,
      }),
      rubrics: toMultiSection(agentData.rubrics as any, {
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

    const currentFlagIds: string[] = ((data.flags?.current ?? []) as any[])
      .map((f: any) => f.id)
      .filter((id: any): id is string => !!id);
    const currentDepartments =
      data.departments?.current
        ?.map((d: any) => d.department_id)
        .filter((id: any): id is string => !!id) ?? [];
    const currentTools =
      data.tools?.current
        ?.map((t: any) => t.id)
        .filter((id: any): id is string => !!id) ?? [];
    const currentVoices =
      data.voices?.current
        ?.map((v: any) => v.id)
        .filter((id: any): id is string => !!id) ?? [];
    const currentQualities =
      data.qualities?.current
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ?.map((q: any) => q.id)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((id: any): id is string => !!id) ?? [];
    const currentRubrics =
      data.rubrics?.current
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ?.map((r: any) => r.id)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((id: any): id is string => !!id) ?? [];

    return {
      name_id: data.names?.resource?.id ?? null,
      name: null,
      description_id: data.descriptions?.resource?.id ?? null,
      description: null,
      prompt_id: data.prompts?.resource?.id ?? null,
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
      pending_ids: (data.pending_ids ?? []) as string[],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            flag_ids: (fs as any).flag_ids ?? prev.flag_ids,
            departmentIds: fs.department_ids ?? prev.departmentIds,
            modelId: (fs as any).model_id ?? prev.modelId,
            tool_ids: fs.tool_ids ?? prev.tool_ids,
            reasoning_level_id:
              (fs as any).reasoning_level_id ?? prev.reasoning_level_id,
            temperature_level_id:
              (fs as any).temperature_level_id ?? prev.temperature_level_id,
            voice_ids: fs.voice_ids ?? prev.voice_ids,
            quality_ids: (fs as any).quality_ids ?? prev.quality_ids,
            rubric_ids: (fs as any).rubric_ids ?? prev.rubric_ids,
            prompt_id: (fs as any).prompt_id ?? prev.prompt_id,
            instructions_id:
              (fs as any).instruction_id ?? prev.instructions_id,
            pending_ids: (fs as any).pending_ids ?? prev.pending_ids,
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
    if (current.prompt_id) payload["prompt_id"] = current.prompt_id;
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (m: any) => m.id === draftState.modelId,
    );
    if (!selectedModel) {
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inputMods = (selectedModel as any).input_modalities ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const outputMods = (selectedModel as any).output_modalities ?? [];

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
      prompt_id: (_s, init) => ({ prompt_id: init.prompt_id }),
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ?.map((d: any) => d.department_id)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .filter((id: any): id is string => !!id) ?? [];
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            modelsSection?.resources?.some(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (m: any) => (m as { generated?: boolean }).generated,
            ) ?? false
          );
        case "prompts":
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return promptsSection?.resources?.some((p: any) => p.generated) ?? false;
        case "instructions":
          return instructionsSection?.resource?.generated ?? false;
        case "flags":
          return flagsSection?.current?.some((f: any) => f.generated) ?? false;
        case "departments":
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return departmentsSection?.current?.some((d: any) => d.generated) ?? false;
        case "reasoning_levels":
          return reasoningLevelsSection?.resource?.generated ?? false;
        // eslint-disable-next-line react-hooks/exhaustive-deps
        case "temperature_levels":
          return temperatureLevelsSection?.resource?.generated ?? false;
        case "voices":
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return voicesSection?.current?.some((v: any) => v.generated) ?? false;
        case "tools":
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return toolsSection?.current?.some((t: any) => t.generated) ?? false;
        case "qualities":
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return qualitiesSection?.current?.some((q: any) => q.generated) ?? false;
        case "rubrics":
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return rubricsSection?.current?.some((r: any) => r.generated) ?? false;
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
  const handleGenerateDescription = useCallback(
    async () => handleGenerateResources(["descriptions"]),
    [handleGenerateResources],
  );

  const handleGenerateDepartments = useCallback(
    async () => handleGenerateResources(["departments"]),
    [handleGenerateResources],
  );

  const handleGenerateFlags = useCallback(
    async () => handleGenerateResources(["flags"]),
    [handleGenerateResources],
  );

  const handleGenerateReasoningLevels = useCallback(
    async () => handleGenerateResources(["reasoning_levels"]),
    [handleGenerateResources],
  );

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
  const mergedDescriptions = descriptionsSection?.resources ?? [];
  const mergedModels = modelsSection?.resources ?? [];
  const mergedPrompts = promptsSection?.resources ?? [];
  const mergedInstructions = instructionsSection?.resources ?? [];
  const mergedTemperatureLevels = temperatureLevelsSection?.resources ?? [];
  const mergedReasoningLevels = reasoningLevelsSection?.resources ?? [];
  const mergedTools = toolsSection?.resources ?? [];
  const mergedVoices = voicesSection?.resources ?? [];
  const mergedDepartments = departmentsSection?.resources ?? [];
  const mergedQualities = qualitiesSection?.resources ?? [];
  const mergedRubrics = rubricsSection?.resources ?? [];

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
                          description_suggestions={
                            descriptionsSection?.suggestions ?? []
                          }
                          descriptions={mergedDescriptions}
                          disabled={isReadonly}
                          onDescriptionIdChange={handleDescriptionIdChange}
                          onDescriptionChange={handleDescriptionChange}
                          searchTerm={descriptionSearch}
                          onSearchChange={(term: string) =>
                            setStepFormData({ descriptionSearch: term || null })
                          }
                          onGenerate={handleGenerateDescription}
                          label="Description"
                          placeholder="Detailed behavior description and personality traits"
                          required={descriptionsSection?.required ?? false}
                          rows={4}
                          data-testid="input-agent-description"

                          showAiGenerate={false}
                        />

                        {/* Department Selection */}
                        <DepartmentsField
                          department_ids={draftState.departmentIds || []}
                          department_resources={
                            (departmentsSection?.current ??
                              // eslint-disable-next-line @typescript-eslint/no-explicit-any
                              []) as any[]
                          }
                          show_departments={
                            departmentsSection?.show ?? false
                          }
                          department_suggestions={
                            (departmentsSection?.suggestions ?? []) as string[]
                          }
                          departments={mergedDepartments}
                          disabled={isReadonly}
                          onChange={(ids: string[]) => {
                            setDraftState((prev) => ({
                              ...prev,
                              departmentIds: ids,
                            }));
                          }}
                          onGenerate={handleGenerateDepartments}
                          required={departmentsSection?.required ?? false}

                          showAiGenerate={false}
                        />

                        <Flags
                          flags={(flagsSection?.resources ?? []) as any}
                          values={(() => {
                            const map: Record<string, boolean | null> = {};
                            const rows = (flagsSection?.resources ?? []) as any[];
                            const byId = new Map(
                              rows.filter((f: any) => f.id).map((f: any) => [f.id as string, f])
                            );
                            for (const id of draftState.flag_ids) {
                              const row = byId.get(id) as any;
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
                              const rows = ((flagsSection?.resources ?? []) as any[])
                                .filter((f: any) => (f.type ?? f.name) === type);
                              const rowIds = new Set(
                                rows.map((r: any) => r.id).filter((id: any): id is string => !!id)
                              );
                              const retained = prev.flag_ids.filter((id) => !rowIds.has(id));
                              const target =
                                next == null ? null : rows.find((r: any) => r.value === next)?.id ?? null;
                              return {
                                ...prev,
                                flag_ids: target ? [...retained, target] : retained,
                              };
                            });
                          }}
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
                        tool_resources={
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          (toolsSection?.current ?? []) as any[]
                        }
                        show_tools={toolsSection?.show ?? false}
                        tool_suggestions={toolsSection?.suggestions ?? []}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        tools={mergedTools as any[]}
                        disabled={isReadonly}
                        onChange={(ids: string[]) =>
                          setDraftState((prev) => ({ ...prev, tool_ids: ids }))
                        }
                        label="Tools"
                        description="Select the tools this agent can use. Tools define what operations the agent can perform."
                        required={toolsSection?.required ?? false}

                        showAiGenerate={false}
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
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          (modelsSection?.resource ?? null) as any
                        }
                        show_models={modelsSection?.show ?? true}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        models={mergedModels as any[]}
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
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (m: any) => m.id === draftState.modelId,
                  );

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
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          (selectedModel as any)?.temperature_lower ?? null
                        }
                        temperature_upper={
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          (selectedModel as any)?.temperature_upper ?? null
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
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          (reasoningLevelsSection?.resource ?? null) as any
                        }
                        show_reasoning_levels={
                          reasoningLevelsSection?.show ?? true
                        }
                        reasoning_level_suggestions={
                          reasoningLevelsSection?.suggestions ?? []
                        }
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        reasoning_levels={mergedReasoningLevels as any[]}
                        disabled={isReadonly}
                        onReasoningLevelIdChange={(id: string | null) =>
                          setDraftState((prev) => ({
                            ...prev,
                            reasoning_level_id: id,
                          }))
                        }
                        onGenerate={handleGenerateReasoningLevels}

                        showAiGenerate={false}
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
                        voice_resources={
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          (voicesSection?.current ?? []) as any[]
                        }
                        show_voices={voicesSection?.show ?? true}
                        voice_suggestions={voicesSection?.suggestions ?? []}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        voices={mergedVoices as any[]}
                        disabled={isReadonly}
                        onVoiceIdsChange={(ids: string[]) =>
                          setDraftState((prev) => ({ ...prev, voice_ids: ids }))
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
                        quality_resources={
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          (qualitiesSection?.current ?? []) as any[]
                        }
                        show_qualities={qualitiesSection?.show ?? false}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        qualities={mergedQualities as any[]}
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
                        rubric_resources={
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          (rubricsSection?.current ?? []) as any[]
                        }
                        show_rubrics={rubricsSection?.show ?? false}
                        rubric_suggestions={rubricsSection?.suggestions ?? []}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        rubrics={mergedRubrics as any[]}
                        disabled={isReadonly}
                        onChange={(ids: string[]) =>
                          setDraftState((prev) => ({
                            ...prev,
                            rubric_ids: ids,
                          }))
                        }
                        label="Rubrics"
                        showAiGenerate={false}
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
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          (promptsSection?.resource ?? null) as any
                        }
                        show_prompts={promptsSection?.show ?? true}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        prompts={mergedPrompts as any[]}
                        disabled={isReadonly}
                        onPromptIdChange={(id: string | null) => {
                          setDraftState((prev) => ({ ...prev, prompt_id: id, prompt: null }));
                        }}
                        onPromptChange={(prompt) => {
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
                          (instructionsSection?.resource ??
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            null) as any
                        }
                        show_instructions={instructionsSection?.show ?? true}
                        instructions_suggestions={
                          instructionsSection?.suggestions ?? []
                        }
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        instructions={mergedInstructions as any[]}
                        disabled={isReadonly}
                        onInstructionsIdChange={(id: string | null) =>
                          setDraftState((prev) => ({
                            ...prev,
                            instructions_id: id,
                          }))
                        }
                        searchTerm={instructionsSearch}
                        onSearchChange={(term: string) =>
                          setStepFormData({ instructionsSearch: term || null })
                        }

                        showAiGenerate={false}
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
