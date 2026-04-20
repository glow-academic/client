"use client";

import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  GenericForm,
  type StepStatus,
} from "@/components/common/forms/GenericForm";
import { ReadOnlyBanner } from "@/components/common/forms/ReadOnlyBanner";
import { StepCard } from "@/components/common/forms/StepCard";
import { StepCardAiButton } from "@/components/common/forms/StepCardAiButton";
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
import type { InputOf, OutputOf } from "@/lib/api/types";
import {
  buildDraftPayload,
  checkHasResourceIds,
  type ResourceConfig,
} from "@/lib/resources/action-builders";
import type { ResourceType } from "@/lib/resources/types";
import { parseAsString, type Parser } from "nuqs";

type CreateProviderIn = InputOf<"/provider/create", "post">;
type CreateProviderOut = OutputOf<"/provider/create", "post">;
type UpdateProviderIn = InputOf<"/provider/update", "post">;
type UpdateProviderOut = OutputOf<"/provider/update", "post">;
type PatchProviderDraftIn = InputOf<"/provider/draft", "patch">;
type PatchProviderDraftOut = OutputOf<"/provider/draft", "patch">;
type ProviderData = OutputOf<"/provider/get", "post">;

type ProviderFormState = {
  name_id: string | null;
  name: string | null;
  description_id: string | null;
  description: string | null;
  active_flag_id: string | null;
  department_ids: string[];
  value_id: string | null;
  value: string | null;
  endpoint_id: string | null;
  endpoint: string | null;
  key_id: string | null;
  pending_ids: string[];
};

const PROVIDER_RESOURCES: ResourceConfig[] = [
  { key: "names", formKey: "name_id", flushKey: null, type: "single" },
  { key: "descriptions", formKey: "description_id", flushKey: null, type: "single" },
  { key: "flags", formKey: "active_flag_id", flushKey: null, type: "single" },
  { key: "departments", formKey: "department_ids", flushKey: null, type: "multi" },
  { key: "values", formKey: "value_id", flushKey: null, type: "single" },
  { key: "endpoints", formKey: "endpoint_id", flushKey: null, type: "single" },
  { key: "keys", formKey: "key_id", flushKey: null, type: "single" },
];

const VALID_RESOURCE_TYPES: ResourceType[] = [
  "names",
  "descriptions",
  "flags",
  "departments",
  "values",
  "endpoints",
  "keys",
];

export interface ProviderProps {
  providerId?: string;
  providerData?: ProviderData;
  createProviderAction?: (input: CreateProviderIn) => Promise<CreateProviderOut>;
  updateProviderAction?: (input: UpdateProviderIn) => Promise<UpdateProviderOut>;
  patchProviderDraftAction?: (
    input: PatchProviderDraftIn
  ) => Promise<PatchProviderDraftOut>;
}

