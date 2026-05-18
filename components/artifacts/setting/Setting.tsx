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
import { Logins, type LoginDraft } from "@/components/resources/Logins";

// Matches SettingLoginDraftValue on the server. id=null = inline-create.
type LoginValue = {
  id: string | null;
  login_type: "auth" | "profile";
  auth_id: string | null;
  profile_id: string | null;
  display_name: string | null;
  icon_id: string | null;
};
import { Mcp, type McpDraft } from "@/components/resources/Mcp";

// Matches SettingMcpDraftValue on the server. id=null = inline-create.
type McpValue = {
  id: string | null;
  agent_id: string;
  name: string | null;
  description: string | null;
};
import { Names } from "@/components/resources/Names";
import {
  ProviderKeys,
  type ProviderKeyValue,
} from "@/components/resources/ProviderKeys";
import { Providers } from "@/components/resources/Providers";
import { Auths } from "@/components/resources/Auths";
import { Systems, type SystemDraft } from "@/components/resources/Systems";

// Matches SettingSystemDraftValue on the server. id=null = inline-create.
type SystemValue = {
  id: string | null;
  name: string;
  description: string | null;
  agent_ids: string[];
  resolution_strategy: string | null;
  resolution_threshold: number | null;
};
import { Thresholds } from "@/components/resources/Thresholds";
import { useDrafts } from "@/contexts/draft-context";

// Matches SettingThresholdDraftValue on the server. Per-type slider
// draft — server find-or-creates a row at (type, value) and swaps
// the matching-type id into threshold_ids.
type ThresholdValue = {
  id: string | null;
  type: string;
  value: number;
};

const SETTING_THRESHOLD_TYPES: Array<{ type: string; label: string; default: number }> = [
  { type: "success", label: "Success", default: 85 },
  { type: "warning", label: "Warning", default: 80 },
  { type: "danger", label: "Danger", default: 70 },
];
import { useSettingAi } from "@/hooks/use-setting-ai";
import { useDraftLifecycle } from "@/hooks/use-draft-lifecycle";
import type { InputOf, OutputOf } from "@/lib/api/types";
import {
  checkHasResourceIds,
  type ResourceConfig,
} from "@/lib/resources/action-builders";
import type { ResourceType } from "@/lib/resources/types";
import { parseAsString, type Parser } from "nuqs";

type CreateSettingIn = InputOf<"/setting/create", "post">;
type CreateSettingOut = OutputOf<"/setting/create", "post">;
type UpdateSettingIn = InputOf<"/setting/update", "post">;
type UpdateSettingOut = OutputOf<"/setting/update", "post">;
type PatchSettingDraftIn = InputOf<"/setting/draft", "post">;
type PatchSettingDraftOut = OutputOf<"/setting/draft", "post">;
type DecryptSettingIn = InputOf<"/setting/decrypt", "post">;
type DecryptSettingOut = OutputOf<"/setting/decrypt", "post">;
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
  // Drafts only (id=null rows). Server inline-creates and merges ids
  // into system_ids on save.
  system_values: SystemValue[];
  mcp_id: string | null;
  // Drafts only (id=null rows). Existing mcp_resource attachment is
  // tracked via mcp_id; server resolves drafts and sets mcp_id on save.
  mcp_values: McpValue[];
  threshold_ids: string[];
  // Drafts for per-type slider changes. Server finds-or-creates a row
  // matching (type, value) and replaces the same-type entry in threshold_ids.
  threshold_values: ThresholdValue[];
  provider_key_ids: string[];
  provider_keys: ProviderKeyValue[];
  auth_item_key_ids: string[];
  auth_item_keys: AuthItemKeyValue[];
  auth_item_value_ids: string[];
  auth_item_values: AuthItemValueValue[];
  auth_ids: string[];
  provider_ids: string[];
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
  { key: "auths", formKey: "auth_ids", flushKey: null, type: "multi" },
  { key: "providers", formKey: "provider_ids", flushKey: null, type: "multi" },
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
  decryptSettingKeyAction?: (
    input: DecryptSettingIn
  ) => Promise<DecryptSettingOut>;
}

