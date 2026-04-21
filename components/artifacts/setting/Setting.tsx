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
import { AuthItemKeys } from "@/components/resources/AuthItemKeys";
import { Auths } from "@/components/resources/Auths";
import { Colors } from "@/components/resources/Colors";
import { Departments } from "@/components/resources/Departments";
import { Descriptions } from "@/components/resources/Descriptions";
import { Flags } from "@/components/resources/Flags";
import { Names } from "@/components/resources/Names";
import { Profiles } from "@/components/resources/Profiles";
import { ProviderKeys } from "@/components/resources/ProviderKeys";
import { Systems } from "@/components/resources/Systems";
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

type CreateSettingIn = InputOf<"/setting/create", "post">;
type CreateSettingOut = OutputOf<"/setting/create", "post">;
type UpdateSettingIn = InputOf<"/setting/update", "post">;
type UpdateSettingOut = OutputOf<"/setting/update", "post">;
type PatchSettingDraftIn = InputOf<"/setting/draft", "patch">;
type PatchSettingDraftOut = OutputOf<"/setting/draft", "patch">;
type SettingData = OutputOf<"/setting/get", "post">;

type NameItem = {
  id?: string | null;
  name?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  selected?: boolean | null;
  pending?: boolean | null;
};

type DescriptionItem = {
  id?: string | null;
  description?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  selected?: boolean | null;
  pending?: boolean | null;
};

type ColorItem = {
  id?: string | null;
  name?: string | null;
  description?: string | null;
  hex_code?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  selected?: boolean | null;
  pending?: boolean | null;
};

type FlagItem = {
  key: string;
  label: string;
  description?: string | null;
  icon_id?: string | null;
  flag_option_id?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  selected?: boolean | null;
  pending?: boolean | null;
};

type DepartmentItem = {
  department_id?: string | null;
  name?: string | null;
  description?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  selected?: boolean | null;
  pending?: boolean | null;
};

type ProfileItem = {
  profile_id?: string | null;
  name?: string | null;
  description?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  selected?: boolean | null;
  pending?: boolean | null;
};

type AuthItem = {
  auth_id?: string | null;
  name?: string | null;
  description?: string | null;
  slug?: string | null;
  protocol?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  selected?: boolean | null;
  pending?: boolean | null;
};

type ProviderKeyItem = {
  id?: string | null;
  provider_id?: string | null;
  key_id?: string | null;
  key?: string | null;
  name?: string | null;
  description?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  selected?: boolean | null;
  pending?: boolean | null;
};

type AuthItemKeyItem = {
  id?: string | null;
  auth_id?: string | null;
  item_id?: string | null;
  key_id?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  selected?: boolean | null;
  pending?: boolean | null;
};

type SystemItem = {
  system_id?: string | null;
  name?: string | null;
  description?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  selected?: boolean | null;
  pending?: boolean | null;
};

type ProviderCatalogItem = {
  provider_id?: string | null;
  name?: string | null;
  description?: string | null;
};

type KeyCatalogItem = {
  key_id?: string | null;
  name?: string | null;
  description?: string | null;
  masked_key?: string | null;
};

type CanonicalSettingData = SettingData;

type SettingFormState = {
  name_id: string | null;
  name: string | null;
  description_id: string | null;
  description: string | null;
  active_flag_id: string | null;
  color_ids: string[];
  department_ids: string[];
  profile_ids: string[];
  auth_ids: string[];
  provider_key_ids: string[];
  auth_item_key_ids: string[];
  system_ids: string[];
  pending_ids: string[];
};

const SETTING_RESOURCES: ResourceConfig[] = [
  { key: "names", formKey: "name_id", flushKey: null, type: "single" },
  { key: "descriptions", formKey: "description_id", flushKey: null, type: "single" },
  { key: "flags", formKey: "active_flag_id", flushKey: null, type: "single" },
  { key: "colors", formKey: "color_ids", flushKey: null, type: "multi" },
  { key: "departments", formKey: "department_ids", flushKey: null, type: "multi" },
  { key: "profiles", formKey: "profile_ids", flushKey: null, type: "multi" },
  { key: "auths", formKey: "auth_ids", flushKey: null, type: "multi" },
  { key: "provider_keys", formKey: "provider_key_ids", flushKey: null, type: "multi" },
  { key: "auth_item_keys", formKey: "auth_item_key_ids", flushKey: null, type: "multi" },
  { key: "systems", formKey: "system_ids", flushKey: null, type: "multi" },
];

