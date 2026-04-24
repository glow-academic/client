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
import {
  AuthItemKeys,
  type AuthItemKeyValue,
} from "@/components/resources/AuthItemKeys";
import {
  AuthItemValues,
  type AuthItemValueValue,
} from "@/components/resources/AuthItemValues";
import { Colors } from "@/components/resources/Colors";
import { Departments } from "@/components/resources/Departments";
import { Descriptions } from "@/components/resources/Descriptions";
import { Flags } from "@/components/resources/Flags";
import { Logins, type LoginValue } from "@/components/resources/Logins";
import { Mcp, type McpValue } from "@/components/resources/Mcp";
import { Names } from "@/components/resources/Names";
import {
  ProviderKeys,
  type ProviderKeyValue,
} from "@/components/resources/ProviderKeys";
import { Systems } from "@/components/resources/Systems";
import { Thresholds } from "@/components/resources/Thresholds";
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

type CanonicalSettingData = SettingData;

type SettingFormState = {
  name_id: string | null;
  name: string | null;
  description_id: string | null;
  description: string | null;
  // Canonical: ids of the flag-resource rows currently selected. The server
  // also accepts denormalized `active`/`mcp` booleans, but the UI ships ids.
  flag_ids: string[];
  color_ids: string[];
  department_ids: string[];
  logins_ids: string[];
  logins: LoginValue[];
  system_ids: string[];
  mcp_id: string | null;
  mcp_values: McpValue | null;
  threshold_ids: string[];
  provider_key_ids: string[];
  provider_keys: ProviderKeyValue[];
  auth_item_key_ids: string[];
  auth_item_keys: AuthItemKeyValue[];
  auth_item_value_ids: string[];
  auth_item_values: AuthItemValueValue[];
  pending_ids: string[];
};

