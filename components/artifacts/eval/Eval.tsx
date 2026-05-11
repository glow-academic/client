/**
 * Eval.tsx
 * Resource-first Eval artifact component
 * Uses modular resource components and GenericForm pattern
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
import { StepCard } from "@/components/common/forms/StepCard";
import { ReadOnlyBanner } from "@/components/common/forms/ReadOnlyBanner";
import { StepCardAiButton } from "@/components/common/forms/StepCardAiButton";
import { Departments } from "@/components/resources/Departments";
import { Descriptions } from "@/components/resources/Descriptions";
import { Flags } from "@/components/resources/Flags";
import { ModelFlags } from "@/components/resources/ModelFlags";
import { ModelPositions } from "@/components/resources/ModelPositions";
import { ModelRubrics } from "@/components/resources/ModelRubrics";
import { Models } from "@/components/resources/Models";
import { Names } from "@/components/resources/Names";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useDrafts } from "@/contexts/draft-context";
import { useProfile } from "@/contexts/profile-context";
import { useEvalAi } from "@/hooks/use-eval-ai";
import { useDraftLifecycle } from "@/hooks/use-draft-lifecycle";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { ResourceType } from "@/lib/resources/types";
import { parseAsBoolean, parseAsString, type Parser } from "nuqs";

// Types defined inline using InputOf/OutputOf
// Eval endpoints
type CreateEvalIn = InputOf<"/eval/create", "post">;
type CreateEvalOut = OutputOf<"/eval/create", "post">;
type UpdateEvalIn = InputOf<"/eval/update", "post">;
type UpdateEvalOut = OutputOf<"/eval/update", "post">;
type PatchEvalDraftIn = InputOf<"/eval/draft", "post">;
type PatchEvalDraftOut = OutputOf<"/eval/draft", "post">;
type EvalData = OutputOf<"/eval/get", "post">;

type EvalNameItem = {
  id?: string | null;
  name?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  selected?: boolean | null;
  pending?: boolean | null;
};

type EvalDescriptionItem = {
  id?: string | null;
  description?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  selected?: boolean | null;
  pending?: boolean | null;
};

type EvalDepartmentItem = {
  department_id?: string | null;
  name?: string | null;
  description?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  selected?: boolean | null;
  pending?: boolean | null;
};

type EvalModelItem = {
  id?: string | null;
  name?: string | null;
  description?: string | null;
  modality_ids?: string[] | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  selected?: boolean | null;
  pending?: boolean | null;
};

type EvalModelFlagItem = {
  id?: string | null;
  model_id?: string | null;
  flag_id?: string | null;
  name?: string | null;
  description?: string | null;
  icon?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  selected?: boolean | null;
  pending?: boolean | null;
};

type EvalModelPositionItem = {
  id?: string | null;
  model_id?: string | null;
  value?: number | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  selected?: boolean | null;
  pending?: boolean | null;
};

type EvalModelRubricItem = {
  id?: string | null;
  model_id?: string | null;
  rubric_id?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  selected?: boolean | null;
  pending?: boolean | null;
};


type EvalDraftFormState = {
  name_id?: string | null;
  name?: string | null;
  description_id?: string | null;
  description?: string | null;
  flag_ids?: string[] | null;
  department_ids?: string[] | null;
  model_ids?: string[] | null;
  pending_ids?: string[] | null;
};

export interface EvalProps {
  evalId?: string;
  // Server-provided data (for server-side rendering)
  evalDetail?: EvalData;
  evalDetailDefault?: EvalData;
  // Server actions
  createEvalAction?: (input: CreateEvalIn) => Promise<CreateEvalOut>;
  updateEvalAction?: (input: UpdateEvalIn) => Promise<UpdateEvalOut>;
  patchEvalDraftAction?: (
    input: PatchEvalDraftIn
  ) => Promise<PatchEvalDraftOut>;
}

type EvalResourceType =
  | ResourceType
  | "models"
  | "model_flags"
  | "model_positions"
  | "model_rubrics";

interface EvalFormState {
  name: string | null;
  name_id: string | null;
  description: string | null;
  description_id: string | null;
  // Canonical flag_ids array — server sends one row per flags_resource
  // entry in `s.flags` (id/type/value); we store the selected ids here and
  // render with <Flags values=...> which groups rows by type.
  flag_ids: string[];
  department_ids: string[];
  model_ids: string[];
  model_flag_ids: string[];
  model_position_ids: string[];
  model_rubric_ids: string[];
  // Value fields for multi-select creatables (merged with IDs by draft endpoint)
  model_flags: Array<{ model_id: string; flag_id: string }> | null;
  model_positions: Array<{ model_id: string; value: number }> | null;
  model_rubrics: Array<{ model_id: string; rubric_id: string }> | null;
  pending_ids: string[];
}

function EvalComponent({
  evalId,
  evalDetail,
  evalDetailDefault,
  createEvalAction,
  updateEvalAction,
  patchEvalDraftAction,
}: EvalProps) {
  const router = useRouter();
  const isEditMode = !!evalId;
  const { profile } = useProfile();
  const { setSelectedDraftId, isAutosaveEnabled } = useDrafts();
  const evalData = (isEditMode ? evalDetail : evalDetailDefault) as
    | EvalData
    | undefined;
  const s = useMemo(() => {
    if (!evalData) return null;
    return {
      names: evalData.names,
      descriptions: evalData.descriptions,
      flags: evalData.flags,
      departments: evalData.departments,
      models: evalData.models,
      model_flags: evalData.model_flags,
      model_flag_options:
        (evalData as { model_flag_options?: unknown[] }).model_flag_options ?? [],
      model_rubrics: evalData.model_rubrics,
      model_positions: evalData.model_positions,
      rubrics: (evalData as { rubrics?: Array<{ id: string | null; name: string | null; description?: string | null }> }).rubrics,
      basic_show_ai_generate: evalData.basic_show_ai_generate,
      model_show_ai_generate: evalData.model_show_ai_generate,
      group_id: evalData.group_id,
      can_edit: evalData.can_edit,
      disabled_reason: evalData.disabled_reason,
      pending_ids: evalData.pending_ids,
    };
  }, [evalData]);

  // Generation state for AI workflows
  const { isGenerating, makeOnGenerationComplete, generate } =
    useEvalAi({});

  // nuqs parsers for URL-backed state (will be passed to GenericForm)
  const evalSearchParamsClient = useMemo(
    () => ({
      draftId: parseAsString,
      modelSearch: parseAsString,
      modelShowSelected: parseAsBoolean,
    }),
    []
  );

  // Local form state (not in URL) - stores only resource IDs
  const evalDataRef = useRef(evalData);
  useEffect(() => {
    evalDataRef.current = evalData;
  }, [evalData]);

  const getInitialFormState = useCallback((): EvalFormState => {
    const data = evalDataRef.current;
    const selectedFlags = data?.flags?.filter((flag) => flag.selected) ?? [];
    return {
      name: null,
      name_id: data?.names?.find((item) => item.selected)?.id ?? null,
      description: null,
      description_id:
        data?.descriptions?.find((item) => item.selected)?.id ?? null,
      flag_ids: selectedFlags
        .map((flag) => flag.id)
        .filter((id): id is string => !!id),
      department_ids:
        (data?.departments ?? [])
          .filter((d) => d.selected)
          ?.map((d) => d.department_id)
          .filter(Boolean)
          .map(String) ?? [],
      model_ids:
        (data?.models ?? [])
          .filter((m) => m.selected)
          ?.map((m) => m.id)
          .filter(Boolean)
          .map(String) ?? [],
      model_flag_ids:
        (data?.model_flags ?? [])
          .filter((f) => f.selected)
          ?.map((f) => f.id)
          .filter(Boolean)
          .map(String) ?? [],
      model_position_ids:
        (data?.model_positions ?? [])
          .filter((p) => p.selected)
          ?.map((p) => p.id)
          .filter(Boolean)
          .map(String) ?? [],
      model_rubric_ids:
        (data?.model_rubrics ?? [])
          .filter((r) => r.selected)
          ?.map((r) => r.id)
          .filter(Boolean)
          .map(String) ?? [],
      model_flags: null,
      model_positions: null,
      model_rubrics: null,
      pending_ids: data?.pending_ids?.filter(Boolean).map(String) ?? [],
    };
  }, []);

  const [formState, setFormState] =
    useState<EvalFormState>(getInitialFormState);

  const departmentIdsStr = useMemo(
    () =>
      JSON.stringify(
        (s?.departments ?? [])
          .filter((d) => d.selected)
          ?.map((d) => d.department_id)
          .filter(Boolean)
          .map(String) ?? []
      ),
    [s?.departments]
  );
  const modelIdsStr = useMemo(
    () =>
      JSON.stringify(
        (s?.models ?? [])
          .filter((m) => m.selected)
          ?.map((m) => m.id)
          .filter(Boolean)
          .map(String) ?? []
      ),
    [s?.models]
  );
  const modelFlagIdsStr = useMemo(
    () =>
      JSON.stringify(
        (s?.model_flags ?? [])
          .filter((f) => f.selected)
          ?.map((f) => f.id)
          .filter(Boolean)
          .map(String) ?? []
      ),
    [s?.model_flags]
  );
  const modelPositionIdsStr = useMemo(
    () =>
      JSON.stringify(
        (s?.model_positions ?? [])
          .filter((p) => p.selected)
          ?.map((p) => p.id)
          .filter(Boolean)
          .map(String) ?? []
      ),
    [s?.model_positions]
  );
  const modelRubricIdsStr = useMemo(
    () =>
      JSON.stringify(
        (s?.model_rubrics ?? [])
          .filter((r) => r.selected)
          ?.map((r) => r.id)
          .filter(Boolean)
          .map(String) ?? []
      ),
    [s?.model_rubrics]
  );

  // Sync form state when server data changes
  useEffect(() => {
    const nextState = getInitialFormState();
    setFormState((prev) => {
      if (
        prev.name_id !== nextState.name_id ||
        prev.description_id !== nextState.description_id ||
        JSON.stringify(prev.flag_ids) !==
          JSON.stringify(nextState.flag_ids) ||
        JSON.stringify(prev.department_ids) !==
          JSON.stringify(nextState.department_ids) ||
        JSON.stringify(prev.model_ids) !==
          JSON.stringify(nextState.model_ids) ||
        JSON.stringify(prev.model_flag_ids) !==
          JSON.stringify(nextState.model_flag_ids) ||
        JSON.stringify(prev.model_position_ids) !==
          JSON.stringify(nextState.model_position_ids) ||
        JSON.stringify(prev.model_rubric_ids) !==
          JSON.stringify(nextState.model_rubric_ids)
      ) {
        return nextState;
      }
      return prev;
    });
  }, [
    s?.names,
    s?.descriptions,
    s?.flags,
    departmentIdsStr,
    modelIdsStr,
    modelFlagIdsStr,
    modelPositionIdsStr,
    modelRubricIdsStr,
    getInitialFormState,
  ]);

  // ─── Draft autosave via shared lifecycle hook ─────────────────────────
  // Matches Simulation.tsx — the hook debounces, dedupes via formStateKey,
  // handles the server-sync absorb flag, and wires URL draftId round-trip.
  const formStateRef = useRef<Record<string, unknown>>(
    formState as unknown as Record<string, unknown>,
  );
  useEffect(() => {
    formStateRef.current = formState as unknown as Record<string, unknown>;
  }, [formState]);

  // Memoized content-key so reference-only formState changes don't trigger
  // new saves.
  const flagIdsStr = useMemo(
    () => JSON.stringify(formState.flag_ids),
    [formState.flag_ids],
  );

  // Per-type boolean view of flag_ids, built from the catalog.
  const flagValues = useMemo<Record<string, boolean | null>>(() => {
    const map: Record<string, boolean | null> = {};
    const byId = new Map(
      (s?.flags ?? [])
        .filter((f: any) => f.id)
        .map((f: any) => [f.id as string, f]),
    );
    for (const id of formState.flag_ids) {
      const row: any = byId.get(id);
      if (!row) continue;
      const type = row.type ?? row.name;
      if (type && row.value != null) map[type] = row.value;
    }
    return map;
  }, [formState.flag_ids, s?.flags]);

  const flagRowsByType = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const f of s?.flags ?? []) {
      const t = (f as any).type ?? (f as any).name;
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
          rows.map((r) => r.id).filter((id): id is string => !!id),
        );
        const retained = prev.flag_ids.filter((id) => !rowIdsForType.has(id));
        const target =
          next == null ? null : rows.find((r) => r.value === next)?.id ?? null;
        const nextIds = target ? [...retained, target] : retained;
        if (
          nextIds.length === prev.flag_ids.length &&
          nextIds.every((id, i) => id === prev.flag_ids[i])
        ) {
          return prev;
        }
        return { ...prev, flag_ids: nextIds };
      });
    },
    [flagRowsByType],
  );

  // Per-(model_id, type) boolean view of currently-linked model_flags.
  // Derived from formState.model_flag_ids against s.model_flags (which carries
  // the {type, value} pair after the eval get.py enrichment). Keyed
  // "{model_id}:{type}" — the same key the ModelFlags picker reads.
  const modelFlagValues = useMemo<Record<string, boolean | null>>(() => {
    const map: Record<string, boolean | null> = {};
    const byId = new Map(
      (s?.model_flags ?? [])
        .filter((r: any) => r.id)
        .map((r: any) => [r.id as string, r]),
    );
    for (const id of formState.model_flag_ids) {
      const row: any = byId.get(id);
      if (!row) continue;
      const t = row.type ?? row.name;
      if (row.model_id && t && row.value != null) {
        map[`${row.model_id}:${t}`] = row.value;
      }
    }
    return map;
  }, [formState.model_flag_ids, s?.model_flags]);

  const handleModelFlagToggle = useCallback(
    (modelId: string, type: string, next: boolean | null) => {
      setFormState((prev) => {
        const options =
          ((s as any)?.model_flag_options as Array<{
            model_id?: string | null;
            flag_id?: string | null;
            type?: string | null;
            value?: boolean | null;
          }> | undefined) ?? [];

        // All flag_ids that belong to this (model, type) bucket — we drop
        // every such id and optionally add back the one matching the new bool.
        const bucketFlagIds = new Set(
          options
            .filter((o) => o.model_id === modelId && o.type === type && o.flag_id)
            .map((o) => o.flag_id as string),
        );

        // Drop any junction rows whose flag_id is in this bucket. We look up
        // via s.model_flags (which carries flag_id on each row).
        const junctionRowsByType = (s?.model_flags ?? []) as Array<{
          id?: string | null;
          model_id?: string | null;
          flag_id?: string | null;
        }>;
        const junctionIdsToDrop = new Set(
          junctionRowsByType
            .filter(
              (r) =>
                r.model_id === modelId &&
                r.flag_id &&
                bucketFlagIds.has(r.flag_id),
            )
            .map((r) => r.id)
            .filter((id): id is string => !!id),
        );
        const retained = prev.model_flag_ids.filter(
          (id) => !junctionIdsToDrop.has(id),
        );

        // Drop matching (model_id, type) entries from the denormalized
        // value-array so the server resolver sees the canonical state.
        const filteredValues = (prev.model_flags ?? []).filter((entry) => {
          if (entry.model_id !== modelId) return true;
          const opt = options.find(
            (o) => o.model_id === modelId && o.flag_id === entry.flag_id,
          );
          return opt?.type !== type;
        });

        if (next == null) {
          const nextVals = filteredValues.length > 0 ? filteredValues : null;
          return {
            ...prev,
            model_flag_ids: retained,
            model_flags: nextVals,
          };
        }

        const targetOption = options.find(
          (o) => o.model_id === modelId && o.type === type && o.value === next,
        );
        // Look for an existing junction row whose flag_id matches the target.
        const existingJunction = targetOption
          ? junctionRowsByType.find(
              (r) =>
                r.model_id === modelId && r.flag_id === targetOption.flag_id,
            )
          : undefined;

        if (existingJunction?.id) {
          return {
            ...prev,
            model_flag_ids: [...retained, existingJunction.id],
            model_flags:
              filteredValues.length > 0 ? filteredValues : null,
          };
        }

        // No junction row yet — push a {model_id, flag_id} inline-create pair
        // and let the server resolver upsert it on the next draft save.
        const pending = targetOption?.flag_id
          ? [
              ...filteredValues,
              { model_id: modelId, flag_id: targetOption.flag_id },
            ]
          : filteredValues;
        return {
          ...prev,
          model_flag_ids: retained,
          model_flags: pending.length > 0 ? pending : null,
        };
      });
    },
    [s?.model_flag_options, s?.model_flags],
  );
  const deptIdsStr = useMemo(
    () => JSON.stringify(formState.department_ids),
    [formState.department_ids],
  );
  const modelIdsCurStr = useMemo(
    () => JSON.stringify(formState.model_ids),
    [formState.model_ids],
  );
  const modelFlagIdsCurStr = useMemo(
    () => JSON.stringify(formState.model_flag_ids),
    [formState.model_flag_ids],
  );
  const modelPositionIdsCurStr = useMemo(
    () => JSON.stringify(formState.model_position_ids),
    [formState.model_position_ids],
  );
  const modelRubricIdsCurStr = useMemo(
    () => JSON.stringify(formState.model_rubric_ids),
    [formState.model_rubric_ids],
  );
  const pendingIdsCurStr = useMemo(
    () => JSON.stringify(formState.pending_ids),
    [formState.pending_ids],
  );

  const formStateKey = useMemo(
    () =>
      JSON.stringify({
        name_id: formState.name_id,
        name: formState.name,
        description_id: formState.description_id,
        description: formState.description,
        flag_ids: formState.flag_ids,
        department_ids: formState.department_ids,
        model_ids: formState.model_ids,
        model_flag_ids: formState.model_flag_ids,
        model_position_ids: formState.model_position_ids,
        model_rubric_ids: formState.model_rubric_ids,
        model_flags: formState.model_flags,
        model_positions: formState.model_positions,
        model_rubrics: formState.model_rubrics,
        pending_ids: formState.pending_ids,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      formState.name_id,
      formState.name,
      formState.description_id,
      formState.description,
      flagIdsStr,
      deptIdsStr,
      modelIdsCurStr,
      modelFlagIdsCurStr,
      modelPositionIdsCurStr,
      modelRubricIdsCurStr,
      formState.model_flags,
      formState.model_positions,
      formState.model_rubrics,
      pendingIdsCurStr,
    ],
  );

  const hasResourceIds =
    !!formState.name_id ||
    !!formState.description_id ||
    formState.flag_ids.length > 0 ||
    formState.department_ids.length > 0 ||
    formState.model_ids.length > 0 ||
    formState.model_flag_ids.length > 0 ||
    formState.model_position_ids.length > 0 ||
    formState.model_rubric_ids.length > 0 ||
    !!formState.name ||
    !!formState.description;

  const buildPatchPayload = useCallback(
    (draftId: string | null): Record<string, unknown> => {
      const current = formStateRef.current as unknown as EvalFormState;
      const payload: Record<string, unknown> = {
        draft_id: draftId || null,
      };
      // Value takes precedence over ID for creatables.
      if (current.name != null) payload["name"] = current.name;
      else if (current.name_id) payload["name_id"] = current.name_id;
      if (current.description != null) payload["description"] = current.description;
      else if (current.description_id) payload["description_id"] = current.description_id;

      if (current.flag_ids.length > 0) payload["flag_ids"] = current.flag_ids;
      if (current.department_ids.length > 0) payload["department_ids"] = current.department_ids;
      if (current.model_ids.length > 0) payload["model_ids"] = current.model_ids;
      if (current.model_flag_ids.length > 0) payload["model_flag_ids"] = current.model_flag_ids;
      if (current.model_position_ids.length > 0) payload["model_position_ids"] = current.model_position_ids;
      if (current.model_rubric_ids.length > 0) payload["model_rubric_ids"] = current.model_rubric_ids;
      if (current.model_flags?.length) payload["model_flags"] = current.model_flags;
      if (current.model_positions?.length) payload["model_positions"] = current.model_positions;
      if (current.model_rubrics?.length) payload["model_rubrics"] = current.model_rubrics;
      if (current.pending_ids.length > 0) payload["pending_ids"] = current.pending_ids;
      return payload;
    },
    [],
  );

  const patchActionRef = useRef<
    | ((payload: Record<string, unknown>) => Promise<{ draft_id?: string | null }>)
    | undefined
  >(undefined);
  useEffect(() => {
    if (!patchEvalDraftAction) {
      patchActionRef.current = undefined;
      return;
    }
    patchActionRef.current = async (payload: Record<string, unknown>) => {
      const result = await patchEvalDraftAction({
        body: payload,
      } as PatchEvalDraftIn);

      const serverFormState = (result as Record<string, unknown>)?.[
        "form_state"
      ] as EvalDraftFormState | null | undefined;
      if (serverFormState) {
        setFormState((prev) => {
          const nextNameId =
            (serverFormState.name_id as string | null | undefined) ?? prev.name_id;
          const nextDescriptionId =
            (serverFormState.description_id as string | null | undefined) ??
            prev.description_id;
          const nextFlagIds =
            (serverFormState.flag_ids as string[] | null | undefined) ??
            prev.flag_ids;
          const nextDeptIds =
            (serverFormState.department_ids as string[] | null | undefined) ??
            prev.department_ids;
          const nextModelIds =
            (serverFormState.model_ids as string[] | null | undefined) ??
            prev.model_ids;
          const nextPendingIds =
            (serverFormState.pending_ids as string[] | null | undefined) ??
            prev.pending_ids;

          const next: EvalFormState = {
            ...prev,
            name_id: nextNameId,
            name: nextNameId ? null : prev.name,
            description_id: nextDescriptionId,
            description: nextDescriptionId ? null : prev.description,
            flag_ids: nextFlagIds,
            department_ids: nextDeptIds,
            model_ids: nextModelIds,
            pending_ids: nextPendingIds,
          };

          const changed =
            prev.name_id !== next.name_id ||
            prev.name !== next.name ||
            prev.description_id !== next.description_id ||
            prev.description !== next.description ||
            JSON.stringify(prev.flag_ids) !== JSON.stringify(next.flag_ids) ||
            JSON.stringify(prev.department_ids) !== JSON.stringify(next.department_ids) ||
            JSON.stringify(prev.model_ids) !== JSON.stringify(next.model_ids) ||
            JSON.stringify(prev.pending_ids) !== JSON.stringify(next.pending_ids);
          if (!changed) return prev;
          serverSyncPendingRef.current = true;
          return next;
        });
      }

      return result as { draft_id?: string | null };
    };
  }, [patchEvalDraftAction]);

  const emptyFlushRef = useRef(
    new Map<string, () => Promise<void | Record<string, unknown>>>(),
  );

  const {
    setUrlFormDataRef,
    onFormDataChange,
    serverSyncPendingRef,
    formDataRef,
  } = useDraftLifecycle({
    formStateKey,
    patchActionRef,
    isAutosaveEnabled,
    buildPatchPayload,
    setSelectedDraftId,
    hasResourceIds,
    flushRegistryRef: emptyFlushRef,
    formStateRef,
  });

  // --- Stable value-change handlers (extracted from inline arrows) ---
  const handleNameIdChange = useCallback((nameId: string | null) => {
    setFormState((prev) => ({ ...prev, name_id: nameId, name: null }));
  }, []);

  const handleNameChange = useCallback((name: string) => {
    setFormState((prev) => ({ ...prev, name }));
  }, []);

  const handleDescriptionIdChange = useCallback((descriptionId: string | null) => {
    setFormState((prev) => ({
      ...prev,
      description_id: descriptionId,
      description: null,
    }));
  }, []);

  const handleDescriptionChange = useCallback((description: string) => {
    setFormState((prev) => ({ ...prev, description }));
  }, []);

  // ─── Per-field pending lifecycle ──────────────────────────────────
  // Mirrors the canonical persona pattern: inline ✓ / ✗ on a pending
  // diff resolves the id, removes it from ``pending_ids`` so the next
  // autosave promotes (accept) or drops (reject) the connection.
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
    (_field: MultiField, pendingIds: string[]) => {
      const removeSet = new Set(pendingIds);
      setFormState((prev) => ({
        ...prev,
        // Multi-accept keeps the ids in the field array (already
        // selected). Just strip them from pending_ids so the next save
        // promotes the connections to active=true.
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

  // Readonly logic using server-provided can_edit flag
  const disabled = useMemo(() => {
    if (!s) return false;
    return !s.can_edit;
  }, [s]);

  // Resource regeneration check
  const canRegenerate = useCallback(
    (resourceType: EvalResourceType): boolean => {
      if (!s) return false;
      switch (resourceType) {
        case "names":
          return s.names?.find((item) => item.selected)?.generated ?? false;
        case "descriptions":
          return s.descriptions?.find((item) => item.selected)?.generated ?? false;
        case "flags":
          return s.flags?.some((flag) => flag.selected && flag.generated) ?? false;
        case "departments":
          return s.departments?.some((d) => d.selected && d.generated) ?? false;
        case "models":
          return s.models?.some((m) => m.selected && m.generated) ?? false;
        case "model_flags":
          return s.model_flags?.some((f) => f.selected && f.generated) ?? false;
        case "model_positions":
          return s.model_positions?.some((p) => p.selected && p.generated) ?? false;
        case "model_rubrics":
          return s.model_rubrics?.some((r) => r.selected && r.generated) ?? false;
        default:
          return false;
      }
    },
    [s]
  );

  // Step-to-resources mapping for multi-generation
  const stepResources: Record<string, EvalResourceType[]> = useMemo(
    () => ({
      basic: ["names", "descriptions", "flags", "departments"],
      models: [
        "models",
        "model_flags",
        "model_positions",
        "model_rubrics",
      ],
      all: [
        "names",
        "descriptions",
        "flags",
        "departments",
        "models",
        "model_flags",
        "model_positions",
        "model_rubrics",
      ],
    }),
    []
  );

  const handleGenerateResources = useCallback(
    async (
      resourceTypes: EvalResourceType[],
      userInstructions?: string
    ) => {
      const formData = formDataRef.current;
      const draftId = (formData["draftId"] as string | undefined) ?? null;

      generate(resourceTypes, {
        user_instructions: userInstructions ? [userInstructions] : null,
        draft_id: draftId || null,
      });
    },
    [generate]
  );

  // Individual generation handlers
  const handleGenerateModels = useCallback(
    async () => handleGenerateResources(["models"]),
    [handleGenerateResources]
  );

  const handleGenerateModelFlags = useCallback(
    async () => handleGenerateResources(["model_flags"]),
    [handleGenerateResources]
  );

  const handleGenerateModelPositions = useCallback(
    async () => handleGenerateResources(["model_positions"]),
    [handleGenerateResources]
  );

  const handleGenerateModelRubrics = useCallback(
    async () => handleGenerateResources(["model_rubrics"]),
    [handleGenerateResources]
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

  // Submit handler
  const handleSubmit = useCallback(
    async (_formData: Record<string, unknown>) => {
      if (!profile?.id) {
        toast.error("Profile not loaded. Please refresh the page.");
        throw new Error("Profile not loaded");
      }

      if (!formState.name_id) {
        toast.error("Name is required");
        throw new Error("Name is required");
      }

      // Every model in the eval must be paired with a rubric. Mirrors
      // the SIMULATION_REQUIRED.scenario_rubrics gate in Simulation.tsx
      // — surfacing the error at submit time prevents a half-configured
      // eval from landing in the DB.
      if (!formState.model_rubric_ids || formState.model_rubric_ids.length === 0) {
        toast.error("Model rubrics are required");
        throw new Error("Model rubrics are required");
      }

      const saveFlagIds = formState.flag_ids;

      try {
        if (isEditMode) {
          if (!updateEvalAction) throw new Error("Update action not available");
          await updateEvalAction({
            body: {
              evals: [
                {
                  id: evalId!,
                  name_id: formState.name_id ?? undefined,
                  description_id: formState.description_id ?? undefined,
                  flag_ids: saveFlagIds.length > 0 ? saveFlagIds : undefined,
                  department_ids: formState.department_ids.length > 0 ? formState.department_ids : undefined,
                  model_ids: formState.model_ids.length > 0 ? formState.model_ids : undefined,
                  model_flag_ids: formState.model_flag_ids.length > 0 ? formState.model_flag_ids : undefined,
                  model_rubric_ids: formState.model_rubric_ids.length > 0 ? formState.model_rubric_ids : undefined,
                  model_position_ids: formState.model_position_ids.length > 0 ? formState.model_position_ids : undefined,
                },
              ],
              group_id: s?.group_id,
            },
          } as UpdateEvalIn);
        } else {
          if (!createEvalAction) throw new Error("Create action not available");
          await createEvalAction({
            body: {
              evals: [
                {
                  name_id: formState.name_id!,
                  description_id: formState.description_id ?? undefined,
                  flag_ids: saveFlagIds.length > 0 ? saveFlagIds : undefined,
                  department_ids: formState.department_ids.length > 0 ? formState.department_ids : undefined,
                  model_ids: formState.model_ids.length > 0 ? formState.model_ids : undefined,
                  model_flag_ids: formState.model_flag_ids.length > 0 ? formState.model_flag_ids : undefined,
                  model_rubric_ids: formState.model_rubric_ids.length > 0 ? formState.model_rubric_ids : undefined,
                  model_position_ids: formState.model_position_ids.length > 0 ? formState.model_position_ids : undefined,
                },
              ],
              group_id: s?.group_id,
            },
          } as CreateEvalIn);
        }
        toast.success(
          `Eval ${isEditMode ? "updated" : "created"} successfully!`
        );
        router.push("/system/evals");
      } catch (error) {
        toast.error(
          `Failed to ${isEditMode ? "update" : "create"} eval: ${error instanceof Error ? error.message : "Unknown error"}`
        );
        throw error;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      formState,
      isEditMode,
      evalId,
      profile?.id,
      updateEvalAction,
      createEvalAction,
      router,
    ]
  );

  // Step status logic
  const getStepStatus = useCallback(
    (stepId: string, _formData: Record<string, unknown>): StepStatus => {
      const hasName = !!formState.name_id;
      const hasDescription = !!formState.description_id;
      const hasModels = true;
      const hasModelFlags = true;
      const hasModelPositions = true;
      const hasModelRubrics = true;

      switch (stepId) {
        case "basic":
          return hasName && hasDescription ? "completed" : "active";
        case "models":
          return hasModels &&
            hasModelFlags &&
            hasModelPositions &&
            hasModelRubrics
            ? "completed"
            : "active";
        default:
          return "pending";
      }
    },
    [formState, s]
  );

  const steps = useMemo(
    () => [
      {
        id: "basic",
        title: "Basics",
        description: "Name, description, flags, and departments.",
        resetFields: ["name", "description", "department_ids", "active"],
      },
      {
        id: "models",
        title: "Models",
        description:
          "Select models and configure model flags, positions, and rubrics.",
        resetFields: [
          "model_ids",
          "model_flag_ids",
          "model_position_ids",
          "model_rubric_ids",
          "modelSearch",
          "modelShowSelected",
        ],
      },
    ],
    []
  );

  const formFieldKeys = useMemo(
    () => [
      "name_id",
      "description_id",
      "flag_ids",
      "department_ids",
      "model_ids",
      "model_flag_ids",
      "model_position_ids",
      "model_rubric_ids",
    ],
    []
  );

  const resetSuccessMessage = useCallback((stepId: string) => {
    switch (stepId) {
      case "basic":
        return "Basics reset";
      case "models":
        return "Model configuration reset";
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
            department_ids: [],
          };
        case "models":
          return {
            ...prev,
            model_ids: [],
            model_flag_ids: [],
            model_flags: null,
            model_position_ids: [],
            model_positions: null,
            model_rubric_ids: [],
            model_rubrics: null,
          };
        default:
          return prev;
      }
    });
  }, []);

  const submitButton = useMemo(
    () => ({
      backUrl: "/system/evals",
      backLabel: "Back",
      createLabel: "Create Eval",
      updateLabel: "Update Eval",
    }),
    []
  );

  const renderStep = useCallback(
    ({
      stepId,
      stepStatus,
      stepTitle,
      stepDescription,
      stepNumber,
      formData: stepFormData,
      setFormData: setStepFormData,
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
        case "basic": {
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
                  name_id={formState.name_id ?? null}
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
                  required={true}
                  placeholder="Eval name"
                  defaultName="New Eval"
                  hideDescription={true}
                />
              }
              resetFields={["name", "description", "department_ids", "active"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              actions={
                stepResources["basic"]?.length && s?.basic_show_ai_generate ? (
                  <StepCardAiButton
                    stepId="basic"
                    resourceTypes={stepResources["basic"]}
                    canRegenerate={(rt: string) => canRegenerate(rt as EvalResourceType)}
                    isGenerating={(rt: string) =>
                      isGenerating(rt as EvalResourceType)
                    }
                    onOpenModal={handleDirectStepGenerate}
                    disabled={disabled}
                  />
                ) : undefined
              }
            >
              <div className="space-y-4">
                <Descriptions
                  description_id={formState.description_id ?? null}
                  description_resource={
                    s?.descriptions?.find((item) => item.selected) ?? null
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

                {/* Canonical flag picker — server returns one row per
                    flags_resource entry in `s.flags` (typically one true/false
                    pair per logical flag type). The component groups rows by
                    type and emits onChange(type, boolean|null). */}
                <Flags
                  flags={s?.flags ?? []}
                  values={flagValues}
                  show_flags={(s?.flags?.length ?? 0) > 0}
                  columns={1}
                  label="Flags"
                  disabled={disabled}
                  onChange={handleFlagToggle}
                  onAcceptPending={(pendingIds) =>
                    handleAcceptPendingMulti("flag_ids", pendingIds)
                  }
                  onRejectPending={(pendingIds) =>
                    handleRejectPendingMulti("flag_ids", pendingIds)
                  }
                />

                <Departments
                  department_ids={formState.department_ids ?? []}
                  department_resources={
                    (s?.departments ?? []).filter((item) => item.selected) ?? []
                  }
                  show_departments={(s?.departments?.length ?? 0) > 0}
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
                  required={false}
                />
              </div>
            </StepCard>
          );
        }

        case "models": {
          const modelSearch =
            (stepFormData["modelSearch"] as string | undefined) ?? null;
          const modelShowSelected =
            (stepFormData["modelShowSelected"] as boolean | undefined) ?? false;
          const hasSelectedModels =
            (formState.model_ids ?? []).length > 0;
          const showModelFlags =
            (s?.model_flags?.length ?? 0) > 0 || hasSelectedModels;
          const showModelPositions =
            (s?.model_positions?.length ?? 0) > 0 || hasSelectedModels;
          const showModelRubrics =
            (s?.model_rubrics?.length ?? 0) > 0 || hasSelectedModels;

          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              resetFields={[
                "model_ids",
                "model_flag_ids",
                "model_position_ids",
                "model_rubric_ids",
                "modelSearch",
                "modelShowSelected",
              ]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              filters={[
                {
                  key: "modelShowSelected",
                  label: "Show selected only",
                  value: modelShowSelected,
                  onChange: (value: boolean) =>
                    setStepFormData({ modelShowSelected: value }),
                },
              ]}
              searchTerm={modelSearch ?? ""}
              onSearchChange={(term: string) =>
                setStepFormData({ modelSearch: term || null })
              }
              searchPlaceholder="Search models..."
              actions={
                stepResources["models"]?.length &&
                s?.model_show_ai_generate ? (
                  <StepCardAiButton
                    stepId="models"
                    resourceTypes={stepResources["models"]}
                    canRegenerate={(rt: string) => canRegenerate(rt as EvalResourceType)}
                    isGenerating={(rt: string) =>
                      isGenerating(rt as EvalResourceType)
                    }
                    onOpenModal={handleDirectStepGenerate}
                    disabled={disabled}
                  />
                ) : undefined
              }
            >
              <div className="space-y-6">
                <Models
                  model_ids={formState.model_ids ?? []}
                  model_resources={(s?.models ?? []).filter((item) => item.selected)}
                  show_models={(s?.models?.length ?? 0) > 0}
                  models={s?.models ?? []}
                  disabled={disabled}
                  onModelIdsChange={(ids) =>
                    setFormState((prev) => {
                      if (JSON.stringify(prev.model_ids) === JSON.stringify(ids)) return prev;
                      return { ...prev, model_ids: ids };
                    })
                  }
                  label="Models"
                  required={false}
                  searchTerm={modelSearch ?? ""}
                  showSelectedFilter={modelShowSelected}
                />
                <ModelFlags
                  options={((s as any)?.model_flag_options ?? []) as any}
                  existing={(s?.model_flags ?? []) as any}
                  values={modelFlagValues}
                  models={s?.models ?? []}
                  onChange={handleModelFlagToggle}
                  show_model_flags={showModelFlags}
                  disabled={disabled}
                />
                <ModelPositions
                  model_position_ids={formState.model_position_ids ?? []}
                  model_position_resources={
                    (s?.model_positions ?? []).filter((item) => item.selected) ?? []
                  }
                  show_model_positions={showModelPositions}
                  model_positions={s?.model_positions ?? []}
                  models={s?.models ?? []}
                  model_resources={(s?.models ?? []).filter((item) => item.selected)}
                  disabled={disabled}
                  onChange={() => {}}
                  onPositionIdsChange={(ids) =>
                    setFormState((prev) => {
                      if (JSON.stringify(prev.model_position_ids) === JSON.stringify(ids)) return prev;
                      return { ...prev, model_position_ids: ids };
                    })
                  }
                  simulation_id={evalId || null}
                  model_ids={formState.model_ids}
                  onGenerate={handleGenerateModelPositions}
                  required={false}
                  onModelPositionValues={(positions) =>
                    setFormState((prev) => {
                      const nextVal = positions.length > 0 ? positions : null;
                      if (JSON.stringify(prev.model_positions) === JSON.stringify(nextVal)) return prev;
                      return { ...prev, model_positions: nextVal };
                    })
                  }
                />
                <ModelRubrics
                  model_rubric_resources={
                    (s?.model_rubrics ?? []).filter((item) => item.selected) ?? []
                  }
                  show_model_rubrics={showModelRubrics}
                  rubrics={(s as { rubrics?: Array<{ id: string | null; name: string | null; description?: string | null }> } | null)?.rubrics ?? []}
                  model_ids={formState.model_ids ?? []}
                  models={s?.models ?? []}
                  model_resources={(s?.models ?? []).filter((item) => item.selected)}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => {
                      if (JSON.stringify(prev.model_rubric_ids) === JSON.stringify(ids)) return prev;
                      return { ...prev, model_rubric_ids: ids };
                    })
                  }
                  required={true}
                  onModelRubricValues={(rubrics) =>
                    setFormState((prev) => {
                      const nextVal = rubrics.length > 0 ? rubrics : null;
                      if (JSON.stringify(prev.model_rubrics) === JSON.stringify(nextVal)) return prev;
                      return { ...prev, model_rubrics: nextVal };
                    })
                  }
                />
              </div>
            </StepCard>
          );
        }

        default:
          return null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      s,
      formState,
      disabled,
      isEditMode,
      evalId,
      handleGenerateModels,
      handleGenerateModelFlags,
      handleGenerateModelPositions,
      handleGenerateModelRubrics,
      isGenerating,
      stepResources,
      canRegenerate,
      handleDirectStepGenerate,
      makeOnGenerationComplete,
    ]
  );

  return (
    <TooltipProvider>
      <div
        className="w-full p-6 space-y-8"
        data-page={`eval-${isEditMode ? "edit" : "new"}`}
      >
        <ReadOnlyBanner
          disabled={disabled}
          disabledReason={s?.disabled_reason ?? null}
          entityType="eval"
        />

        <GenericForm
          nuqsParsers={
            evalSearchParamsClient as Record<string, Parser<unknown>>
          }
          steps={steps}
          getStepStatus={getStepStatus}
          serverData={s}
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

export default React.memo(EvalComponent);