export default function Provider({
  providerId,
  providerData,
  createProviderAction,
  updateProviderAction,
  patchProviderDraftAction,
}: ProviderProps) {
  const router = useRouter();
  const isEditMode = !!providerId;
  const { isAutosaveEnabled, setSelectedDraftId } = useDrafts();
  const emptyFlushRegistryRef = useRef<
    Map<string, () => Promise<Record<string, unknown> | void>>
  >(new Map());
  const s = providerData as (ProviderData & Record<string, any>) | undefined;

  const getInitialFormState = useCallback((): ProviderFormState => {
    const selectedName = s?.names?.find((item: any) => item.selected) ?? null;
    const selectedDescription =
      s?.descriptions?.find((item: any) => item.selected) ?? null;
    const selectedFlag = s?.flags?.find((item: any) => item.selected) ?? null;
    const selectedValue = s?.values?.find((item: any) => item.selected) ?? null;
    const selectedEndpoint = s?.endpoints?.find((item: any) => item.selected) ?? null;
    const selectedKey = s?.keys?.find((item: any) => item.selected) ?? null;

    return {
      name_id: selectedName?.id ?? null,
      name: null,
      description_id: selectedDescription?.id ?? null,
      description: null,
      active_flag_id: selectedFlag?.flag_option_id ?? null,
      department_ids: (s?.departments?.filter((item: any) => item.selected) ?? [])
        .map((item: any) => item.department_id)
        .filter(Boolean),
      value_id: selectedValue?.id ?? null,
      value: null,
      endpoint_id: selectedEndpoint?.id ?? null,
      endpoint: null,
      key_id: selectedKey?.id ?? null,
      pending_ids: (s?.pending_ids ?? []) as string[],
    };
  }, [s]);

  const [formState, setFormState] = useState<ProviderFormState>(getInitialFormState);
  const referenceStateRef = useRef<ProviderFormState>(getInitialFormState());
  const formStateRef = useRef(formState);
  const serverSyncPendingRef = useRef(false);

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
    validResourceTypes: VALID_RESOURCE_TYPES as string[],
  });

  const providerSearchParamsClient = useMemo(
    () => ({ draftId: parseAsString }),
    []
  );

  const formStateKey = useMemo(() => {
    if (serverSyncPendingRef.current) {
      return JSON.stringify(referenceStateRef.current);
    }
    return JSON.stringify(formState);
  }, [formState]);

  const patchActionRef = useRef<
    | ((payload: Record<string, unknown>) => Promise<{ draft_id?: string | null }>)
    | undefined
  >(undefined);

  useEffect(() => {
    if (!patchProviderDraftAction) {
      patchActionRef.current = undefined;
      return;
    }

    patchActionRef.current = async (payload: Record<string, unknown>) => {
      const result = await patchProviderDraftAction({
        body: payload,
      } as PatchProviderDraftIn);
      const fs = (result as Record<string, unknown>)?.["form_state"] as
        | Record<string, unknown>
        | undefined;
      if (fs) {
        serverSyncPendingRef.current = true;
        setFormState((prev) => ({
          ...prev,
          name_id: (fs["name_id"] as string | null) ?? null,
          name: (fs["name"] as string | null) ?? null,
          description_id: (fs["description_id"] as string | null) ?? null,
          description: (fs["description"] as string | null) ?? null,
          active_flag_id:
            ((fs["active_flag_id"] as string | null) ??
              (fs["flag_id"] as string | null)) ??
            null,
          department_ids: (fs["department_ids"] as string[] | null) ?? [],
          value_id: (fs["value_id"] as string | null) ?? null,
          value: (fs["value"] as string | null) ?? null,
          endpoint_id:
            ((fs["endpoint_id"] as string | null) ??
              ((fs["endpoint_ids"] as string[] | null)?.[0] ?? null)) ??
            null,
          endpoint: (fs["endpoint"] as string | null) ?? null,
          key_id:
            ((fs["key_id"] as string | null) ??
              ((fs["key_ids"] as string[] | null)?.[0] ?? null)) ??
            null,
          pending_ids: (fs["pending_ids"] as string[] | null) ?? [],
        }));
        requestAnimationFrame(() => {
          serverSyncPendingRef.current = false;
        });
      }
      return result;
    };
  }, [patchProviderDraftAction]);

  const buildPatchPayload = useCallback(
    (draftId: string | null) => {
      const currentFormState = formStateRef.current;
      const payload: Record<string, unknown> = {
        draft_id: draftId,
        input_draft_id: draftId,
        ...buildDraftPayload(PROVIDER_RESOURCES, {
          formState: currentFormState as unknown as Record<string, unknown>,
          referenceState: referenceStateRef.current as unknown as Record<string, unknown>,
          flushResults: {},
        }),
      };

      if (currentFormState["name"] && !currentFormState["name_id"]) {
        payload["name"] = currentFormState["name"];
        delete payload["name_id"];
      }
      if (currentFormState["description"] && !currentFormState["description_id"]) {
        payload["description"] = currentFormState["description"];
        delete payload["description_id"];
      }
      if (currentFormState["value"] && !currentFormState["value_id"]) {
        payload["value"] = currentFormState["value"];
        delete payload["value_id"];
      }
      if (currentFormState["endpoint"] && !currentFormState["endpoint_id"]) {
        payload["endpoint"] = currentFormState["endpoint"];
        delete payload["endpoint_id"];
      }
      payload["pending_ids"] = currentFormState["pending_ids"];

      return payload;
    },
    []
  );

  const hasResourceIds =
    checkHasResourceIds(
      PROVIDER_RESOURCES,
      formState as unknown as Record<string, unknown>
    ) ||
    !!formState.name ||
    !!formState.description ||
    !!formState.value ||
    !!formState.endpoint ||
    formState.pending_ids.length > 0;

  const {
    setUrlFormDataRef,
    onFormDataChange,
    flushAllAndSave,
    formDataRef,
  } = useDraftLifecycle({
    formStateKey,
    patchActionRef,
    isAutosaveEnabled,
    buildPatchPayload,
    setSelectedDraftId,
    hasResourceIds,
    flushRegistryRef: emptyFlushRegistryRef,
    formStateRef: formStateRef as React.MutableRefObject<Record<string, unknown>>,
  });

  const handleGenerateResources = useCallback(
    async (resourceTypes: ResourceType[]) => {
      let currentDraftId =
        (formDataRef.current["draftId"] as string | undefined) ?? null;
      if (!currentDraftId) currentDraftId = await flushAllAndSave();
      if (!currentDraftId) {
        toast.error("Please save a draft before generating");
        return;
      }
      generate(resourceTypes, {
        draft_id: currentDraftId,
        artifact_id: providerId ?? null,
      });
    },
    [flushAllAndSave, formDataRef, generate, providerId]
  );

  const stepResources: Record<string, ResourceType[]> = useMemo(
    () => ({
      basic: ["names", "descriptions", "flags", "departments"],
      integrations: ["values", "endpoints", "keys"],
      all: ["names", "descriptions", "flags", "departments", "values", "endpoints", "keys"],
    }),
    []
  );

  const canRegenerate = useCallback(
    (resourceType: ResourceType) => {
      if (!s) return false;
      if (resourceType === "names") {
        return s.names?.find((item: any) => item.selected)?.generated ?? false;
      }
      if (resourceType === "descriptions") {
        return (
          s.descriptions?.find((item: any) => item.selected)?.generated ?? false
        );
      }
      if (resourceType === "flags") {
        return s.flags?.some((item: any) => item.selected && item.generated) ?? false;
      }
      if (resourceType === "departments") {
        return (
          s.departments?.some((item: any) => item.selected && item.generated) ?? false
        );
      }
      if (resourceType === "values") {
        return s.values?.find((item: any) => item.selected)?.generated ?? false;
      }
      if (resourceType === "endpoints") {
        return s.endpoints?.find((item: any) => item.selected)?.generated ?? false;
      }
      if (resourceType === "keys") {
        return s.keys?.find((item: any) => item.selected)?.generated ?? false;
      }
      return false;
    },
    [s]
  );

  const handleSubmit = useCallback(async () => {
    const hasRawFields =
      !!formStateRef.current.name ||
      !!formStateRef.current.description ||
      !!formStateRef.current.value ||
      !!formStateRef.current.endpoint;

    if (hasRawFields) {
      await flushAllAndSave();
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    }

    const effectiveState = formStateRef.current;
    if (!effectiveState.name_id) {
      throw new Error("Name is required");
    }
    if (!effectiveState.value_id) {
      throw new Error("Value is required");
    }

    if (isEditMode && providerId && updateProviderAction) {
      await updateProviderAction({
        body: {
          providers: [
            {
              provider_id: providerId,
              name_id: effectiveState.name_id,
              description_id: effectiveState.description_id,
              active_flag_id: effectiveState.active_flag_id,
              department_ids:
                effectiveState.department_ids.length > 0
                  ? effectiveState.department_ids
                  : null,
              endpoint_ids: effectiveState.endpoint_id
                ? [effectiveState.endpoint_id]
                : null,
              key_ids: effectiveState.key_id ? [effectiveState.key_id] : null,
              value_id: effectiveState.value_id,
            },
          ],
        },
      } as UpdateProviderIn);
    } else if (createProviderAction) {
      await createProviderAction({
        body: {
          providers: [
            {
              name_id: effectiveState.name_id,
              description_id: effectiveState.description_id,
              active_flag_id: effectiveState.active_flag_id,
              department_ids:
                effectiveState.department_ids.length > 0
                  ? effectiveState.department_ids
                  : null,
              endpoint_ids: effectiveState.endpoint_id
                ? [effectiveState.endpoint_id]
                : null,
              key_ids: effectiveState.key_id ? [effectiveState.key_id] : null,
              value_id: effectiveState.value_id,
            },
          ],
        },
      } as CreateProviderIn);
    } else {
      throw new Error("Save action not available");
    }

    toast.success(isEditMode ? "Provider updated" : "Provider created");
    router.push("/intelligence/providers");
    router.refresh();
  }, [
    createProviderAction,
    flushAllAndSave,
    isEditMode,
    providerId,
    router,
    updateProviderAction,
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
      if (stepId === "basic") {
        return formState.name_id || formState.name ? "completed" : "active";
      }
      if (stepId === "integrations") {
        return formState.value_id || formState.value ? "completed" : "pending";
      }
      return "pending";
    },
    [formState.name, formState.name_id, formState.value, formState.value_id]
  );

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
                resourceTypes={stepResources["basic"] ?? []}
                canRegenerate={canRegenerate as (rt: string) => boolean}
                isGenerating={isGenerating as (rt: string) => boolean}
                onOpenModal={(id) => {
                  const resources = stepResources[id];
                  if (resources) {
                    void handleGenerateResources(resources);
                  }
                }}
                disabled={disabled || !s?.basic_show_ai_generate}
              />
            }
          >
            <Names
              name_id={formState.name_id}
              name_resource={s?.names?.find((item: any) => item.selected) ?? null}
              show_name={true}
              names={s?.names ?? []}
              disabled={disabled}
              onNameIdChange={(id) =>
                setFormState((prev) => ({
                  ...prev,
                  name_id: id,
                  name: null,
                  pending_ids: prev.pending_ids.filter((pendingId) => pendingId !== prev.name_id),
                }))
              }
              onNameChange={(name) =>
                setFormState((prev) => ({
                  ...prev,
                  name_id: null,
                  name,
                }))
              }
              defaultName="New Provider"
              hideDescription={true}
              required={true}
            />
            <Descriptions
              description_id={formState.description_id}
              description_resource={
                s?.descriptions?.find((item: any) => item.selected) ?? null
              }
              show_description={true}
              descriptions={s?.descriptions ?? []}
              disabled={disabled}
              onDescriptionIdChange={(id) =>
                setFormState((prev) => ({
                  ...prev,
                  description_id: id,
                  description: null,
                }))
              }
              onDescriptionChange={(description) =>
                setFormState((prev) => ({
                  ...prev,
                  description_id: null,
                  description,
                }))
              }
              required={false}
            />
            <Flags
              mode="single"
              flag_id={formState.active_flag_id}
              show_flags={true}
              flags={s?.flags ?? []}
              disabled={disabled}
              onChange={(id) =>
                setFormState((prev) => ({ ...prev, active_flag_id: id }))
              }
            />
            <Departments
              department_ids={formState.department_ids}
              department_resources={s?.departments?.filter((item: any) => item.selected) ?? []}
              show_departments={true}
              departments={s?.departments ?? []}
              disabled={disabled}
              onChange={(ids) =>
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
                resourceTypes={stepResources["integrations"] ?? []}
              canRegenerate={canRegenerate as (rt: string) => boolean}
              isGenerating={isGenerating as (rt: string) => boolean}
              onOpenModal={(id) => {
                const resources = stepResources[id];
                if (resources) {
                  void handleGenerateResources(resources);
                }
              }}
              disabled={disabled || !s?.integrations_show_ai_generate}
            />
          }
        >
          <Values
            value_ids={formState.value_id ? [formState.value_id] : []}
            value_resources={s?.values?.filter((item: any) => item.selected) ?? []}
            values={s?.values ?? []}
            value={formState.value}
            onValueChange={(value) =>
              setFormState((prev) => ({
                ...prev,
                value_id: value ? null : prev.value_id,
                value,
              }))
            }
            show_values={true}
            disabled={disabled}
            required={true}
            onChange={(ids) =>
              setFormState((prev) => ({
                ...prev,
                value_id: ids[0] ?? null,
                value: null,
              }))
            }
          />
          <Endpoints
            endpoint_ids={formState.endpoint_id ? [formState.endpoint_id] : []}
            endpoint_resources={s?.endpoints?.filter((item: any) => item.selected) ?? []}
            endpoints={s?.endpoints ?? []}
            endpoint={formState.endpoint}
            onEndpointChange={(endpoint) =>
              setFormState((prev) => ({
                ...prev,
                endpoint_id: endpoint ? null : prev.endpoint_id,
                endpoint,
              }))
            }
            show_endpoints={true}
            disabled={disabled}
            onChange={(ids) =>
              setFormState((prev) => ({
                ...prev,
                endpoint_id: ids[0] ?? null,
                endpoint: null,
              }))
            }
          />
          <Keys
            key_id={formState.key_id}
            key_resource={s?.keys?.find((item: any) => item.selected) ?? null}
            keys={
              (s?.keys ?? []).map((item: any) => ({
                id: item.id,
                name: item.name,
                description: item.description,
                key_masked: item.key,
                active: true,
                generated: item.generated,
              }))
            }
            show_key={true}
            disabled={disabled}
            onKeyIdChange={(id) =>
              setFormState((prev) => ({ ...prev, key_id: id }))
            }
          />
        </StepCard>
      );
    },
    [
      canRegenerate,
      disabled,
      formState.active_flag_id,
      formState.department_ids,
      formState.description_id,
      formState.endpoint,
      formState.endpoint_id,
      formState.key_id,
      formState.name_id,
      formState.pending_ids,
      formState.value,
      formState.value_id,
      handleGenerateResources,
      isGenerating,
      s,
      stepResources,
    ]
  );

  return (
    <div className="w-full space-y-8 p-6">
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
