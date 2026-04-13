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
import { ReadOnlyBanner } from "@/components/common/forms/ReadOnlyBanner";
import { Departments } from "@/components/resources/Departments";
import { Descriptions } from "@/components/resources/Descriptions";
import { Endpoints } from "@/components/resources/Endpoints";
import { Flags } from "@/components/resources/Flags";
import { Keys } from "@/components/resources/Keys";
import { Names } from "@/components/resources/Names";
import { Values } from "@/components/resources/Values";
import { useDrafts } from "@/contexts/draft-context";
import { useArtifactAi } from "@/hooks/use-artifact-ai";
import { useDraftLifecycle } from "@/hooks/use-draft-lifecycle";
import { useFlushRegistry } from "@/hooks/use-flush-registry";
import type { InputOf, OutputOf } from "@/lib/api/types";
import {
  buildDraftPayload,
  checkHasResourceIds,
  computeEffectiveFormState,
  type ResourceConfig,
} from "@/lib/resources/action-builders";
import type { ResourceType } from "@/lib/resources/types";
import type { Parser } from "nuqs";
import { parseAsString } from "nuqs";

type CreateProviderIn = InputOf<"/providers/create", "post">;
type CreateProviderOut = OutputOf<"/providers/create", "post">;
type UpdateProviderIn = InputOf<"/providers/update", "post">;
type UpdateProviderOut = OutputOf<"/providers/update", "post">;
type PatchProviderDraftIn = InputOf<"/providers/draft", "patch">;
type PatchProviderDraftOut = OutputOf<
  "/providers/draft",
  "patch"
>;
type CreateDraftNamesIn = InputOf<"/api/v5/resources/names", "post">;
type CreateDraftNamesOut = OutputOf<"/api/v5/resources/names", "post">;
type CreateDraftDescriptionsIn = InputOf<
  "/api/v5/resources/descriptions",
  "post"
>;
type CreateDraftDescriptionsOut = OutputOf<
  "/api/v5/resources/descriptions",
  "post"
>;
type CreateDraftValuesIn = InputOf<"/api/v5/resources/values", "post">;
type CreateDraftValuesOut = OutputOf<"/api/v5/resources/values", "post">;
type CreateDraftEndpointsIn = InputOf<"/api/v5/resources/endpoints", "post">;
type CreateDraftEndpointsOut = OutputOf<"/api/v5/resources/endpoints", "post">;
type ProviderData = OutputOf<"/providers/get", "post">;

type ProviderFormState = {
  name: string | null;
  name_id: string | null;
  description: string | null;
  description_id: string | null;
  active_flag_id: string | null;
  department_ids: string[];
  value_id: string | null;
  endpoint_id: string | null;
  key_id: string | null;
};

const FLUSH_KEYS = ["names", "descriptions", "values", "endpoints"] as const;
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
  { key: "endpoints", formKey: "endpoint_id", flushKey: "endpoint_id", type: "single" },
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
  createProviderAction?: (input: CreateProviderIn) => Promise<CreateProviderOut>;
  updateProviderAction?: (input: UpdateProviderIn) => Promise<UpdateProviderOut>;
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
  createEndpointsAction?: (
    input: CreateDraftEndpointsIn
  ) => Promise<CreateDraftEndpointsOut>;
}