function Setting({
  settingId,
  settingData,
  createSettingAction,
  updateSettingAction,
  patchSettingDraftAction,
  decryptSettingKeyAction,
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
      // `logins` carries inline-create DRAFTS only (id=null). Existing rows
      // are referenced via `logins_ids`; server resolver inline-creates
      // the draft rows and merges their ids into logins_ids on save.
      logins: [] as LoginValue[],
      system_ids:
        (s?.systems?.filter((item) => item.selected) ?? [])
          .map((item) => item.system_id)
          .filter((id): id is string => !!id),
      system_values: [] as SystemValue[],
      mcp_id: s?.mcp?.find((item) => item.selected)?.mcp_id ?? null,
      mcp_values: [] as McpValue[],
      threshold_ids:
        (s?.thresholds?.filter((item) => item.selected) ?? [])
          .map((item) => item.id)
          .filter((id): id is string => !!id),
      threshold_values: [] as ThresholdValue[],
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
      auth_ids: (s?.auths ?? [])
        .filter((item) => item.selected)
        .map((item) => (item.id ?? item.auth_id) as string)
        .filter((id): id is string => !!id),
      provider_ids: (s?.providers ?? [])
        .filter((item) => item.selected)
        .map((item) => (item.id ?? item.provider_id) as string)
        .filter((id): id is string => !!id),
      pending_ids: (s?.pending_ids ?? []).filter((id): id is string => !!id),
    };
  }, [s]);

  const [formState, setFormState] = useState<SettingFormState>(getInitialFormState);
  const formStateRef = useRef(formState);
  const serverSyncPendingRef = useRef(false);

  useEffect(() => {
    formStateRef.current = formState;
  }, [formState]);

  useEffect(() => {
    const initial = getInitialFormState();
    setFormState(initial);
  }, [getInitialFormState]);

  const patchActionRef = useRef<
    | ((payload: Record<string, unknown>) => Promise<{ draft_id?: string | null }>)
    | undefined
  >(undefined);

  const settingSearchParamsClient = useMemo(
    () => ({ draftId: parseAsString }),
    []
  );

  const { isGenerating, generate } = useSettingAi({});

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
      auths: new Set((s?.auths ?? []).filter((item) => item.pending && (item.id ?? item.auth_id)).map((item) => (item.id ?? item.auth_id) as string)),
      providers: new Set((s?.providers ?? []).filter((item) => item.pending && (item.id ?? item.provider_id)).map((item) => (item.id ?? item.provider_id) as string)),
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

  // ─── Per-field pending lifecycle ──────────────────────────────────
  // Mirrors persona pattern. Helpers manage pending_ids; existing
  // handlers retain their pruneSectionPending logic for full-list resets.
  type SingleField = "name_id" | "description_id";
  type MultiField = "department_ids" | "flag_ids" | "color_ids";

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
    (_field: MultiField, pendingIds: string[]) => {
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
            system_values:
              (fs["system_values"] as SystemValue[] | null) ??
              prev.system_values,
            mcp_id: (fs["mcp_id"] as string | null) ?? prev.mcp_id,
            mcp_values:
              (fs["mcp_values"] as McpValue[] | null) ?? prev.mcp_values,
            threshold_ids:
              (fs["threshold_ids"] as string[] | null) ?? prev.threshold_ids,
            threshold_values:
              (fs["threshold_values"] as ThresholdValue[] | null) ??
              prev.threshold_values,
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
            auth_ids:
              (fs["auth_ids"] as string[] | null) ?? prev.auth_ids,
            provider_ids:
              (fs["provider_ids"] as string[] | null) ?? prev.provider_ids,
            pending_ids:
              (fs["pending_ids"] as string[] | null) ?? prev.pending_ids,
          };
          return next;
        });
        requestAnimationFrame(() => {
          serverSyncPendingRef.current = false;
        });
      }
      return result;
    };
  }, [patchSettingDraftAction]);

  const buildPatchPayload = useCallback((): Record<string, unknown> => {
    const current = formStateRef.current as unknown as SettingFormState;
    const payload: Record<string, unknown> = {};

    if (current.name != null) payload["name"] = current.name;
    else if (current.name_id) payload["name_id"] = current.name_id;

    if (current.description != null) payload["description"] = current.description;
    else if (current.description_id) payload["description_id"] = current.description_id;

    if (current.flag_ids.length > 0) payload["flag_ids"] = current.flag_ids;

    if (current.color_ids.length > 0) payload["color_ids"] = current.color_ids;
    if (current.department_ids.length > 0) payload["department_ids"] = current.department_ids;

    // Compound value arrays take precedence over their ID counterpart.
    if (current.logins.length > 0) payload["logins"] = current.logins;
    else if (current.logins_ids.length > 0) payload["logins_ids"] = current.logins_ids;

    if (current.system_values.length > 0) payload["system_values"] = current.system_values;
    else if (current.system_ids.length > 0) payload["system_ids"] = current.system_ids;

    if (current.mcp_values.length > 0) payload["mcp_values"] = current.mcp_values;
    else if (current.mcp_id) payload["mcp_id"] = current.mcp_id;

    if (current.threshold_values.length > 0) payload["threshold_values"] = current.threshold_values;
    else if (current.threshold_ids.length > 0) payload["threshold_ids"] = current.threshold_ids;

    if (current.provider_keys.length > 0) payload["provider_keys"] = current.provider_keys;
    else if (current.provider_key_ids.length > 0) payload["provider_key_ids"] = current.provider_key_ids;

    if (current.auth_item_keys.length > 0) payload["auth_item_keys"] = current.auth_item_keys;
    else if (current.auth_item_key_ids.length > 0) payload["auth_item_key_ids"] = current.auth_item_key_ids;

    if (current.auth_item_values.length > 0) payload["auth_item_values"] = current.auth_item_values;
    else if (current.auth_item_value_ids.length > 0) payload["auth_item_value_ids"] = current.auth_item_value_ids;

    if (current.auth_ids.length > 0) payload["auth_ids"] = current.auth_ids;
    if (current.provider_ids.length > 0) payload["provider_ids"] = current.provider_ids;

    if (current.pending_ids.length > 0) payload["pending_ids"] = current.pending_ids;
    return payload;
  }, []);

  const hasResourceIds =
    checkHasResourceIds(SETTING_RESOURCES, formState as unknown as Record<string, unknown>) ||
    !!formState.name ||
    !!formState.description ||
    formState.logins.length > 0 ||
    formState.system_values.length > 0 ||
    formState.mcp_values.length > 0 ||
    formState.threshold_values.length > 0 ||
    formState.provider_keys.length > 0 ||
    formState.auth_item_keys.length > 0 ||
    formState.auth_item_values.length > 0 ||
    formState.pending_ids.length > 0;

  const {
    setUrlFormDataRef,
    onFormDataChange,
    flushAllAndSave,
    formDataRef,
  } = useDraftLifecycle({
    formStateKey: JSON.stringify(
      serverSyncPendingRef.current ? formStateRef.current : formState
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
        description: "Name, description, departments, and status",
        resetFields: [
          "name_id",
          "description_id",
          "department_ids",
          "flag_ids",
        ],
      },
      {
        id: "color",
        title: "Color",
        description: "Theme color",
        resetFields: ["color_ids"],
      },
      {
        id: "logins",
        title: "Logins",
        description: "Login buttons on the sign-in page",
        resetFields: ["logins_ids"],
      },
      {
        id: "systems",
        title: "Systems",
        description: "Agent routing",
        resetFields: ["system_ids"],
      },
      {
        id: "mcp",
        title: "MCP",
        description: "Agent exposed as this setting's MCP server",
        resetFields: ["mcp_id"],
      },
      {
        id: "thresholds",
        title: "Thresholds",
        description: "Scoring cutoffs",
        resetFields: ["threshold_ids", "threshold_values"],
      },
      {
        id: "provider",
        title: "Providers",
        description: "Providers and their API keys",
        resetFields: ["provider_ids", "provider_key_ids", "provider_keys"],
      },
      {
        id: "auth",
        title: "Auths",
        description:
          "Auth providers and their OIDC/SAML claim keys and values",
        resetFields: [
          "auth_ids",
          "auth_item_key_ids",
          "auth_item_keys",
          "auth_item_value_ids",
          "auth_item_values",
        ],
      },
    ],
    []
  );

  const stepResources = useMemo<Record<string, string[]>>(
    () => ({
      basic: ["names", "descriptions", "departments", "flags"],
      color: ["colors"],
      logins: ["logins"],
      systems: ["systems"],
      mcp: ["mcp"],
      thresholds: ["thresholds"],
      provider: ["providers", "provider_keys"],
      auth: ["auths", "auth_item_keys", "auth_item_values"],
      all: VALID_RESOURCE_TYPES,
    }),
    []
  );

  const handleDirectStepGenerate = useCallback(
    (stepId: string, _mode: "generate" | "regenerate") => {
      const resources = stepResources[stepId];
      if (resources && resources.length > 0) {
        void handleGenerateResources(resources as ResourceType[]);
      }
    },
    [stepResources, handleGenerateResources]
  );

  const handleReset = useCallback((stepId: string) => {
    setFormState((prev) => {
      switch (stepId) {
        case "basic":
          return {
            ...prev,
            name_id: null,
            name: null,
            description_id: null,
            description: null,
            department_ids: [],
            flag_ids: [],
          };
        case "color":
          return { ...prev, color_ids: [] };
        case "logins":
          return { ...prev, logins_ids: [], logins: [] };
        case "systems":
          return { ...prev, system_ids: [], system_values: [] };
        case "mcp":
          return { ...prev, mcp_id: null, mcp_values: [] };
        case "thresholds":
          return { ...prev, threshold_ids: [], threshold_values: [] };
        case "provider":
          return {
            ...prev,
            provider_ids: [],
            provider_key_ids: [],
            provider_keys: [],
          };
        case "auth":
          return {
            ...prev,
            auth_ids: [],
            auth_item_key_ids: [],
            auth_item_keys: [],
            auth_item_value_ids: [],
            auth_item_values: [],
          };
        default:
          return prev;
      }
    });
  }, []);

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
          if (formState.provider_ids.length === 0) return "pending";
          return formState.provider_key_ids.length > 0 ? "completed" : "active";
        case "auth":
          if (formState.auth_ids.length === 0) return "pending";
          return formState.auth_item_key_ids.length > 0 ||
            formState.auth_item_value_ids.length > 0
            ? "completed"
            : "active";
        default:
          return "pending";
      }
    },
    [formState]
  );

  // Decrypt callback for ProviderKeys / AuthItemKeys "Reveal" buttons.
  // Calls /setting/decrypt server action, which audits the access.
  const decryptKey = useCallback(
    async (key_id: string): Promise<string | null> => {
      if (!decryptSettingKeyAction || !settingId) return null;
      try {
        const result = await decryptSettingKeyAction({
          body: { setting_id: settingId, key_id },
        } as DecryptSettingIn);
        const decrypted = (result as DecryptSettingOut & { key?: string | null })
          .key;
        return decrypted ?? null;
      } catch (err) {
        console.error("decrypt failed", err);
        return null;
      }
    },
    [decryptSettingKeyAction, settingId],
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
      auth_ids: effectiveState.auth_ids.length > 0 ? effectiveState.auth_ids : null,
      provider_ids: effectiveState.provider_ids.length > 0 ? effectiveState.provider_ids : null,
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
      if (stepId === "basic") {
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
                name_resource={s?.names?.find((item) => item.selected) ?? null}
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
                placeholder="e.g., University Settings"
                defaultName="New Setting"
                hideDescription={true}
                required={true}
              />
            }
            resetFields={[
              "name_id",
              "description_id",
              "department_ids",
              "flag_ids",
            ]}
            actions={
              <StepCardAiButton
                stepId="basic"
                resourceTypes={stepResources["basic"] ?? []}
                canRegenerate={canRegenerate as (rt: string) => boolean}
                isGenerating={isGenerating as (rt: string) => boolean}
                onOpenModal={handleDirectStepGenerate}
                disabled={disabled || !s?.basic_show_ai_generate}
              />
            }
            {...(onReset ? { onReset } : {})}
            resetLabel="Reset"
          >
            <Descriptions
              description_id={formState.description_id}
              description_resource={s?.descriptions?.find((item) => item.selected) ?? null}
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
              onAcceptPending={(pendingIds) =>
                handleAcceptPendingMulti("department_ids", pendingIds)
              }
              onRejectPending={(pendingIds) =>
                handleRejectPendingMulti("department_ids", pendingIds)
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
              onAcceptPending={(pendingIds) =>
                handleAcceptPendingMulti("flag_ids", pendingIds)
              }
              onRejectPending={(pendingIds) =>
                handleRejectPendingMulti("flag_ids", pendingIds)
              }
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
            isEditMode={isEditMode}
            resetFields={["color_ids"]}
            actions={
              <StepCardAiButton
                stepId="color"
                resourceTypes={stepResources["color"] ?? []}
                canRegenerate={canRegenerate as (rt: string) => boolean}
                isGenerating={isGenerating as (rt: string) => boolean}
                onOpenModal={handleDirectStepGenerate}
                disabled={disabled || !s?.show_ai_generate}
              />
            }
            {...(onReset ? { onReset } : {})}
            resetLabel="Reset"
          >
            {(() => {
              // Group colors by their `type` role and render one
              // single-select Colors picker per role. Canonical storage
              // stays flat (color_ids: string[]); the per-type selection
              // is derived from catalog intersection on each render.
              type ColorRow = NonNullable<NonNullable<typeof s>["colors"]>[number];
              const byType = new Map<string, ColorRow[]>();
              for (const c of s?.colors ?? []) {
                const t = c.type || "primary";
                const list = byType.get(t) ?? [];
                list.push(c);
                byType.set(t, list);
              }
              // Canonical theme-role order; any type not in this list is
              // hidden (e.g. `chart1`/`chart3` seeds aren't theme roles).
              const ROLE_ORDER = [
                "primary",
                "secondary",
                "accent",
                "background",
                "foreground",
                "surface",
                "muted",
                "success",
                "warning",
                "danger",
                "info",
              ];
              const types = ROLE_ORDER.filter((t) => byType.has(t));
              return (
                <div className="space-y-6">
                  {types.map((type) => {
                    const rows = byType.get(type) ?? [];
                    const rowIdsForType = new Set(
                      rows.map((r) => r.id).filter((id): id is string => !!id)
                    );
                    const currentId =
                      formState.color_ids.find((id) => rowIdsForType.has(id)) ?? null;
                    const label = type
                      .split("_")
                      .map((w) => w[0]!.toUpperCase() + w.slice(1))
                      .join(" ");
                    return (
                      <Colors
                        key={type}
                        color_id={currentId}
                        color_resource={
                          rows.find((r) => r.id === currentId) ?? null
                        }
                        colors={rows}
                        show_color={true}
                        disabled={disabled}
                        label={label}
                        onColorIdChange={(nextId) =>
                          setFormState((prev) => {
                            const retained = prev.color_ids.filter(
                              (id) => !rowIdsForType.has(id)
                            );
                            const nextIds = nextId
                              ? [...retained, nextId]
                              : retained;
                            return {
                              ...prev,
                              color_ids: nextIds,
                              pending_ids: pruneSectionPending("colors", nextIds),
                            };
                          })
                        }
                        onAcceptPending={(pendingId) => {
                          // Colors are stored as a multi-id array partitioned
                          // by `type`. Accept = swap the per-type slot to the
                          // accepted id, then strip it from pending_ids.
                          setFormState((prev) => {
                            const retained = prev.color_ids.filter(
                              (id) => !rowIdsForType.has(id),
                            );
                            return {
                              ...prev,
                              color_ids: [...retained, pendingId],
                              pending_ids: prev.pending_ids.filter(
                                (id) => id !== pendingId,
                              ),
                            };
                          });
                        }}
                        onRejectPending={(pendingId) => {
                          setFormState((prev) => ({
                            ...prev,
                            color_ids: prev.color_ids.filter(
                              (id) => id !== pendingId,
                            ),
                            pending_ids: prev.pending_ids.filter(
                              (id) => id !== pendingId,
                            ),
                          }));
                        }}
                      />
                    );
                  })}
                </div>
              );
            })()}
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
            isEditMode={isEditMode}
            resetFields={["logins_ids"]}
            actions={
              <StepCardAiButton
                stepId="logins"
                resourceTypes={stepResources["logins"] ?? []}
                canRegenerate={canRegenerate as (rt: string) => boolean}
                isGenerating={isGenerating as (rt: string) => boolean}
                onOpenModal={handleDirectStepGenerate}
                disabled={disabled || !s?.show_ai_generate}
              />
            }
            {...(onReset ? { onReset } : {})}
            resetLabel="Reset"
          >
            <Logins
              logins_ids={formState.logins_ids}
              logins={s?.logins ?? []}
              auths={s?.auths ?? []}
              profiles={s?.profiles ?? []}
              icons={s?.icons ?? []}
              disabled={disabled}
              show_logins={true}
              onChange={(ids) =>
                setFormState((prev) => ({
                  ...prev,
                  logins_ids: ids,
                  pending_ids: pruneSectionPending("logins", ids),
                }))
              }
              onCreate={(draft: LoginDraft) =>
                setFormState((prev) => ({
                  ...prev,
                  logins: [...prev.logins, { id: null, ...draft }],
                }))
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
            isEditMode={isEditMode}
            resetFields={["system_ids"]}
            actions={
              <StepCardAiButton
                stepId="systems"
                resourceTypes={stepResources["systems"] ?? []}
                canRegenerate={canRegenerate as (rt: string) => boolean}
                isGenerating={isGenerating as (rt: string) => boolean}
                onOpenModal={handleDirectStepGenerate}
                disabled={disabled || !s?.show_ai_generate}
              />
            }
            {...(onReset ? { onReset } : {})}
            resetLabel="Reset"
          >
            <Systems
              system_ids={formState.system_ids}
              systems={s?.systems ?? []}
              agents={s?.agents ?? []}
              show_systems={true}
              disabled={disabled}
              onChange={(ids) =>
                setFormState((prev) => ({
                  ...prev,
                  system_ids: ids,
                  pending_ids: pruneSectionPending("systems", ids),
                }))
              }
              onCreate={(draft: SystemDraft) =>
                setFormState((prev) => ({
                  ...prev,
                  system_values: [
                    ...prev.system_values,
                    {
                      id: null,
                      name: draft.name,
                      description: draft.description || null,
                      agent_ids: draft.agent_ids,
                      resolution_strategy: draft.resolution_strategy,
                      resolution_threshold: draft.resolution_threshold,
                    },
                  ],
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
            isEditMode={isEditMode}
            resetFields={["mcp_id"]}
            actions={
              <StepCardAiButton
                stepId="mcp"
                resourceTypes={stepResources["mcp"] ?? []}
                canRegenerate={canRegenerate as (rt: string) => boolean}
                isGenerating={isGenerating as (rt: string) => boolean}
                onOpenModal={handleDirectStepGenerate}
                disabled={disabled || !s?.show_ai_generate}
              />
            }
            {...(onReset ? { onReset } : {})}
            resetLabel="Reset"
          >
            <Mcp
              mcp_id={formState.mcp_id}
              mcp={s?.mcp ?? []}
              agents={s?.agents ?? []}
              disabled={disabled}
              show_mcp={true}
              onChange={(id) =>
                setFormState((prev) => ({
                  ...prev,
                  mcp_id: id,
                  pending_ids: pruneSectionPending("mcp", id ? [id] : []),
                }))
              }
              onCreate={(draft: McpDraft) =>
                setFormState((prev) => ({
                  ...prev,
                  mcp_values: [
                    ...prev.mcp_values,
                    {
                      id: null,
                      agent_id: draft.agent_id,
                      name: draft.name || null,
                      description: draft.description || null,
                    },
                  ],
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
            isEditMode={isEditMode}
            resetFields={["threshold_ids", "threshold_values"]}
            actions={
              <StepCardAiButton
                stepId="thresholds"
                resourceTypes={stepResources["thresholds"] ?? []}
                canRegenerate={canRegenerate as (rt: string) => boolean}
                isGenerating={isGenerating as (rt: string) => boolean}
                onOpenModal={handleDirectStepGenerate}
                disabled={disabled || !s?.show_ai_generate}
              />
            }
            {...(onReset ? { onReset } : {})}
            resetLabel="Reset"
          >
            <div className="space-y-6">
              {SETTING_THRESHOLD_TYPES.map(({ type, label, default: dflt }) => {
                // Derive the currently-attached threshold row for this type
                // from threshold_ids × catalog. Draft overrides (e.g. user
                // just dragged) take precedence.
                const draft = formState.threshold_values.find(
                  (v) => v.type === type,
                );
                const attachedId = formState.threshold_ids.find((id) =>
                  (s?.thresholds ?? []).some(
                    (row) => row.id === id && row.type === type,
                  ),
                ) ?? null;
                return (
                  <Thresholds
                    key={type}
                    type={type}
                    label={label}
                    thresholds={s?.thresholds ?? []}
                    current_id={attachedId}
                    defaultValue={draft?.value ?? dflt}
                    disabled={disabled}
                    onChange={(value) =>
                      setFormState((prev) => {
                        // Replace or append the draft for this type.
                        const otherDrafts = prev.threshold_values.filter(
                          (v) => v.type !== type,
                        );
                        return {
                          ...prev,
                          threshold_values: [
                            ...otherDrafts,
                            { id: null, type, value },
                          ],
                        };
                      })
                    }
                  />
                );
              })}
            </div>
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
            isEditMode={isEditMode}
            resetFields={["provider_ids", "provider_key_ids", "provider_keys"]}
            actions={
              <StepCardAiButton
                stepId="provider"
                resourceTypes={stepResources["provider"] ?? []}
                canRegenerate={canRegenerate as (rt: string) => boolean}
                isGenerating={isGenerating as (rt: string) => boolean}
                onOpenModal={handleDirectStepGenerate}
                disabled={disabled || !s?.show_ai_generate}
              />
            }
            {...(onReset ? { onReset } : {})}
            resetLabel="Reset"
          >
            <div className="space-y-6">
              <Providers
                provider_ids={formState.provider_ids}
                providers={(s?.providers ?? []).map((p) => ({
                  id: (p.id ?? p.provider_id) as string | null,
                  name: p.name ?? null,
                  description: p.description ?? null,
                  generated: p.generated ?? null,
                  suggested: p.suggested ?? null,
                  pending: p.pending ?? null,
                }))}
                disabled={disabled}
                onIdsChange={(ids) =>
                  setFormState((prev) => ({
                    ...prev,
                    provider_ids: ids,
                    pending_ids: pruneSectionPending("providers", ids),
                  }))
                }
                show_providers={true}
                label="Providers"
              />
              {formState.provider_ids.length > 0 && (
                <ProviderKeys
                  selected_providers={(s?.providers ?? [])
                    .filter((p) =>
                      formState.provider_ids.includes(
                        (p.id ?? p.provider_id) as string,
                      ),
                    )
                    .map((p) => ({
                      id: (p.id ?? p.provider_id) as string,
                      name: p.name ?? null,
                      description: p.description ?? null,
                    }))}
                  values={formState.provider_keys}
                  // Only show rows actually linked to *this* setting via
                  // setting_provider_keys_junction. The catalog also includes
                  // suggestion rows; we don't want those rendered as "saved
                  // for this setting" with a Reveal button.
                  existing={(s?.provider_keys ?? [])
                    .filter((row) => row.selected)
                    .map((row) => ({
                      id: row.id ?? null,
                      provider_id: row.provider_id ?? null,
                      key_id: row.key_id ?? null,
                      name: row.name ?? null,
                      pending: row.pending ?? null,
                    }))}
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
                  onReveal={decryptKey}
                  show_provider_keys={true}
                />
              )}
            </div>
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
          isEditMode={isEditMode}
          resetFields={[
            "auth_ids",
            "auth_item_key_ids",
            "auth_item_keys",
            "auth_item_value_ids",
            "auth_item_values",
          ]}
          actions={
            <StepCardAiButton
              stepId="auth"
              resourceTypes={stepResources["auth"] ?? []}
              canRegenerate={canRegenerate as (rt: string) => boolean}
              isGenerating={isGenerating as (rt: string) => boolean}
              onOpenModal={handleDirectStepGenerate}
              disabled={disabled || !s?.show_ai_generate}
            />
          }
          {...(onReset ? { onReset } : {})}
          resetLabel="Reset"
        >
          <div className="space-y-6">
            <Auths
              auth_ids={formState.auth_ids}
              auths={(s?.auths ?? []).map((a) => ({
                id: (a.id ?? a.auth_id) as string | null,
                name: a.name ?? null,
                description: a.description ?? null,
                slug: a.slug ?? null,
                generated: a.generated ?? null,
                suggested: a.suggested ?? null,
                pending: a.pending ?? null,
              }))}
              disabled={disabled}
              onIdsChange={(ids) =>
                setFormState((prev) => ({
                  ...prev,
                  auth_ids: ids,
                  pending_ids: pruneSectionPending("auths", ids),
                }))
              }
              show_auths={true}
              label="Auths"
            />
            {formState.auth_ids.length > 0 && (
              <>
                <AuthItemKeys
                  options={(s?.auth_item_value_options ?? []).filter((opt) =>
                    opt.auth_id
                      ? formState.auth_ids.includes(opt.auth_id as string)
                      : false,
                  )}
                  values={formState.auth_item_keys}
                  // Only rows actually linked to this setting via
                  // setting_auth_item_keys_junction (suggestions excluded).
                  existing={(s?.auth_item_keys ?? [])
                    .filter((row) => row.selected)
                    .map((row) => ({
                      id: row.id ?? null,
                      auth_id: row.auth_id ?? null,
                      item_id: row.item_id ?? null,
                      key_id: row.key_id ?? null,
                      pending: row.pending ?? null,
                    }))}
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
                  onReveal={decryptKey}
                  show_auth_item_keys={true}
                />
                <AuthItemValues
                  options={(s?.auth_item_value_options ?? []).filter((opt) =>
                    opt.auth_id
                      ? formState.auth_ids.includes(opt.auth_id as string)
                      : false,
                  )}
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
                        pending_ids: pruneSectionPending(
                          "auth_item_values",
                          ids,
                        ),
                      };
                    })
                  }
                  show_auth_item_values={true}
                />
              </>
            )}
          </div>
        </StepCard>
      );
    },
    [
      canRegenerate,
      decryptKey,
      disabled,
      formState,
      handleDescriptionChange,
      handleDescriptionIdChange,
      handleDirectStepGenerate,
      handleGenerateResources,
      handleNameChange,
      handleNameIdChange,
      isEditMode,
      isGenerating,
      pruneSectionPending,
      s,
      stepResources,
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
        onReset={handleReset}
        onFormDataChange={onFormDataChange}
        registerSetFormData={(setter) => {
          setUrlFormDataRef.current = setter;
        }}
      />
    </div>
  );
}

export default Setting;