const VALID_RESOURCE_TYPES: ResourceType[] = [
  "names",
  "descriptions",
  "colors",
  "flags",
  "departments",
];

export interface SettingProps {
  settingId?: string;
  settingData?: SettingData;
  createSettingAction?: (input: CreateSettingIn) => Promise<CreateSettingOut>;
  updateSettingAction?: (input: UpdateSettingIn) => Promise<UpdateSettingOut>;
  patchSettingDraftAction?: (
    input: PatchSettingDraftIn
  ) => Promise<PatchSettingDraftOut>;
}

function Setting({
  settingId,
  settingData,
  createSettingAction,
  updateSettingAction,
  patchSettingDraftAction,
}: SettingProps) {
  const router = useRouter();
  const isEditMode = !!settingId;
  const { isAutosaveEnabled, setSelectedDraftId } = useDrafts();
  const emptyFlushRegistryRef = useRef<
    Map<string, () => Promise<Record<string, unknown> | void>>
  >(new Map());
  const s = settingData as unknown as CanonicalSettingData | undefined;

  const getInitialFormState = useCallback((): SettingFormState => {
    return {
      name_id: s?.names?.find((item) => item.selected)?.id ?? null,
      name: null,
      description_id: s?.descriptions?.find((item) => item.selected)?.id ?? null,
      description: null,
      active_flag_id: s?.flags?.find((item) => item.selected)?.flag_option_id ?? null,
      color_ids:
        (s?.colors?.filter((item) => item.selected) ?? [])
          .map((item) => item.id)
          .filter((id): id is string => !!id),
      department_ids:
        (s?.departments?.filter((item) => item.selected) ?? [])
          .map((item) => item.department_id)
          .filter((id): id is string => !!id),
      profile_ids:
        (s?.profiles?.filter((item) => item.selected) ?? [])
          .map((item) => item.profile_id)
          .filter((id): id is string => !!id),
      auth_ids:
        (s?.auths?.filter((item) => item.selected) ?? [])
          .map((item) => item.auth_id)
          .filter((id): id is string => !!id),
      provider_key_ids:
        (s?.provider_keys?.filter((item) => item.selected) ?? [])
          .map((item) => item.id)
          .filter((id): id is string => !!id),
      auth_item_key_ids:
        (s?.auth_item_keys?.filter((item) => item.selected) ?? [])
          .map((item) => item.id)
          .filter((id): id is string => !!id),
      system_ids:
        (s?.systems?.filter((item) => item.selected) ?? [])
          .map((item) => item.system_id)
          .filter((id): id is string => !!id),
      pending_ids: (s?.pending_ids ?? []).filter((id): id is string => !!id),
    };
  }, [s]);

  const [formState, setFormState] = useState<SettingFormState>(getInitialFormState);
  const referenceStateRef = useRef<SettingFormState>(getInitialFormState());
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

  const patchActionRef = useRef<
    | ((payload: Record<string, unknown>) => Promise<{ draft_id?: string | null }>)
    | undefined
  >(undefined);

  const settingSearchParamsClient = useMemo(
    () => ({ draftId: parseAsString }),
    []
  );

  const { isGenerating, generate } = useArtifactAi({
    artifactType: "setting",
    validResourceTypes: VALID_RESOURCE_TYPES,
  });

  const pendingIdsBySection = useMemo(
    () => ({
      names: new Set((s?.names ?? []).filter((item) => item.pending && item.id).map((item) => item.id as string)),
      descriptions: new Set((s?.descriptions ?? []).filter((item) => item.pending && item.id).map((item) => item.id as string)),
      flags: new Set((s?.flags ?? []).filter((item) => item.pending && item.flag_option_id).map((item) => item.flag_option_id as string)),
      colors: new Set((s?.colors ?? []).filter((item) => item.pending && item.id).map((item) => item.id as string)),
      departments: new Set((s?.departments ?? []).filter((item) => item.pending && item.department_id).map((item) => item.department_id as string)),
      profiles: new Set((s?.profiles ?? []).filter((item) => item.pending && item.profile_id).map((item) => item.profile_id as string)),
      auths: new Set((s?.auths ?? []).filter((item) => item.pending && item.auth_id).map((item) => item.auth_id as string)),
      provider_keys: new Set((s?.provider_keys ?? []).filter((item) => item.pending && item.id).map((item) => item.id as string)),
      auth_item_keys: new Set((s?.auth_item_keys ?? []).filter((item) => item.pending && item.id).map((item) => item.id as string)),
      systems: new Set((s?.systems ?? []).filter((item) => item.pending && item.system_id).map((item) => item.system_id as string)),
    }),
    [s]
  );

  const pruneSectionPending = useCallback(
    (section: keyof typeof pendingIdsBySection, nextIds: string[]) => {
      const pendingForSection = pendingIdsBySection[section];
      return formStateRef.current.pending_ids.filter(
        (id) => !pendingForSection.has(id) || nextIds.includes(id)
      );
    },
    [pendingIdsBySection]
  );

  // --- Stable value-change handlers (extracted from inline arrows) ---
  const handleNameIdChange = useCallback((id: string | null) => {
    setFormState((prev) => ({
      ...prev,
      name_id: id,
      name: null,
      pending_ids: pruneSectionPending("names", id ? [id] : []),
    }));
  }, [pruneSectionPending]);

  const handleNameChange = useCallback((name: string) => {
    setFormState((prev) => ({
      ...prev,
      name_id: null,
      name,
      pending_ids: pruneSectionPending("names", []),
    }));
  }, [pruneSectionPending]);

  const handleDescriptionIdChange = useCallback((id: string | null) => {
    setFormState((prev) => ({
      ...prev,
      description_id: id,
      description: null,
      pending_ids: pruneSectionPending("descriptions", id ? [id] : []),
    }));
  }, [pruneSectionPending]);

  const handleDescriptionChange = useCallback((description: string) => {
    setFormState((prev) => ({
      ...prev,
      description_id: null,
      description,
      pending_ids: pruneSectionPending("descriptions", []),
    }));
  }, [pruneSectionPending]);

  useEffect(() => {
    if (!patchSettingDraftAction) {
      patchActionRef.current = undefined;
      return;
    }

    patchActionRef.current = async (payload: Record<string, unknown>) => {
      const result = await patchSettingDraftAction({
        body: payload as PatchSettingDraftIn["body"],
      } as PatchSettingDraftIn);
      const fs = (result as Record<string, unknown>)["form_state"] as
        | Record<string, unknown>
        | undefined;
      if (fs) {
        serverSyncPendingRef.current = true;
        setFormState((prev) => {
          const nextNameId = (fs["name_id"] as string | null) ?? prev.name_id;
          const nextDescriptionId =
            (fs["description_id"] as string | null) ?? prev.description_id;
          const next = {
            ...prev,
            name_id: nextNameId,
            // Clear value fields only once the server has resolved them to
            // IDs — keeping the value would cause infinite re-saves (value
            // takes precedence → new resource → new id → repeat).
            name: nextNameId ? null : prev.name,
            description_id: nextDescriptionId,
            description: nextDescriptionId ? null : prev.description,
            active_flag_id:
              (fs["active_flag_id"] as string | null) ??
              (fs["flag_id"] as string | null) ??
              prev.active_flag_id,
            // Arrays fall back to prev so a server that omits a field doesn't
            // wipe user's selection.
            color_ids: (fs["color_ids"] as string[] | null) ?? prev.color_ids,
            department_ids:
              (fs["department_ids"] as string[] | null) ?? prev.department_ids,
            profile_ids:
              (fs["profile_ids"] as string[] | null) ?? prev.profile_ids,
            auth_ids: (fs["auth_ids"] as string[] | null) ?? prev.auth_ids,
            provider_key_ids:
              (fs["provider_key_ids"] as string[] | null) ??
              prev.provider_key_ids,
            auth_item_key_ids:
              (fs["auth_item_key_ids"] as string[] | null) ??
              prev.auth_item_key_ids,
            system_ids:
              (fs["system_ids"] as string[] | null) ?? prev.system_ids,
            pending_ids:
              (fs["pending_ids"] as string[] | null) ?? prev.pending_ids,
          };
          referenceStateRef.current = next;
          return next;
        });
        requestAnimationFrame(() => {
          serverSyncPendingRef.current = false;
        });
      }
      return result;
    };
  }, [patchSettingDraftAction]);

  const buildPatchPayload = useCallback((draftId: string | null) => {
    const currentFormState = formStateRef.current;
    const payload: Record<string, unknown> = {
      draft_id: draftId,
      input_draft_id: draftId,
      ...buildDraftPayload(SETTING_RESOURCES, {
        formState: currentFormState as unknown as Record<string, unknown>,
        referenceState: referenceStateRef.current as unknown as Record<string, unknown>,
        flushResults: {},
      }),
      pending_ids: currentFormState.pending_ids,
    };

    if (currentFormState.name && !currentFormState.name_id) {
      payload["name"] = currentFormState.name;
      delete payload["name_id"];
    }
    if (currentFormState.description && !currentFormState.description_id) {
      payload["description"] = currentFormState.description;
      delete payload["description_id"];
    }

    return payload;
  }, []);

  const hasResourceIds =
    checkHasResourceIds(
      SETTING_RESOURCES,
      formState as unknown as Record<string, unknown>
    ) ||
    !!formState.name ||
    !!formState.description ||
    formState.pending_ids.length > 0;

  const {
    setUrlFormDataRef,
    onFormDataChange,
    flushAllAndSave,
    formDataRef,
  } = useDraftLifecycle({
    formStateKey: JSON.stringify(
      serverSyncPendingRef.current ? referenceStateRef.current : formState
    ),
    patchActionRef,
    isAutosaveEnabled,
    buildPatchPayload,
    setSelectedDraftId,
    hasResourceIds,
    flushRegistryRef: emptyFlushRegistryRef,
    formStateRef: formStateRef as React.MutableRefObject<Record<string, unknown>>,
  });

  const disabled = !s?.can_edit;

  const handleGenerateResources = useCallback(
    async (resourceTypes: ResourceType[]) => {
      let currentDraftId =
        (formDataRef.current["draftId"] as string | undefined) ?? null;
      if (!currentDraftId) {
        currentDraftId = await flushAllAndSave();
      }
      if (!currentDraftId) {
        toast.error("Please save a draft before generating");
        return;
      }
      generate(resourceTypes, {
        draft_id: currentDraftId,
        artifact_id: settingId ?? null,
      });
    },
    [flushAllAndSave, formDataRef, generate, settingId]
  );

  const canRegenerate = useCallback(
    (resourceType: ResourceType) => {
      if (!s) return false;
      if (resourceType === "names") {
        return s.names?.find((item) => item.selected)?.generated ?? false;
      }
      if (resourceType === "descriptions") {
        return s.descriptions?.find((item) => item.selected)?.generated ?? false;
      }
      if (resourceType === "colors") {
        return s.colors?.some((item) => item.selected && item.generated) ?? false;
      }
      if (resourceType === "flags") {
        return s.flags?.some((item) => item.selected && item.generated) ?? false;
      }
      if (resourceType === "departments") {
        return s.departments?.some((item) => item.selected && item.generated) ?? false;
      }
      return false;
    },
    [s]
  );

  const steps = useMemo(
    () => [
      {
        id: "basic",
        title: "Basic",
        description: "Name, description, colors, status, and departments",
      },
      {
        id: "access",
        title: "Access",
        description: "Profiles, auths, and systems",
      },
      {
        id: "integrations",
        title: "Integrations",
        description: "Provider-key and auth-key pairs",
      },
    ],
    []
  );

  const getStepStatus = useCallback(
    (stepId: string): StepStatus => {
      if (stepId === "basic") {
        return formState.name_id || formState.name ? "completed" : "active";
      }
      if (stepId === "access") {
        return formState.profile_ids.length > 0 ||
          formState.auth_ids.length > 0 ||
          formState.system_ids.length > 0
          ? "completed"
          : "pending";
      }
      if (stepId === "integrations") {
        return formState.provider_key_ids.length > 0 ||
          formState.auth_item_key_ids.length > 0
          ? "completed"
          : "pending";
      }
      return "pending";
    },
    [formState]
  );

  const handleSubmit = useCallback(async () => {
    if (formStateRef.current.name || formStateRef.current.description) {
      await flushAllAndSave();
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    }

    const effectiveState = formStateRef.current;
    if (!effectiveState.name_id) {
      throw new Error("Name is required");
    }
    if ((s?.colors?.length ?? 0) > 0 && effectiveState.color_ids.length === 0) {
      throw new Error("At least one color is required");
    }

    if (isEditMode && settingId && updateSettingAction) {
      await updateSettingAction({
        body: {
          settings: [
            {
              setting_id: settingId,
              name_id: effectiveState.name_id,
              description_id: effectiveState.description_id,
              active_flag_id: effectiveState.active_flag_id,
              color_ids: effectiveState.color_ids.length > 0 ? effectiveState.color_ids : null,
              department_ids: effectiveState.department_ids.length > 0 ? effectiveState.department_ids : null,
              profile_ids: effectiveState.profile_ids.length > 0 ? effectiveState.profile_ids : null,
              auth_ids: effectiveState.auth_ids.length > 0 ? effectiveState.auth_ids : null,
              provider_key_ids: effectiveState.provider_key_ids.length > 0 ? effectiveState.provider_key_ids : null,
              auth_item_key_ids: effectiveState.auth_item_key_ids.length > 0 ? effectiveState.auth_item_key_ids : null,
              system_ids: effectiveState.system_ids.length > 0 ? effectiveState.system_ids : null,
            },
          ],
        },
      } as UpdateSettingIn);
    } else if (createSettingAction) {
      await createSettingAction({
        body: {
          settings: [
            {
              name_id: effectiveState.name_id,
              description_id: effectiveState.description_id,
              active_flag_id: effectiveState.active_flag_id,
              color_ids: effectiveState.color_ids.length > 0 ? effectiveState.color_ids : null,
              department_ids: effectiveState.department_ids.length > 0 ? effectiveState.department_ids : null,
              profile_ids: effectiveState.profile_ids.length > 0 ? effectiveState.profile_ids : null,
              auth_ids: effectiveState.auth_ids.length > 0 ? effectiveState.auth_ids : null,
              provider_key_ids: effectiveState.provider_key_ids.length > 0 ? effectiveState.provider_key_ids : null,
              auth_item_key_ids: effectiveState.auth_item_key_ids.length > 0 ? effectiveState.auth_item_key_ids : null,
              system_ids: effectiveState.system_ids.length > 0 ? effectiveState.system_ids : null,
            },
          ],
        },
      } as CreateSettingIn);
    } else {
      throw new Error("Save action not available");
    }

    toast.success(isEditMode ? "Setting updated" : "Setting created");
    router.push("/settings");
    router.refresh();
  }, [
    createSettingAction,
    flushAllAndSave,
    isEditMode,
    router,
    s?.colors?.length,
    settingId,
    updateSettingAction,
  ]);

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
                resourceTypes={VALID_RESOURCE_TYPES}
                canRegenerate={canRegenerate as (rt: string) => boolean}
                isGenerating={isGenerating as (rt: string) => boolean}
                onOpenModal={() => {
                  void handleGenerateResources(VALID_RESOURCE_TYPES);
                }}
                disabled={disabled || !s?.basic_show_ai_generate}
              />
            }
          >
            <Names
              name_id={formState.name_id}
              name_resource={s?.names?.find((item) => item.selected) ?? null}
              show_name={true}
              names={s?.names ?? []}
              disabled={disabled}
              onNameIdChange={handleNameIdChange}
              onNameChange={handleNameChange}
              defaultName="New Setting"
              hideDescription={true}
              required={true}
            />
            <Descriptions
              description_id={formState.description_id}
              description_resource={s?.descriptions?.find((item) => item.selected) ?? null}
              show_description={true}
              descriptions={s?.descriptions ?? []}
              disabled={disabled}
              onDescriptionIdChange={handleDescriptionIdChange}
              onDescriptionChange={handleDescriptionChange}
            />
            <Colors
              color_ids={formState.color_ids}
              color_resources={(s?.colors ?? []).filter((item) => item.selected)}
              colors={s?.colors ?? []}
              multiSelect={true}
              show_color={true}
              disabled={disabled}
              onChange={(ids) =>
                setFormState((prev) => ({
                  ...prev,
                  color_ids: ids,
                  pending_ids: pruneSectionPending("colors", ids),
                }))
              }
            />
            <Flags
              mode="single"
              flag_id={formState.active_flag_id}
              show_flags={true}
              flags={s?.flags ?? []}
              disabled={disabled}
              onChange={(id) =>
                setFormState((prev) => ({
                  ...prev,
                  active_flag_id: id,
                  pending_ids: pruneSectionPending("flags", id ? [id] : []),
                }))
              }
            />
            <Departments
              department_ids={formState.department_ids}
              department_resources={(s?.departments ?? []).filter((item) => item.selected)}
              show_departments={true}
              departments={s?.departments ?? []}
              disabled={disabled}
              onChange={(ids) =>
                setFormState((prev) => ({
                  ...prev,
                  department_ids: ids,
                  pending_ids: pruneSectionPending("departments", ids),
                }))
              }
            />
          </StepCard>
        );
      }

      if (stepId === "access") {
        return (
          <StepCard
            stepTitle={stepTitle}
            stepDescription={stepDescription}
            stepNumber={stepNumber}
            stepStatus={stepStatus}
            isReadonly={disabled}
          >
            <Profiles
              profile_ids={formState.profile_ids}
              profile_resources={(s?.profiles ?? []).filter((item) => item.selected)}
              show_profiles={true}
              profiles={s?.profiles ?? []}
              disabled={disabled}
              onChange={(ids) =>
                setFormState((prev) => ({
                  ...prev,
                  profile_ids: ids,
                  pending_ids: pruneSectionPending("profiles", ids),
                }))
              }
            />
            <Auths
              auth_ids={formState.auth_ids}
              auth_resources={(s?.auths ?? [])
                .filter((item) => item.selected)
                .map((item) => ({
                  id: item.auth_id ?? undefined,
                  name: item.name ?? undefined,
                  description: item.description ?? undefined,
                  slug: item.slug ?? undefined,
                  generated: item.generated ?? undefined,
                })) as any}
              show_auths={true}
              auths={(s?.auths ?? []).map((item) => ({
                id: item.auth_id ?? undefined,
                name: item.name ?? undefined,
                description: item.description ?? undefined,
                slug: item.slug ?? undefined,
                generated: item.generated ?? undefined,
              })) as any}
              disabled={disabled}
              onChange={(ids) =>
                setFormState((prev) => ({
                  ...prev,
                  auth_ids: ids,
                  pending_ids: pruneSectionPending("auths", ids),
                }))
              }
            />
            <Systems
              system_ids={formState.system_ids}
              system_resources={(s?.systems ?? []).filter((item) => item.selected)}
              systems={s?.systems ?? []}
              show_systems={true}
              disabled={disabled}
              onChange={(ids) =>
                setFormState((prev) => ({
                  ...prev,
                  system_ids: ids,
                  pending_ids: pruneSectionPending("systems", ids),
                }))
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
        >
          <ProviderKeys
            provider_key_ids={formState.provider_key_ids}
            provider_key_resources={(s?.provider_keys ?? []).filter((item) => item.selected)}
            providers={s?.providers ?? []}
            keys={s?.keys ?? []}
            disabled={disabled}
            onChange={(ids) =>
              setFormState((prev) => ({
                ...prev,
                provider_key_ids: ids,
                pending_ids: pruneSectionPending("provider_keys", ids),
              }))
            }
            show_provider_keys={true}
          />
          <AuthItemKeys
            auth_item_key_ids={formState.auth_item_key_ids}
            auth_item_key_resources={(s?.auth_item_keys ?? []).filter((item) => item.selected)}
            auths={(s?.auths ?? []).map((item) => ({
              auth_id: item.auth_id ?? undefined,
              name: item.name ?? undefined,
              description: item.description ?? undefined,
            })) as any}
            keys={s?.keys ?? []}
            disabled={disabled}
            onChange={(ids) =>
              setFormState((prev) => ({
                ...prev,
                auth_item_key_ids: ids,
                pending_ids: pruneSectionPending("auth_item_keys", ids),
              }))
            }
            show_auth_item_keys={true}
          />
        </StepCard>
      );
    },
    [
      canRegenerate,
      disabled,
      formState.active_flag_id,
      formState.auth_ids,
      formState.auth_item_key_ids,
      formState.color_ids,
      formState.department_ids,
      formState.description_id,
      formState.name_id,
      formState.profile_ids,
      formState.provider_key_ids,
      formState.system_ids,
      handleGenerateResources,
      isGenerating,
      pruneSectionPending,
      s,
    ]
  );

  return (
    <div className="w-full space-y-8 p-6">
      <ReadOnlyBanner
        disabled={disabled}
        disabledReason={s?.disabled_reason ?? null}
        entityType="setting"
      />
      <GenericForm
        nuqsParsers={settingSearchParamsClient as Record<string, Parser<unknown>>}
        steps={steps}
        getStepStatus={getStepStatus}
        onSubmit={handleSubmit}
        submitButton={{
          createLabel: "Create Setting",
          updateLabel: "Save Setting",
          backUrl: "/settings",
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

export default Setting;