const SETTING_RESOURCES: ResourceConfig[] = [
  { key: "names", formKey: "name_id", flushKey: null, type: "single" },
  { key: "descriptions", formKey: "description_id", flushKey: null, type: "single" },
  { key: "flags", formKey: "flag_ids", flushKey: null, type: "multi" },
  { key: "colors", formKey: "color_ids", flushKey: null, type: "multi" },
  { key: "departments", formKey: "department_ids", flushKey: null, type: "multi" },
  { key: "logins", formKey: "logins_ids", flushKey: null, type: "multi" },
  { key: "systems", formKey: "system_ids", flushKey: null, type: "multi" },
  { key: "mcp", formKey: "mcp_id", flushKey: null, type: "single" },
  { key: "thresholds", formKey: "threshold_ids", flushKey: null, type: "multi" },
  { key: "provider_keys", formKey: "provider_key_ids", flushKey: null, type: "multi" },
  { key: "auth_item_keys", formKey: "auth_item_key_ids", flushKey: null, type: "multi" },
  { key: "auth_item_values", formKey: "auth_item_value_ids", flushKey: null, type: "multi" },
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
      flag_ids: (s?.flags?.filter((item) => item.selected) ?? [])
        .map((item) => item.id)
        .filter((id): id is string => !!id),
      color_ids:
        (s?.colors?.filter((item) => item.selected) ?? [])
          .map((item) => item.id)
          .filter((id): id is string => !!id),
      department_ids:
        (s?.departments?.filter((item) => item.selected) ?? [])
          .map((item) => item.department_id)
          .filter((id): id is string => !!id),
      logins_ids:
        (s?.logins?.filter((item) => item.selected) ?? [])
          .map((item) => item.logins_id)
          .filter((id): id is string => !!id),
      logins: (s?.logins?.filter((item) => item.selected) ?? [])
        .filter(
          (item) =>
            !!item.logins_id &&
            !!item.login_type &&
            (item.login_type === "auth"
              ? !!item.auth_id
              : item.login_type === "profile"
                ? !!item.profile_id
                : false)
        )
        .map((item) => ({
          id: item.logins_id as string,
          login_type: item.login_type as "auth" | "profile",
          auth_id: item.auth_id ?? null,
          profile_id: item.profile_id ?? null,
          display_name: item.display_name ?? null,
          icon_id: item.icon_id ?? null,
        })),
      system_ids:
        (s?.systems?.filter((item) => item.selected) ?? [])
          .map((item) => item.system_id)
          .filter((id): id is string => !!id),
      mcp_id: s?.mcp?.find((item) => item.selected)?.mcp_id ?? null,
      mcp_values: (() => {
        const selected = s?.mcp?.find((item) => item.selected);
        if (!selected?.agent_id) return null;
        return {
          id: selected.mcp_id ?? null,
          agent_id: selected.agent_id,
        };
      })(),
      threshold_ids:
        (s?.thresholds?.filter((item) => item.selected) ?? [])
          .map((item) => item.id)
          .filter((id): id is string => !!id),
      provider_key_ids:
        (s?.provider_keys?.filter((item) => item.selected) ?? [])
          .map((item) => item.id)
          .filter((id): id is string => !!id),
      provider_keys: (s?.provider_keys?.filter((item) => item.selected) ?? [])
        .filter((item) => !!item.id && !!item.provider_id && !!item.key_id)
        .map((item) => ({
          id: item.id as string,
          provider_id: item.provider_id as string,
          key_id: item.key_id as string,
        })),
      auth_item_key_ids:
        (s?.auth_item_keys?.filter((item) => item.selected) ?? [])
          .map((item) => item.id)
          .filter((id): id is string => !!id),
      auth_item_keys: (s?.auth_item_keys?.filter((item) => item.selected) ?? [])
        .filter(
          (item) => !!item.id && !!item.auth_id && !!item.item_id && !!item.key_id
        )
        .map((item) => ({
          id: item.id as string,
          auth_id: item.auth_id as string,
          item_id: item.item_id as string,
          key_id: item.key_id as string,
        })),
      auth_item_value_ids:
        (s?.auth_item_values?.filter((item) => item.selected) ?? [])
          .map((item) => item.id)
          .filter((id): id is string => !!id),
      auth_item_values: (
        s?.auth_item_values?.filter((item) => item.selected) ?? []
      )
        .filter(
          (item) =>
            !!item.id && !!item.auth_id && !!item.item_id && item.value != null
        )
        .map((item) => ({
          id: item.id as string,
          auth_id: item.auth_id as string,
          item_id: item.item_id as string,
          value: item.value as string,
        })),
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
      flags: new Set((s?.flags ?? []).filter((item) => item.pending && item.id).map((item) => item.id as string)),
      colors: new Set((s?.colors ?? []).filter((item) => item.pending && item.id).map((item) => item.id as string)),
      departments: new Set((s?.departments ?? []).filter((item) => item.pending && item.department_id).map((item) => item.department_id as string)),
      logins: new Set((s?.logins ?? []).filter((item) => item.pending && item.logins_id).map((item) => item.logins_id as string)),
      systems: new Set((s?.systems ?? []).filter((item) => item.pending && item.system_id).map((item) => item.system_id as string)),
      mcp: new Set((s?.mcp ?? []).filter((item) => item.pending && item.mcp_id).map((item) => item.mcp_id as string)),
      thresholds: new Set((s?.thresholds ?? []).filter((item) => item.pending && item.id).map((item) => item.id as string)),
      provider_keys: new Set((s?.provider_keys ?? []).filter((item) => item.pending && item.id).map((item) => item.id as string)),
      auth_item_keys: new Set((s?.auth_item_keys ?? []).filter((item) => item.pending && item.id).map((item) => item.id as string)),
      auth_item_values: new Set((s?.auth_item_values ?? []).filter((item) => item.pending && item.id).map((item) => item.id as string)),
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

  // Rows grouped by flag type — used when a toggle swaps between true/false ids.
  type FlagRow = NonNullable<NonNullable<typeof s>["flags"]>[number];
  const flagRowsByType = useMemo(() => {
    const map = new Map<string, FlagRow[]>();
    for (const f of s?.flags ?? []) {
      const t = f.type ?? f.name;
      if (!t) continue;
      const list = map.get(t) ?? [];
      list.push(f);
      map.set(t, list);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          pending_ids: pruneSectionPending("flags", nextIds),
        };
      });
    },
    [flagRowsByType, pruneSectionPending]
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
          const next: SettingFormState = {
            ...prev,
            name_id: nextNameId,
            name: nextNameId ? null : prev.name,
            description_id: nextDescriptionId,
            description: nextDescriptionId ? null : prev.description,
            flag_ids: (fs["flag_ids"] as string[] | null) ?? prev.flag_ids,
            color_ids: (fs["color_ids"] as string[] | null) ?? prev.color_ids,
            department_ids:
              (fs["department_ids"] as string[] | null) ?? prev.department_ids,
            logins_ids:
              (fs["logins_ids"] as string[] | null) ?? prev.logins_ids,
            logins:
              (fs["logins"] as LoginValue[] | null) ?? prev.logins,
            system_ids:
              (fs["system_ids"] as string[] | null) ?? prev.system_ids,
            mcp_id: (fs["mcp_id"] as string | null) ?? prev.mcp_id,
            mcp_values: ((): McpValue | null => {
              const fsMcp = fs["mcp_values"] as McpValue[] | null | undefined;
              if (fsMcp && fsMcp.length > 0) return fsMcp[0] ?? null;
              const nextMcpId = (fs["mcp_id"] as string | null) ?? prev.mcp_id;
              if (prev.mcp_values && prev.mcp_values.id === nextMcpId) return prev.mcp_values;
              if (prev.mcp_values && nextMcpId) {
                return { ...prev.mcp_values, id: nextMcpId };
              }
              return prev.mcp_values;
            })(),
            threshold_ids:
              (fs["threshold_ids"] as string[] | null) ?? prev.threshold_ids,
            provider_key_ids:
              (fs["provider_key_ids"] as string[] | null) ??
              prev.provider_key_ids,
            provider_keys:
              (fs["provider_keys"] as ProviderKeyValue[] | null) ??
              prev.provider_keys,
            auth_item_key_ids:
              (fs["auth_item_key_ids"] as string[] | null) ??
              prev.auth_item_key_ids,
            auth_item_keys:
              (fs["auth_item_keys"] as AuthItemKeyValue[] | null) ??
              prev.auth_item_keys,
            auth_item_value_ids:
              (fs["auth_item_value_ids"] as string[] | null) ??
              prev.auth_item_value_ids,
            auth_item_values:
              (fs["auth_item_values"] as AuthItemValueValue[] | null) ??
              prev.auth_item_values,
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

    payload["provider_keys"] = currentFormState.provider_keys;
    payload["auth_item_keys"] = currentFormState.auth_item_keys;
    payload["auth_item_values"] = currentFormState.auth_item_values;
    payload["logins"] = currentFormState.logins;
    payload["mcp_values"] = currentFormState.mcp_values
      ? [currentFormState.mcp_values]
      : [];

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
      { id: "basic", title: "Basic", description: "Name, description, departments, and status" },
      { id: "color", title: "Color", description: "Theme color" },
      { id: "logins", title: "Logins", description: "Login buttons on the sign-in page" },
      { id: "systems", title: "Systems", description: "Agent routing" },
      { id: "mcp", title: "MCP", description: "Agent exposed as this setting's MCP server" },
      { id: "thresholds", title: "Thresholds", description: "Scoring cutoffs" },
      { id: "provider", title: "Provider", description: "Provider API keys" },
      { id: "auth", title: "Auth", description: "OIDC/SAML claim keys and values" },
    ],
    []
  );

  const getStepStatus = useCallback(
    (stepId: string): StepStatus => {
      switch (stepId) {
        case "basic":
          return formState.name_id || formState.name ? "completed" : "active";
        case "color":
          return formState.color_ids.length > 0 ? "completed" : "pending";
        case "logins":
          return formState.logins_ids.length > 0 ? "completed" : "pending";
        case "systems":
          return formState.system_ids.length > 0 ? "completed" : "pending";
        case "mcp":
          return formState.mcp_id ? "completed" : "pending";
        case "thresholds":
          return formState.threshold_ids.length > 0 ? "completed" : "pending";
        case "provider":
          return formState.provider_key_ids.length > 0 ? "completed" : "pending";
        case "auth":
          return formState.auth_item_key_ids.length > 0 ||
            formState.auth_item_value_ids.length > 0
            ? "completed"
            : "pending";
        default:
          return "pending";
      }
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

    const body = {
      name_id: effectiveState.name_id,
      description_id: effectiveState.description_id,
      flag_ids:
        effectiveState.flag_ids.length > 0 ? effectiveState.flag_ids : null,
      color_ids: effectiveState.color_ids.length > 0 ? effectiveState.color_ids : null,
      department_ids: effectiveState.department_ids.length > 0 ? effectiveState.department_ids : null,
      logins_ids: effectiveState.logins_ids.length > 0 ? effectiveState.logins_ids : null,
      system_ids: effectiveState.system_ids.length > 0 ? effectiveState.system_ids : null,
      mcp_id: effectiveState.mcp_id,
      threshold_ids: effectiveState.threshold_ids.length > 0 ? effectiveState.threshold_ids : null,
      provider_key_ids: effectiveState.provider_key_ids.length > 0 ? effectiveState.provider_key_ids : null,
      auth_item_key_ids: effectiveState.auth_item_key_ids.length > 0 ? effectiveState.auth_item_key_ids : null,
      auth_item_value_ids: effectiveState.auth_item_value_ids.length > 0 ? effectiveState.auth_item_value_ids : null,
    };

    if (isEditMode && settingId && updateSettingAction) {
      await updateSettingAction({
        body: {
          settings: [{ id: settingId, ...body }],
        },
      } as UpdateSettingIn);
    } else if (createSettingAction) {
      await createSettingAction({
        body: {
          settings: [body],
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
            customHeader={
              <Names
                name_id={formState.name_id}
                name_resource={s?.names?.find((item) => item.selected) ?? null}
                show_name={true}
                names={s?.names ?? []}
                disabled={disabled}
                onNameIdChange={handleNameIdChange}
                onNameChange={handleNameChange}
                placeholder="e.g., University Settings"
                defaultName="New Setting"
                hideDescription={true}
                required={true}
              />
            }
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
            <Descriptions
              description_id={formState.description_id}
              description_resource={s?.descriptions?.find((item) => item.selected) ?? null}
              show_description={true}
              descriptions={s?.descriptions ?? []}
              disabled={disabled}
              onDescriptionIdChange={handleDescriptionIdChange}
              onDescriptionChange={handleDescriptionChange}
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
            <Flags
              flags={s?.flags ?? []}
              values={flagValues}
              columns={1}
              label="Flags"
              disabled={disabled}
              show_flags={true}
              onChange={handleFlagToggle}
            />
          </StepCard>
        );
      }

      if (stepId === "color") {
        return (
          <StepCard
            stepTitle={stepTitle}
            stepDescription={stepDescription}
            stepNumber={stepNumber}
            stepStatus={stepStatus}
            isReadonly={disabled}
          >
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
          </StepCard>
        );
      }

      if (stepId === "logins") {
        return (
          <StepCard
            stepTitle={stepTitle}
            stepDescription={stepDescription}
            stepNumber={stepNumber}
            stepStatus={stepStatus}
            isReadonly={disabled}
          >
            <Logins
              options={s?.login_options ?? []}
              values={formState.logins}
              existing={s?.logins ?? []}
              disabled={disabled}
              show_logins={true}
              onChange={(values) =>
                setFormState((prev) => {
                  const ids = values
                    .map((v) => v.id)
                    .filter((id): id is string => !!id);
                  return {
                    ...prev,
                    logins: values,
                    logins_ids: ids,
                    pending_ids: pruneSectionPending("logins", ids),
                  };
                })
              }
            />
          </StepCard>
        );
      }

      if (stepId === "systems") {
        return (
          <StepCard
            stepTitle={stepTitle}
            stepDescription={stepDescription}
            stepNumber={stepNumber}
            stepStatus={stepStatus}
            isReadonly={disabled}
          >
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

      if (stepId === "mcp") {
        return (
          <StepCard
            stepTitle={stepTitle}
            stepDescription={stepDescription}
            stepNumber={stepNumber}
            stepStatus={stepStatus}
            isReadonly={disabled}
          >
            <Mcp
              options={s?.mcp_options ?? []}
              value={formState.mcp_values}
              existing={s?.mcp ?? []}
              disabled={disabled}
              onChange={(value) =>
                setFormState((prev) => ({
                  ...prev,
                  mcp_values: value,
                  mcp_id: value?.id ?? null,
                  pending_ids: pruneSectionPending(
                    "mcp",
                    value?.id ? [value.id] : []
                  ),
                }))
              }
            />
          </StepCard>
        );
      }

      if (stepId === "thresholds") {
        return (
          <StepCard
            stepTitle={stepTitle}
            stepDescription={stepDescription}
            stepNumber={stepNumber}
            stepStatus={stepStatus}
            isReadonly={disabled}
          >
            <Thresholds
              threshold_ids={formState.threshold_ids}
              threshold_resources={(s?.thresholds ?? []).filter((item) => item.selected)}
              thresholds={s?.thresholds ?? []}
              show_thresholds={true}
              disabled={disabled}
              onChange={(ids) =>
                setFormState((prev) => ({
                  ...prev,
                  threshold_ids: ids,
                  pending_ids: pruneSectionPending("thresholds", ids),
                }))
              }
            />
          </StepCard>
        );
      }

      if (stepId === "provider") {
        return (
          <StepCard
            stepTitle={stepTitle}
            stepDescription={stepDescription}
            stepNumber={stepNumber}
            stepStatus={stepStatus}
            isReadonly={disabled}
          >
            <ProviderKeys
              options={s?.provider_key_options ?? []}
              values={formState.provider_keys}
              existing={s?.provider_keys ?? []}
              disabled={disabled}
              onChange={(values) =>
                setFormState((prev) => {
                  const ids = values
                    .map((v) => v.id)
                    .filter((id): id is string => !!id);
                  return {
                    ...prev,
                    provider_keys: values,
                    provider_key_ids: ids,
                    pending_ids: pruneSectionPending("provider_keys", ids),
                  };
                })
              }
              show_provider_keys={true}
            />
          </StepCard>
        );
      }

      // auth
      return (
        <StepCard
          stepTitle={stepTitle}
          stepDescription={stepDescription}
          stepNumber={stepNumber}
          stepStatus={stepStatus}
          isReadonly={disabled}
        >
          <AuthItemKeys
            options={s?.auth_item_key_options ?? []}
            values={formState.auth_item_keys}
            existing={s?.auth_item_keys ?? []}
            disabled={disabled}
            onChange={(values) =>
              setFormState((prev) => {
                const ids = values
                  .map((v) => v.id)
                  .filter((id): id is string => !!id);
                return {
                  ...prev,
                  auth_item_keys: values,
                  auth_item_key_ids: ids,
                  pending_ids: pruneSectionPending("auth_item_keys", ids),
                };
              })
            }
            show_auth_item_keys={true}
          />
          <AuthItemValues
            options={s?.auth_item_value_options ?? []}
            values={formState.auth_item_values}
            existing={s?.auth_item_values ?? []}
            disabled={disabled}
            onChange={(values) =>
              setFormState((prev) => {
                const ids = values
                  .map((v) => v.id)
                  .filter((id): id is string => !!id);
                return {
                  ...prev,
                  auth_item_values: values,
                  auth_item_value_ids: ids,
                  pending_ids: pruneSectionPending("auth_item_values", ids),
                };
              })
            }
            show_auth_item_values={true}
          />
        </StepCard>
      );
    },
    [
      canRegenerate,
      disabled,
      formState,
      handleDescriptionChange,
      handleDescriptionIdChange,
      handleGenerateResources,
      handleNameChange,
      handleNameIdChange,
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
