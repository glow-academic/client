"use client";

import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  GenericForm,
  type StepStatus,
} from "@/components/common/forms/GenericForm";
import { StepCardAiButton } from "@/components/common/forms/StepCardAiButton";
import { StepCard } from "@/components/common/forms/StepCard";
import { GenerateRegenerateModal } from "@/components/common/forms/GenerateRegenerateModal";
import { ReadOnlyBanner } from "@/components/common/forms/ReadOnlyBanner";
import { Departments } from "@/components/resources/Departments";
import { Descriptions } from "@/components/resources/Descriptions";
import { Endpoints } from "@/components/resources/Endpoints";
import { Flags } from "@/components/resources/Flags";
import { Keys } from "@/components/resources/Keys";
import { Names } from "@/components/resources/Names";
import { Values } from "@/components/resources/Values";
import { useDrafts } from "@/contexts/draft-context";
import { useSocket } from "@/contexts/socket-context";
import { useArtifactGeneration } from "@/hooks/use-artifact-generation";
import { useDraftLifecycle } from "@/hooks/use-draft-lifecycle";
import { useFlushRegistry } from "@/hooks/use-flush-registry";
import { useGenerationModal } from "@/hooks/use-generation-modal";
import type { InputOf, OutputOf } from "@/lib/api/types";
import {
  buildResourceActions,
  checkHasResourceIds,
  computeEffectiveFormState,
  type ResourceConfig,
} from "@/lib/resources/action-builders";
import type { ResourceType } from "@/lib/resources/types";
import type { Parser } from "nuqs";
import { parseAsString } from "nuqs";

type SaveProviderIn = InputOf<"/api/v4/artifacts/providers/save", "post">;
type SaveProviderOut = OutputOf<"/api/v4/artifacts/providers/save", "post">;
type PatchProviderDraftIn = InputOf<"/api/v4/artifacts/providers/draft", "patch">;
type PatchProviderDraftOut = OutputOf<
  "/api/v4/artifacts/providers/draft",
  "patch"
>;
type SaveProviderBody = SaveProviderIn["body"];
type PatchProviderDraftBody = PatchProviderDraftIn["body"];
type CreateDraftNamesIn = InputOf<"/api/v4/resources/names", "post">;
type CreateDraftNamesOut = OutputOf<"/api/v4/resources/names", "post">;
type CreateDraftDescriptionsIn = InputOf<
  "/api/v4/resources/descriptions",
  "post"
>;
type CreateDraftDescriptionsOut = OutputOf<
  "/api/v4/resources/descriptions",
  "post"
>;
type CreateDraftValuesIn = InputOf<"/api/v4/resources/values", "post">;
type CreateDraftValuesOut = OutputOf<"/api/v4/resources/values", "post">;
type ProviderData = OutputOf<"/api/v4/artifacts/providers/get", "post">;

type ProviderFormState = {
  name_id: string | null;
  description_id: string | null;
  active_flag_id: string | null;
  department_ids: string[];
  value_id: string | null;
  endpoint_id: string | null;
  key_id: string | null;
};

const FLUSH_KEYS = ["names", "descriptions", "values"] as const;
const PROVIDER_RESOURCE_CONFIG: ResourceConfig[] = [
  { key: "names", formKey: "name_id", flushKey: "name_id", type: "single" },
  {
    key: "descriptions",
    formKey: "description_id",
    flushKey: "description_id",
    type: "single",
  },
  { key: "flags", formKey: "active_flag_id", flushKey: null, type: "single" },
  {
    key: "departments",
    formKey: "department_ids",
    flushKey: null,
    type: "multi",
  },
  { key: "values", formKey: "value_id", flushKey: null, type: "single" },
  { key: "endpoints", formKey: "endpoint_id", flushKey: null, type: "single" },
  { key: "keys", formKey: "key_id", flushKey: null, type: "single" },
];
const PROVIDER_RESOURCES: ResourceType[] = [
  "names",
  "descriptions",
  "flags",
  "departments",
  "values",
  "endpoints",
];

export interface ProviderProps {
  providerId?: string;
  providerData?: ProviderData;
  saveProviderAction?: (input: SaveProviderIn) => Promise<SaveProviderOut>;
  patchProviderDraftAction?: (
    input: PatchProviderDraftIn
  ) => Promise<PatchProviderDraftOut>;
  createNamesAction?: (
    input: CreateDraftNamesIn
  ) => Promise<CreateDraftNamesOut>;
  createDescriptionsAction?: (
    input: CreateDraftDescriptionsIn
  ) => Promise<CreateDraftDescriptionsOut>;
  createValuesAction?: (
    input: CreateDraftValuesIn
  ) => Promise<CreateDraftValuesOut>;
}

