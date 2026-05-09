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
import { useProviderAi } from "@/hooks/use-provider-ai";
import { useDraftLifecycle } from "@/hooks/use-draft-lifecycle";
import type { InputOf, OutputOf } from "@/lib/api/types";
import {
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
type DecryptProviderIn = InputOf<"/provider/decrypt", "post">;
type DecryptProviderOut = OutputOf<"/provider/decrypt", "post">;
type ProviderData = OutputOf<"/provider/get", "post">;

type ProviderFormState = {
  name_id: string | null;
  name: string | null;
  description_id: string | null;
  description: string | null;
  flag_ids: string[];
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
  { key: "flags", formKey: "flag_ids", flushKey: null, type: "multi" },
  { key: "departments", formKey: "department_ids", flushKey: null, type: "multi" },
  { key: "values", formKey: "value_id", flushKey: null, type: "single" },
  { key: "endpoints", formKey: "endpoint_id", flushKey: null, type: "single" },
  { key: "keys", formKey: "key_id", flushKey: null, type: "single" },
];

export interface ProviderProps {
  providerId?: string;
  providerData?: ProviderData;
  createProviderAction?: (input: CreateProviderIn) => Promise<CreateProviderOut>;
  updateProviderAction?: (input: UpdateProviderIn) => Promise<UpdateProviderOut>;
  patchProviderDraftAction?: (
    input: PatchProviderDraftIn
  ) => Promise<PatchProviderDraftOut>;
  decryptProviderKeyAction?: (
    input: DecryptProviderIn
  ) => Promise<DecryptProviderOut>;
}

export default function Provider({
  providerId,
  providerData,
  createProviderAction,
  updateProviderAction,
  patchProviderDraftAction,
  decryptProviderKeyAction,
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
    const selectedValue = s?.values?.find((item: any) => item.selected) ?? null;
    const selectedEndpoint = s?.endpoints?.find((item: any) => item.selected) ?? null;
    const selectedKey = s?.keys?.find((item: any) => item.selected) ?? null;

    return {
      name_id: selectedName?.id ?? null,
      name: null,
      description_id: selectedDescription?.id ?? null,
      description: null,
      flag_ids: (s?.flags?.filter((item: any) => item.selected) ?? [])
        .map((item: any) => item.id)
        .filter((id: unknown): id is string => !!id),
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
  const formStateRef = useRef(formState);

  useEffect(() => {
    formStateRef.current = formState;
  }, [formState]);

  useEffect(() => {
    const initial = getInitialFormState();
    setFormState(initial);
  }, [getInitialFormState]);

  const { isGenerating, generate } = useProviderAi({});

  const providerSearchParamsClient = useMemo(
    () => ({ draftId: parseAsString }),
    []
  );

  const formStateKey = useMemo(() => JSON.stringify(formState), [formState]);

  const patchActionRef = useRef<
    | ((payload: Record<string, unknown>) => Promise<{ draft_id?: string | null }>)
    | undefined
  >(undefined);

  const buildPatchPayload = useCallback((): Record<string, unknown> => {
    const current = formStateRef.current as unknown as ProviderFormState;
    const payload: Record<string, unknown> = {};

    if (current.name != null) payload["name"] = current.name;
    else if (current.name_id) payload["name_id"] = current.name_id;

    if (current.description != null) payload["description"] = current.description;
    else if (current.description_id) payload["description_id"] = current.description_id;

    if (current.value != null) payload["value"] = current.value;
    else if (current.value_id) payload["value_id"] = current.value_id;

    if (current.endpoint != null) payload["endpoint"] = current.endpoint;
    else if (current.endpoint_id) payload["endpoint_id"] = current.endpoint_id;

    if (current.key_id) payload["key_id"] = current.key_id;

    if (current.flag_ids.length > 0) payload["flag_ids"] = current.flag_ids;
    if (current.department_ids.length > 0) payload["department_ids"] = current.department_ids;

    if (current.pending_ids.length > 0) payload["pending_ids"] = current.pending_ids;

    return payload;
  }, []);

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

  // Per-type boolean view of flag_ids, built from the catalog. Rendered by Flags.
  const flagValues = useMemo<Record<string, boolean | null>>(() => {
    const map: Record<string, boolean | null> = {};
    const byId = new Map(
      (s?.flags ?? [])
        .filter((f: any) => f.id)
        .map((f: any) => [f.id as string, f])
    );
    for (const id of formState.flag_ids) {
      const row = byId.get(id) as any;
      if (!row) continue;
      const type = row.type ?? row.name;
      if (type && row.value != null) map[type] = row.value;
    }
    return map;
  }, [formState.flag_ids, s?.flags]);

  type ProviderFlagRow = { id?: string | null; type?: string | null; name?: string | null; value?: boolean | null };
  const flagRowsByType = useMemo(() => {
    const map = new Map<string, ProviderFlagRow[]>();
    for (const f of (s?.flags ?? []) as ProviderFlagRow[]) {
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
        return {
          ...prev,
          flag_ids: nextIds,
        };
      });
    },
    [flagRowsByType]
  );

  // --- Stable value-change handlers (extracted from inline arrows) ---
  const handleNameIdChange = useCallback((id: string | null) => {
    setFormState((prev) => ({
      ...prev,
      name_id: id,
      name: null,
    }));
  }, []);

  const handleNameChange = useCallback((name: string) => {
    setFormState((prev) => ({
      ...prev,
      name_id: null,
      name,
    }));
  }, []);

  const handleDescriptionIdChange = useCallback((id: string | null) => {
    setFormState((prev) => ({
      ...prev,
      description_id: id,
      description: null,
    }));
  }, []);

  // Canonical decrypt callback for the Keys picker. Mirrors the Setting
  // page pattern: hits `POST /provider/decrypt`, which is audited via
  // run_artifact_operation_with_audit. Returns plaintext or null.
  const decryptKey = useCallback(
    async (key_id: string): Promise<string | null> => {
      if (!decryptProviderKeyAction || !providerId) return null;
      try {
        const result = await decryptProviderKeyAction({
          body: { provider_id: providerId, key_id },
        } as DecryptProviderIn);
        const decrypted = (result as DecryptProviderOut & { key?: string | null })
          .key;
        return decrypted ?? null;
      } catch (err) {
        console.error("provider decrypt failed", err);
        return null;
      }
    },
    [decryptProviderKeyAction, providerId],
  );

  const handleDescriptionChange = useCallback((description: string) => {
    setFormState((prev) => ({
      ...prev,
      description_id: null,
      description,
    }));
  }, []);

  // ─── Per-field pending lifecycle ──────────────────────────────────
  // Mirrors persona — see Persona.tsx for full rationale. ``formStateKey``
  // already includes ``pending_ids`` so changes here trigger autosave.
  type SingleField = "name_id" | "description_id";
  type MultiField = "flag_ids" | "department_ids";

  const handleAcceptPendingField = useCallback(
    (field: SingleField, pendingId: string) => {
      setFormState((prev) => ({
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
      setFormState((prev) => ({
        ...prev,
        [field]: prev[field] === pendingId ? null : prev[field],
        pending_ids: prev.pending_ids.filter((id) => id !== pendingId),
      }));
    },
    [],
  );

  const handleAcceptPendingMulti = useCallback(
    (field: MultiField, pendingIds: string[]) => {
      const removeSet = new Set(pendingIds);
      setFormState((prev) => ({
        ...prev,
        pending_ids: prev.pending_ids.filter((id) => !removeSet.has(id)),
      }));
    },
    [],
  );

  const handleRejectPendingMulti = useCallback(
    (field: MultiField, pendingIds: string[]) => {
      const removeSet = new Set(pendingIds);
      setFormState((prev) => ({
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
    formStateKey,
    patchActionRef,
    isAutosaveEnabled,
    buildPatchPayload,
    setSelectedDraftId,
    hasResourceIds,
    flushRegistryRef: emptyFlushRegistryRef,
    formStateRef: formStateRef as React.MutableRefObject<Record<string, unknown>>,
  });

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
        setFormState((prev) => {
          const nextNameId = (fs["name_id"] as string | null) ?? prev.name_id;
          const nextDescriptionId = (fs["description_id"] as string | null) ?? prev.description_id;
          const nextValueId = (fs["value_id"] as string | null) ?? prev.value_id;
          const nextEndpointId =
            (fs["endpoint_id"] as string | null) ??
            (fs["endpoint_ids"] as string[] | null)?.[0] ??
            prev.endpoint_id;
          const nextKeyId =
            (fs["key_id"] as string | null) ??
            (fs["key_ids"] as string[] | null)?.[0] ??
            prev.key_id;
          const next: ProviderFormState = {
            ...prev,
            name_id: nextNameId,
            name: nextNameId ? null : prev.name,
            description_id: nextDescriptionId,
            description: nextDescriptionId ? null : prev.description,
            flag_ids: (fs["flag_ids"] as string[] | null) ?? prev.flag_ids,
            department_ids: (fs["department_ids"] as string[] | null) ?? prev.department_ids,
            value_id: nextValueId,
            value: nextValueId ? null : prev.value,
            endpoint_id: nextEndpointId,
            endpoint: nextEndpointId ? null : prev.endpoint,
            key_id: nextKeyId,
            pending_ids: (fs["pending_ids"] as string[] | null) ?? prev.pending_ids,
          };
          const changed =
            prev.name_id !== next.name_id ||
            prev.name !== next.name ||
            prev.description_id !== next.description_id ||
            prev.description !== next.description ||
            prev.value_id !== next.value_id ||
            prev.value !== next.value ||
            prev.endpoint_id !== next.endpoint_id ||
            prev.endpoint !== next.endpoint ||
            prev.key_id !== next.key_id ||
            JSON.stringify(prev.flag_ids) !== JSON.stringify(next.flag_ids) ||
            JSON.stringify(prev.department_ids) !== JSON.stringify(next.department_ids) ||
            JSON.stringify(prev.pending_ids) !== JSON.stringify(next.pending_ids);
          if (!changed) return prev;
          serverSyncPendingRef.current = true;
          return next;
        });
      }
      return result;
    };
  }, [patchProviderDraftAction, serverSyncPendingRef]);

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
      basic: ["names", "descriptions", "values", "flags", "departments"],
      endpoint: ["endpoints"],
      key: ["keys"],
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
              id: providerId,
              name_id: effectiveState.name_id,
              description_id: effectiveState.description_id,
              flag_ids: effectiveState.flag_ids.length > 0
                ? effectiveState.flag_ids
                : null,
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
              flag_ids: effectiveState.flag_ids.length > 0
                ? effectiveState.flag_ids
                : null,
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

  const handleReset = useCallback((stepId: string) => {
    setFormState((prev) => {
      switch (stepId) {
        case "basic":
          return {
            ...prev,
            name_id: null,
            name: null,
            value_id: null,
            value: null,
            description_id: null,
            description: null,
            flag_ids: [],
            department_ids: [],
          };
        case "endpoint":
          return {
            ...prev,
            endpoint_id: null,
            endpoint: null,
          };
        case "key":
          return {
            ...prev,
            key_id: null,
          };
        default:
          return prev;
      }
    });
  }, []);

  const steps = useMemo(
    () => [
      {
        id: "basic",
        title: "Basic",
        description: "Name, value, description, status, and departments",
        resetFields: [
          "name_id",
          "value_id",
          "description_id",
          "flag_ids",
          "department_ids",
        ],
      },
      {
        id: "endpoint",
        title: "Endpoint",
        description: "API endpoint URL for this provider",
        resetFields: ["endpoint_id"],
      },
      {
        id: "key",
        title: "Key",
        description: "API key used to authenticate requests",
        resetFields: ["key_id"],
      },
    ],
    []
  );

  const getStepStatus = useCallback(
    (stepId: string): StepStatus => {
      const hasName = !!(formState.name_id || formState.name);
      switch (stepId) {
        case "basic":
          return hasName ? "completed" : "active";
        case "endpoint":
          if (!hasName) return "pending";
          return formState.endpoint_id || formState.endpoint
            ? "completed"
            : "active";
        case "key":
          if (!hasName) return "pending";
          return formState.key_id ? "completed" : "active";
        default:
          return "pending";
      }
    },
    [
      formState.name,
      formState.name_id,
      formState.endpoint,
      formState.endpoint_id,
      formState.key_id,
    ]
  );

  const renderStep = useCallback(
    ({
      stepId,
      stepTitle,
      stepDescription,
      stepNumber,
      stepStatus,
      onReset,
    }: {
      stepId: string;
      stepTitle: string;
      stepDescription: string;
      stepNumber: number;
      stepStatus: StepStatus;
      isOptional: boolean;
      onReset?: () => void;
    }) => {
      switch (stepId) {
        case "basic":
          return (
            <StepCard
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              stepNumber={stepNumber}
              stepStatus={stepStatus}
              isReadonly={disabled}
              isEditMode={isEditMode}
              customHeader={
                <Names
                  name_id={formState.name_id}
                  name_resource={s?.names?.find((item: any) => item.selected) ?? null}
                  show_name={true}
                  names={s?.names ?? []}
                  disabled={disabled}
                  onNameIdChange={handleNameIdChange}
                  onNameChange={handleNameChange}
                  onAcceptPending={(pendingId) =>
                    handleAcceptPendingField("name_id", pendingId)
                  }
                  onRejectPending={(pendingId) =>
                    handleRejectPendingField("name_id", pendingId)
                  }
                  placeholder="e.g., OpenAI"
                  defaultName="New Provider"
                  hideDescription={true}
                  required={true}
                />
              }
              resetFields={[
                "name_id",
                "value_id",
                "description_id",
                "flag_ids",
                "department_ids",
              ]}
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
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              {/* Value lives at the top of basic info, mirroring Model.tsx — it
                  identifies the provider variant and naturally pairs with the
                  name in the header. */}
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
              <Descriptions
                description_id={formState.description_id}
                description_resource={
                  s?.descriptions?.find((item: any) => item.selected) ?? null
                }
                show_description={true}
                descriptions={s?.descriptions ?? []}
                disabled={disabled}
                onDescriptionIdChange={handleDescriptionIdChange}
                onDescriptionChange={handleDescriptionChange}
                onAcceptPending={(pendingId) =>
                  handleAcceptPendingField("description_id", pendingId)
                }
                onRejectPending={(pendingId) =>
                  handleRejectPendingField("description_id", pendingId)
                }
                required={false}
              />
              <Flags
                flags={s?.flags ?? []}
                values={flagValues}
                columns={1}
                label="Flags"
                disabled={disabled}
                show_flags={true}
                onChange={handleFlagToggle}
                onAcceptPending={(pendingIds) =>
                  handleAcceptPendingMulti("flag_ids", pendingIds)
                }
                onRejectPending={(pendingIds) =>
                  handleRejectPendingMulti("flag_ids", pendingIds)
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
                onAcceptPending={(pendingIds) =>
                  handleAcceptPendingMulti("department_ids", pendingIds)
                }
                onRejectPending={(pendingIds) =>
                  handleRejectPendingMulti("department_ids", pendingIds)
                }
              />
            </StepCard>
          );

        case "endpoint":
          return (
            <StepCard
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              stepNumber={stepNumber}
              stepStatus={stepStatus}
              isReadonly={disabled}
              isEditMode={isEditMode}
              resetFields={["endpoint_id"]}
              actions={
                <StepCardAiButton
                  stepId="endpoint"
                  resourceTypes={stepResources["endpoint"] ?? []}
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
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
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
            </StepCard>
          );

        case "key":
          return (
            <StepCard
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              stepNumber={stepNumber}
              stepStatus={stepStatus}
              isReadonly={disabled}
              isEditMode={isEditMode}
              resetFields={["key_id"]}
              actions={
                <StepCardAiButton
                  stepId="key"
                  resourceTypes={stepResources["key"] ?? []}
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
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
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
                onReveal={decryptKey}
              />
            </StepCard>
          );

        default:
          return null;
      }
    },
    [
      canRegenerate,
      disabled,
      formState.flag_ids,
      flagValues,
      handleFlagToggle,
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
      decryptKey,
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
        onReset={handleReset}
        onFormDataChange={onFormDataChange}
        registerSetFormData={(setter) => {
          setUrlFormDataRef.current = setter;
        }}
      />
    </div>
  );
}