export default function Provider({
  providerId,
  providerData,
  createProviderAction,
  updateProviderAction,
  patchProviderDraftAction,
  createNamesAction,
  createDescriptionsAction,
  createValuesAction,
  createEndpointsAction,
}: ProviderProps) {
  const isEditMode = !!providerId;
  const router = useRouter();
  const { isAutosaveEnabled, setSelectedDraftId } = useDrafts();
  const { flushRegistryRef, registerFlushCallbacks, flushAllResources } =
    useFlushRegistry<Record<string, unknown>>(FLUSH_KEYS);

  const s = providerData;

  const getInitialFormState = useCallback((): ProviderFormState => {
    if (!s) {
      return {
        name: null,
        name_id: null,
        description: null,
        description_id: null,
        active_flag_id: null,
        department_ids: [],
        value_id: null,
        endpoint_id: null,
        key_id: null,
      };
    }
    return {
      name: null,
      name_id: (s.names?.resource?.id as string) ?? null,
      description: null,
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

  const { isGenerating, generate } = useArtifactAi({
    artifactType: "provider",
    validResourceTypes: PROVIDER_RESOURCES as string[],
  });

  const providerSearchParamsClient = useMemo(
    () => ({ draftId: parseAsString }),
    []
  );
  const serverSyncPendingRef = React.useRef(false);

  const formStateKey = useMemo(() => {
    if (serverSyncPendingRef.current) return undefined;
    return JSON.stringify(formState);
  }, [formState]);

  const patchActionRef = React.useRef<
    | ((
        payload: Record<string, unknown>
      ) => Promise<{ draft_id?: string | null }>)
    | undefined
  >(undefined);
  useEffect(() => {
    if (patchProviderDraftAction) {
      patchActionRef.current = async (payload: Record<string, unknown>) => {
        const res = await patchProviderDraftAction({ body: payload } as PatchProviderDraftIn);
        const fs = (res as Record<string, unknown>)?.form_state as Record<string, unknown> | undefined;
        if (fs) {
          serverSyncPendingRef.current = true;
          setFormState((prev) => ({
            ...prev,
            name_id: (fs.name_id as string) ?? prev.name_id,
            name: fs.name_id ? null : prev.name,
            description_id: (fs.description_id as string) ?? prev.description_id,
            description: fs.description_id ? null : prev.description,
          }));
          requestAnimationFrame(() => {
            serverSyncPendingRef.current = false;
          });
        }
        return res;
      };
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
        flushResults?: Record<string, unknown>
      ) => {
        const payload: Record<string, unknown> = {
          input_draft_id: inputDraftId,
          ...buildDraftPayload(PROVIDER_RESOURCE_CONFIG, {
            formState: computeEffectiveFormState(
              PROVIDER_RESOURCE_CONFIG,
              formStateRef.current as unknown as Record<string, unknown>,
              flushResults ?? {}
            ),
            referenceState: referenceStateRef.current as unknown as Record<
              string,
              unknown
            >,
            flushResults: flushResults ?? {},
          }),
        };

        // Value field overlay: send raw value instead of ID when set
        const currentFs = formStateRef.current;
        if (currentFs.name) {
          payload.name = currentFs.name;
          delete payload.name_id;
        }
        if (currentFs.description) {
          payload.description = currentFs.description;
          delete payload.description_id;
        }

        return payload;
      },
      setSelectedDraftId,
      hasResourceIds,
      flushRegistryRef,
      formStateRef: formStateRef as React.MutableRefObject<Record<string, unknown>>,
    });

  const handleGenerateResources = useCallback(
    async (resourceTypes: ResourceType[], userInstructions?: string) => {
      let currentDraftId =
        (formDataRef.current["draftId"] as string | undefined) ?? null;
      if (!currentDraftId) currentDraftId = await flushAllAndSave();
      if (!currentDraftId) {
        toast.error("Please save a draft before generating");
        return;
      }
      generate(resourceTypes, {
        user_instructions: userInstructions ? [userInstructions] : null,
        draft_id: currentDraftId,
        artifact_id: providerId ?? null,
      });
    },
    [
      generate,
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

  const handleDirectStepGenerate = useCallback(
    (stepId: string, _mode: "generate" | "regenerate") => {
      const resources = stepResources[stepId];
      if (resources) {
        handleGenerateResources(resources);
      }
    },
    [stepResources, handleGenerateResources],
  );

  const handleSubmit = useCallback(async () => {
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

    const flagId = (effectiveState["active_flag_id"] as string) ?? null;
    const deptIds = (effectiveState["department_ids"] as string[])?.length
      ? (effectiveState["department_ids"] as string[])
      : null;
    const endpointId = (effectiveState["endpoint_id"] as string) ?? null;
    const keyId = (effectiveState["key_id"] as string) ?? null;

    if (isEditMode && providerId && updateProviderAction) {
      await updateProviderAction({
        body: {
          providers: [{
            provider_id: providerId,
            name_id: nameId,
            description_id: (effectiveState["description_id"] as string) ?? null,
            active_flag_id: flagId,
            value_ids: valueId ? [valueId] : null,
            endpoint_ids: endpointId ? [endpointId] : null,
            key_ids: keyId ? [keyId] : null,
            department_ids: deptIds,
          }],
        },
      });
    } else if (createProviderAction) {
      await createProviderAction({
        body: {
          providers: [{
            name_id: nameId,
            description_id: (effectiveState["description_id"] as string) ?? null,
            active_flag_id: flagId,
            value_ids: valueId ? [valueId] : null,
            endpoint_ids: endpointId ? [endpointId] : null,
            key_ids: keyId ? [keyId] : null,
            department_ids: deptIds,
          }],
        },
      });
    } else {
      toast.error("Save action not available");
      throw new Error("Save action not available");
    }
    toast.success(isEditMode ? "Provider updated" : "Provider created");
    router.push("/intelligence/providers");
    router.refresh();
  }, [
    createProviderAction,
    updateProviderAction,
    providerId,
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const NamesAny = Names as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const DescriptionsAny = Descriptions as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const FlagsAny = Flags as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const DepartmentsAny = Departments as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ValuesAny = Values as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const EndpointsAny = Endpoints as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
                onOpenModal={handleDirectStepGenerate}
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
              showAiGenerate={s?.names?.show_ai_generate}
              createNamesAction={createNamesAction}
              registerFlush={(
                registerFlushCallbacks as Record<
                  string,
                  (flush: () => Promise<Record<string, unknown> | void>) => void
                >
              )["names"]}
              isAutosaveEnabled={isAutosaveEnabled}
              onNameIdChange={(id: string | null) =>
                setFormState((prev) => ({ ...prev, name_id: id, name: null }))
              }
              onNameChange={(name: string | null) =>
                setFormState((prev) => ({ ...prev, name, name_id: null }))
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
              showAiGenerate={s?.descriptions?.show_ai_generate}
              createDescriptionsAction={createDescriptionsAction}
              registerFlush={(
                registerFlushCallbacks as Record<
                  string,
                  (flush: () => Promise<Record<string, unknown> | void>) => void
                >
              )["descriptions"]}
              isAutosaveEnabled={isAutosaveEnabled}
              onDescriptionIdChange={(id: string | null) =>
                setFormState((prev) => ({ ...prev, description_id: id, description: null }))
              }
              onDescriptionChange={(description: string | null) =>
                setFormState((prev) => ({ ...prev, description, description_id: null }))
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
              onOpenModal={handleDirectStepGenerate}
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
            showAiGenerate={s?.values?.show_ai_generate}
            createValuesAction={createValuesAction}
            registerFlush={(
              registerFlushCallbacks as Record<
                string,
                (flush: () => Promise<Record<string, unknown> | void>) => void
              >
            )["values"]}
            isAutosaveEnabled={isAutosaveEnabled}
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
            showAiGenerate={s?.endpoints?.show_ai_generate}
            createEndpointsAction={createEndpointsAction}
            registerFlush={(
              registerFlushCallbacks as Record<
                string,
                (flush: () => Promise<Record<string, unknown> | void>) => void
              >
            )["endpoints"]}
            isAutosaveEnabled={isAutosaveEnabled}
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
            // eslint-disable-next-line react-hooks/exhaustive-deps
            onKeyIdChange={(id: string | null) =>
              setFormState((prev) => ({ ...prev, key_id: id }))
            }
          />
        </StepCard>
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      s,
      formState,
      disabled,
      canRegenerate,
      isGenerating,
      handleDirectStepGenerate,
      createNamesAction,
      createDescriptionsAction,
      createValuesAction,
      createEndpointsAction,
      registerFlushCallbacks,
      isAutosaveEnabled,
      DepartmentsAny,
      DescriptionsAny,
      EndpointsAny,
      FlagsAny,
      KeysAny,
      NamesAny,
      ValuesAny,
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
    </div>
  );
}