export default function Provider({
  providerId,
  providerData,
  saveProviderAction,
  patchProviderDraftAction,
  createNamesAction,
  createDescriptionsAction,
  createValuesAction,
}: ProviderProps) {
  const isEditMode = !!providerId;
  const router = useRouter();
  const { socket, isConnected } = useSocket();
  const { isAutosaveEnabled, setSelectedDraftId } = useDrafts();
  const { flushRegistryRef, registerFlushCallbacks, flushAllResources } =
    useFlushRegistry<Record<string, unknown>>(FLUSH_KEYS);

  const s = providerData;
  const groupId = s?.group_id ?? null;

  const getInitialFormState = useCallback((): ProviderFormState => {
    if (!s) {
      return {
        name_id: null,
        description_id: null,
        active_flag_id: null,
        department_ids: [],
        value_id: null,
        endpoint_id: null,
        key_id: null,
      };
    }
    return {
      name_id: (s.names?.resource?.id as string) ?? null,
      description_id: (s.descriptions?.resource?.id as string) ?? null,
      active_flag_id: (s.flags?.current?.[0]?.flag_option_id as string) ?? null,
      department_ids: (s.departments?.current ?? [])
        .map((d) => d.department_id as string)
        .filter(Boolean),
      value_id: (s.values?.resource?.id as string) ?? null,
      endpoint_id: (s.endpoints?.resource?.id as string) ?? null,
      key_id: (s.keys?.resource?.id as string) ?? null,
    };
  }, [s]);

  const [formState, setFormState] = useState<ProviderFormState>(getInitialFormState);
  const referenceStateRef = React.useRef<ProviderFormState>(getInitialFormState());
  const formStateRef = React.useRef(formState);
  useEffect(() => {
    formStateRef.current = formState;
  }, [formState]);
  useEffect(() => {
    const initial = getInitialFormState();
    setFormState(initial);
    referenceStateRef.current = initial;
  }, [getInitialFormState]);

  const { isGenerating, startGenerating } = useArtifactGeneration({
    artifactType: "provider",
    groupId: groupId,
    validResourceTypes: PROVIDER_RESOURCES as string[],
  });

  const providerSearchParamsClient = useMemo(
    () => ({ draftId: parseAsString }),
    []
  );
  const formStateKey = useMemo(() => JSON.stringify(formState), [formState]);

  const patchActionRef = React.useRef<
    | ((
        payload: Record<string, unknown>
      ) => Promise<{ draft_id?: string | null; new_version?: number | null }>)
    | undefined
  >(undefined);
  useEffect(() => {
    if (patchProviderDraftAction) {
      patchActionRef.current = async (payload: Record<string, unknown>) =>
        patchProviderDraftAction({ body: payload } as PatchProviderDraftIn);
    } else {
      patchActionRef.current = undefined;
    }
  }, [patchProviderDraftAction]);

  const hasResourceIds = checkHasResourceIds(
    PROVIDER_RESOURCE_CONFIG,
    formState as unknown as Record<string, unknown>
  );

  const { setUrlFormDataRef, onFormDataChange, flushAllAndSave, formDataRef } =
    useDraftLifecycle({
      formStateKey,
      patchActionRef,
      isAutosaveEnabled,
      buildPatchPayload: (
        inputDraftId: string | null,
        expectedVersion: number,
        flushResults?: Record<string, unknown>
      ) => {
        const effectiveState = computeEffectiveFormState(
          PROVIDER_RESOURCE_CONFIG,
          formStateRef.current as unknown as Record<string, unknown>,
          flushResults ?? {}
        );
        const resourceActions = buildResourceActions(PROVIDER_RESOURCE_CONFIG, {
          formState: effectiveState,
          referenceState: referenceStateRef.current as unknown as Record<
            string,
            unknown
          >,
          flushResults: flushResults ?? {},
          entityData: s as unknown as Record<string, unknown> | null,
        }) as Omit<
          PatchProviderDraftBody,
          "input_draft_id" | "group_id" | "expected_version"
        >;
        return {
          input_draft_id: inputDraftId,
          group_id: groupId,
          ...resourceActions,
          expected_version: expectedVersion,
        } as PatchProviderDraftBody;
      },
      setSelectedDraftId,
      serverDraftVersion: s?.draft_version ?? null,
      hasResourceIds,
      flushRegistryRef,
      formStateRef: formStateRef as React.MutableRefObject<Record<string, unknown>>,
    });

  const handleGenerateResources = useCallback(
    async (resourceTypes: ResourceType[], userInstructions?: string) => {
      if (!socket || !isConnected) {
        toast.error("WebSocket not connected");
        return;
      }
      startGenerating(resourceTypes);
      let currentDraftId =
        (formDataRef.current["draftId"] as string | undefined) ?? null;
      if (!currentDraftId) currentDraftId = await flushAllAndSave();
      if (!currentDraftId) {
        toast.error("Please save a draft before generating");
        return;
      }
      socket.emit("provider_generate", {
        resource_types: resourceTypes,
        user_instructions: userInstructions ? [userInstructions] : null,
        draft_id: currentDraftId,
        provider_id: providerId ?? null,
      });
    },
    [
      socket,
      isConnected,
      startGenerating,
      formDataRef,
      flushAllAndSave,
      providerId,
    ]
  );

  const stepResources: Record<string, ResourceType[]> = useMemo(
    () => ({
      basic: ["names", "descriptions", "flags", "departments"],
      integrations: ["values", "endpoints"],
      all: ["names", "descriptions", "flags", "departments", "values", "endpoints"],
    }),
    []
  );

  const canRegenerate = useCallback(
    (rt: ResourceType) => {
      if (!s) return false;
      if (rt === "names") return s.names?.resource?.generated ?? false;
      if (rt === "descriptions") return s.descriptions?.resource?.generated ?? false;
      if (rt === "flags") return s.flags?.current?.some((f) => f.generated) ?? false;
      if (rt === "departments") {
        return s.departments?.current?.some((d) => d.generated) ?? false;
      }
      if (rt === "values") return s.values?.resource?.generated ?? false;
      if (rt === "endpoints") return s.endpoints?.resource?.generated ?? false;
      return false;
    },
    [s]
  );

  const { handleOpenStepCardModal, modalProps } =
    useGenerationModal<ResourceType>({
      stepResources,
      resourceLabels: {
        names: "Names",
        descriptions: "Descriptions",
        flags: "Flags",
        departments: "Departments",
        values: "Values",
        endpoints: "Endpoints",
      },
      canRegenerate,
      onGenerate: (selectedResources, instructions) =>
        handleGenerateResources(selectedResources, instructions),
      isGenerating,
    });

  const handleSubmit = useCallback(async () => {
    if (!saveProviderAction) return;
    let flushResults: Record<string, unknown> = {};
    if (!isAutosaveEnabled) flushResults = await flushAllResources();
    const effectiveState = computeEffectiveFormState(
      PROVIDER_RESOURCE_CONFIG,
      formStateRef.current as unknown as Record<string, unknown>,
      flushResults
    );
    const nameId = effectiveState["name_id"] as string | null;
    const valueId = effectiveState["value_id"] as string | null;
    if (!nameId) throw new Error("Name is required");
    if (!valueId) throw new Error("Value is required");
    const saveActions = buildResourceActions(PROVIDER_RESOURCE_CONFIG, {
      formState: effectiveState,
      referenceState: isEditMode
        ? (referenceStateRef.current as unknown as Record<string, unknown>)
        : null,
      flushResults,
      entityData: s as unknown as Record<string, unknown> | null,
    }) as Omit<SaveProviderBody, "input_provider_id" | "group_id">;
    await saveProviderAction({
      body: {
        input_provider_id: providerId ?? null,
        group_id: groupId,
        ...saveActions,
      } as SaveProviderBody,
    });
    toast.success(isEditMode ? "Provider updated" : "Provider created");
    router.push("/intelligence/providers");
    router.refresh();
  }, [
    saveProviderAction,
    providerId,
    groupId,
    isEditMode,
    isAutosaveEnabled,
    flushAllResources,
    router,
  ]);

  const disabled = !s?.can_edit;
  const steps = useMemo(
    () => [
      {
        id: "basic",
        title: "Basic",
        description: "Name, description, status, and departments",
      },
      {
        id: "integrations",
        title: "Integrations",
        description: "Value, endpoint, and key",
      },
    ],
    []
  );

  const getStepStatus = useCallback(
    (stepId: string): StepStatus => {
      if (stepId === "basic") return formState.name_id ? "completed" : "active";
      if (stepId === "integrations") {
        return formState.value_id ? "completed" : "pending";
      }
      return "pending";
    },
    [formState.name_id, formState.value_id]
  );

  const NamesAny = Names as any;
  const DescriptionsAny = Descriptions as any;
  const FlagsAny = Flags as any;
  const DepartmentsAny = Departments as any;
  const ValuesAny = Values as any;
  const EndpointsAny = Endpoints as any;
  const KeysAny = Keys as any;

  const renderStep = useCallback(
    ({
      stepId,
      stepTitle,
      stepDescription,
      stepNumber,
      stepStatus,
    }: {
      stepId: string;
      stepTitle: string;
      stepDescription: string;
      stepNumber: number;
      stepStatus: StepStatus;
      isOptional: boolean;
    }) => {
      if (stepId === "basic") {
        return (
          <StepCard
            stepTitle={stepTitle}
            stepDescription={stepDescription}
            stepNumber={stepNumber}
            stepStatus={stepStatus}
            isReadonly={disabled}
            actions={
              <StepCardAiButton
                stepId="basic"
                resourceTypes={["names", "descriptions", "flags", "departments"]}
                canRegenerate={canRegenerate as (rt: string) => boolean}
                isGenerating={isGenerating as (rt: string) => boolean}
                onOpenModal={handleOpenStepCardModal}
                disabled={disabled || !s?.basic_show_ai_generate}
              />
            }
          >
            <NamesAny
              name_id={formState.name_id}
              name_resource={s?.names?.resource}
              show_name={s?.names?.show}
              name_suggestions={s?.names?.suggestions ?? undefined}
              names={s?.names?.resources ?? undefined}
              required={s?.names?.required}
              disabled={disabled}
              group_id={groupId}
              create_tool_id={s?.names?.create_tool_id}
              showAiGenerate={s?.names?.show_ai_generate}
              createNamesAction={createNamesAction}
              registerFlush={(
                registerFlushCallbacks as Record<
                  string,
                  (flush: () => Promise<Record<string, unknown> | void>) => void
                >
              )["names"]}
              onNameIdChange={(id: string | null) =>
                setFormState((prev) => ({ ...prev, name_id: id }))
              }
            />
            <DescriptionsAny
              description_id={formState.description_id}
              description_resource={s?.descriptions?.resource}
              show_description={s?.descriptions?.show}
              description_suggestions={s?.descriptions?.suggestions ?? undefined}
              descriptions={s?.descriptions?.resources ?? undefined}
              required={s?.descriptions?.required}
              disabled={disabled}
              group_id={groupId}
              create_tool_id={s?.descriptions?.create_tool_id}
              showAiGenerate={s?.descriptions?.show_ai_generate}
              createDescriptionsAction={createDescriptionsAction}
              registerFlush={(
                registerFlushCallbacks as Record<
                  string,
                  (flush: () => Promise<Record<string, unknown> | void>) => void
                >
              )["descriptions"]}
              onDescriptionIdChange={(id: string | null) =>
                setFormState((prev) => ({ ...prev, description_id: id }))
              }
            />
            <FlagsAny
              mode="single"
              flag_id={formState.active_flag_id}
              show_flags={s?.flags?.show ?? false}
              flags={s?.flags?.resources ?? []}
              showAiGenerate={s?.flags?.show_ai_generate}
              disabled={disabled}
              onChange={(id: string | null) =>
                setFormState((prev) => ({ ...prev, active_flag_id: id }))
              }
            />
            <DepartmentsAny
              department_ids={formState.department_ids}
              department_resources={s?.departments?.current ?? undefined}
              show_departments={s?.departments?.show}
              department_suggestions={s?.departments?.suggestions ?? undefined}
              departments={s?.departments?.resources ?? undefined}
              required={s?.departments?.required}
              showAiGenerate={s?.departments?.show_ai_generate}
              disabled={disabled}
              onChange={(ids: string[]) =>
                setFormState((prev) => ({ ...prev, department_ids: ids }))
              }
            />
          </StepCard>
        );
      }

      return (
        <StepCard
          stepTitle={stepTitle}
          stepDescription={stepDescription}
          stepNumber={stepNumber}
          stepStatus={stepStatus}
          isReadonly={disabled}
          actions={
            <StepCardAiButton
              stepId="integrations"
              resourceTypes={["values", "endpoints"]}
              canRegenerate={canRegenerate as (rt: string) => boolean}
              isGenerating={isGenerating as (rt: string) => boolean}
              onOpenModal={handleOpenStepCardModal}
              disabled={disabled || !s?.integrations_show_ai_generate}
            />
          }
        >
          <ValuesAny
            value_ids={formState.value_id ? [formState.value_id] : []}
            value_resources={
              s?.values?.resource
                ? [
                    {
                      value_id: s.values.resource.id,
                      name: s.values.resource.value,
                      generated: s.values.resource.generated,
                    },
                  ]
                : undefined
            }
            show_values={s?.values?.show}
            value_suggestions={s?.values?.suggestions ?? undefined}
            values={
              s?.values?.resources?.map((r) => ({
                value_id: r.id,
                name: r.value,
                generated: r.generated,
              })) ?? undefined
            }
            required={s?.values?.required}
            disabled={disabled}
            group_id={groupId}
            create_tool_id={s?.values?.create_tool_id}
            showAiGenerate={s?.values?.show_ai_generate}
            createValuesAction={createValuesAction}
            registerFlush={(
              registerFlushCallbacks as Record<
                string,
                (flush: () => Promise<Record<string, unknown> | void>) => void
              >
            )["values"]}
            onChange={(ids: string[]) =>
              setFormState((prev) => ({ ...prev, value_id: ids[0] ?? null }))
            }
          />
          <EndpointsAny
            endpoint_ids={formState.endpoint_id ? [formState.endpoint_id] : []}
            endpoint_resources={
              s?.endpoints?.resource
                ? [
                    {
                      endpoint_id: s.endpoints.resource.id,
                      name: s.endpoints.resource.base_url,
                      generated: s.endpoints.resource.generated,
                    },
                  ]
                : undefined
            }
            show_endpoints={s?.endpoints?.show}
            endpoint_suggestions={s?.endpoints?.suggestions ?? undefined}
            endpoints={
              s?.endpoints?.resources?.map((r) => ({
                endpoint_id: r.id,
                name: r.base_url,
                generated: r.generated,
              })) ?? undefined
            }
            required={s?.endpoints?.required}
            disabled={disabled}
            group_id={groupId}
            create_tool_id={s?.endpoints?.create_tool_id}
            showAiGenerate={s?.endpoints?.show_ai_generate}
            onChange={(ids: string[]) =>
              setFormState((prev) => ({ ...prev, endpoint_id: ids[0] ?? null }))
            }
          />
          <KeysAny
            key_id={formState.key_id}
            key_resource={
              s?.keys?.resource
                ? {
                    id: s.keys.resource.id,
                    name: s.keys.resource.name,
                    description: s.keys.resource.description,
                    key_masked: s.keys.resource.key,
                    active: true,
                    generated: s.keys.resource.generated,
                  }
                : null
            }
            show_key={s?.keys?.show}
            key_suggestions={s?.keys?.suggestions ?? undefined}
            keys={
              s?.keys?.resources?.map((r) => ({
                id: r.id,
                name: r.name,
                description: r.description,
                key_masked: r.key,
                active: true,
                generated: r.generated,
              })) ?? undefined
            }
            required={s?.keys?.required}
            disabled={disabled}
            onKeyIdChange={(id: string | null) =>
              setFormState((prev) => ({ ...prev, key_id: id }))
            }
          />
        </StepCard>
      );
    },
    [
      s,
      formState,
      disabled,
      canRegenerate,
      isGenerating,
      handleOpenStepCardModal,
      groupId,
      createNamesAction,
      createDescriptionsAction,
      createValuesAction,
      registerFlushCallbacks,
    ]
  );

  return (
    <div className="w-full p-6 space-y-8">
      <ReadOnlyBanner
        disabled={disabled}
        disabledReason={s?.disabled_reason ?? null}
        entityType="provider"
      />
      <GenericForm
        nuqsParsers={providerSearchParamsClient as Record<string, Parser<unknown>>}
        steps={steps}
        getStepStatus={getStepStatus}
        onSubmit={handleSubmit}
        submitButton={{
          createLabel: "Create Provider",
          updateLabel: "Save Provider",
          backUrl: "/intelligence/providers",
        }}
        isReadonly={disabled}
        isEditMode={isEditMode}
        renderStep={renderStep}
        onFormDataChange={onFormDataChange}
        registerSetFormData={(setter) => {
          setUrlFormDataRef.current = setter;
        }}
      />
      <GenerateRegenerateModal {...modalProps} />
    </div>
  );
}
