/**
 * Rubric.tsx
 * Canonical rubric create/edit component (persona parity pattern).
 */
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
import { Flags } from "@/components/resources/Flags";
import { Names } from "@/components/resources/Names";
import { Points } from "@/components/resources/Points";
import { Standards } from "@/components/resources/Standards";
import { StandardGroups } from "@/components/resources/StandardGroups";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useProfile } from "@/contexts/profile-context";
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
import { parseAsBoolean, parseAsString, type Parser } from "nuqs";

type CreateRubricIn = InputOf<"/rubric/create", "post">;
type CreateRubricOut = OutputOf<"/rubric/create", "post">;
type UpdateRubricIn = InputOf<"/rubric/update", "post">;
type UpdateRubricOut = OutputOf<"/rubric/update", "post">;
type PatchRubricDraftIn = InputOf<"/rubric/draft", "patch">;
type PatchRubricDraftOut = OutputOf<"/rubric/draft", "patch">;
type RubricData = OutputOf<"/rubric/get", "post">;
type RubricResourceType =
  | "names"
  | "descriptions"
  | "flags"
  | "departments"
  | "points"
  | "standard_groups"
  | "standards";

type RubricDraftFormStateCompat = {
  name?: string | null;
  name_id?: string | null;
  description?: string | null;
  description_id?: string | null;
  flag_ids?: string[] | null;
  active?: boolean | null;
  simulation_rubric?: boolean | null;
  video_rubric?: boolean | null;
  department_ids?: string[] | null;
  pass_points_id?: string | null;
  pass_points?: number | null;
  total_points_id?: string | null;
  total_points?: number | null;
  standard_group_ids?: string[] | null;
  standard_groups?: Array<{
    id: string | null;
    name: string;
    description: string;
    points: number;
    pass_points: number;
  }> | null;
  standard_ids?: string[] | null;
  standards?: Array<{
    id: string | null;
    name: string;
    description: string;
    points: number;
    standard_group_id: string;
  }> | null;
  pending_ids?: string[] | null;
};

type RubricDataCompat = RubricData & {
  pending_ids?: string[] | null;
  names?: Array<{
    id?: string | null;
    name?: string | null;
    generated?: boolean | null;
    selected?: boolean | null;
    suggested?: boolean | null;
    pending?: boolean | null;
  }> | null;
  descriptions?: Array<{
    id?: string | null;
    description?: string | null;
    generated?: boolean | null;
    selected?: boolean | null;
    suggested?: boolean | null;
    pending?: boolean | null;
  }> | null;
  flags?: Array<{
    id?: string | null;
    name?: string | null;
    type?: string | null;
    value?: boolean | null;
    description?: string | null;
    icon_id?: string | null;
    icon?: string | null;
    generated?: boolean | null;
    selected?: boolean | null;
    suggested?: boolean | null;
    pending?: boolean | null;
  }> | null;
  departments?: Array<{
    department_id?: string | null;
    id?: string | null;
    name?: string | null;
    description?: string | null;
    generated?: boolean | null;
    selected?: boolean | null;
    suggested?: boolean | null;
    pending?: boolean | null;
  }> | null;
  points?: Array<{
    id?: string | null;
    value?: number | null;
    type?: string | null;
    generated?: boolean | null;
    selected?: boolean | null;
    suggested?: boolean | null;
    pending?: boolean | null;
  }> | null;
  standard_groups?: Array<{
    id?: string | null;
    standard_group_id?: string | null;
    name?: string | null;
    description?: string | null;
    points?: number | null;
    pass_points?: number | null;
    generated?: boolean | null;
    selected?: boolean | null;
    suggested?: boolean | null;
    pending?: boolean | null;
  }> | null;
  standards?: Array<{
    id?: string | null;
    standard_id?: string | null;
    standard_group_id?: string | null;
    name?: string | null;
    description?: string | null;
    points?: number | null;
    generated?: boolean | null;
    selected?: boolean | null;
    suggested?: boolean | null;
    pending?: boolean | null;
  }> | null;
};

// Grid-editor value-object shape. Duplicates StandardValue from
// components/resources/Standards.tsx intentionally — keeps the artifact
// layer independent of picker internals.
type RubricStandardValue = {
  id: string | null;
  name: string;
  description: string;
  points: number;
  standard_group_id: string;
};

// Inline-created standard group value-object. Mirrors
// RubricStandardGroupDraftValue on the server.
type RubricStandardGroupValue = {
  id: string | null;
  name: string;
  description: string;
  points: number;
  pass_points: number;
};

type RubricFormState = {
  name: string | null;
  name_id: string | null;
  description: string | null;
  description_id: string | null;
  // Canonical: ids of the flag-resource rows currently selected. Rubric has
  // three logical flag types (rubric_active, simulation_rubric, video_rubric).
  flag_ids: string[];
  department_ids: string[];
  // Pass points: canonical resource ID + denormalized numeric value (dual mode).
  // Total points: computed from standards; server-returned read-only display.
  pass_points_id: string | null;
  pass_points: number | null;
  total_points: number | null;
  standard_group_ids: string[];
  // Value-object array for inline-created groups. Server resolves
  // id=null entries into fresh standard_groups_resource rows and
  // returns their IDs via form_state.standard_groups.
  standard_groups: RubricStandardGroupValue[] | null;
  standard_ids: string[];
  // Value-object array fed by Standards.tsx grid. Server resolves
  // id=null entries into fresh standards_resource rows and returns
  // their IDs via form_state.standards.
  standards: RubricStandardValue[] | null;
  pending_ids: string[];
};

const FLUSH_KEYS = [
  "names",
  "descriptions",
  "departments",
  "points",
  "standard_groups",
] as const;

const VALID_RESOURCE_TYPES: RubricResourceType[] = [
  "names",
  "descriptions",
  "flags",
  "departments",
  "points",
  "standard_groups",
  "standards",
];

const RUBRIC_RESOURCES: ResourceConfig[] = [
  { key: "names", formKey: "name_id", flushKey: "name_id", type: "single" },
  {
    key: "descriptions",
    formKey: "description_id",
    flushKey: "description_id",
    type: "single",
  },
  { key: "flags", formKey: "flag_ids", flushKey: null, type: "multi" },
  {
    key: "departments",
    formKey: "department_ids",
    flushKey: "department_ids",
    type: "multi",
  },
  {
    key: "points",
    formKey: "pass_points_id",
    flushKey: null,
    type: "single",
  },
  {
    key: "standard_groups",
    formKey: "standard_group_ids",
    flushKey: "standard_group_ids",
    type: "multi",
  },
  {
    key: "standards",
    formKey: "standard_ids",
    flushKey: null,
    type: "multi",
  },
];

export interface RubricProps {
  rubricId?: string;
  rubricData?: RubricData;
  createRubricAction?: (input: CreateRubricIn) => Promise<CreateRubricOut>;
  updateRubricAction?: (input: UpdateRubricIn) => Promise<UpdateRubricOut>;
  patchRubricDraftAction?: (
    input: PatchRubricDraftIn,
  ) => Promise<PatchRubricDraftOut>;
}

function RubricComponent({
  rubricId,
  rubricData,
  createRubricAction,
  updateRubricAction,
  patchRubricDraftAction,
}: RubricProps) {
  const router = useRouter();
  const isEditMode = !!rubricId;
  const s = rubricData as RubricDataCompat | undefined;

  const [formState, setFormState] = useState<RubricFormState>({
    name: null,
    name_id: null,
    description: null,
    description_id: null,
    flag_ids: [],
    department_ids: [],
    pass_points_id: null,
    pass_points: null,
    total_points: null,
    standard_group_ids: [],
    standard_groups: null,
    standard_ids: [],
    standards: null,
    pending_ids: [],
  });

  const { profile } = useProfile();
  const { setSelectedDraftId, isAutosaveEnabled } = useDrafts();
  const { flushRegistryRef } =
    useFlushRegistry<Record<string, unknown>>(FLUSH_KEYS);

  const { isGenerating, generate } = useArtifactAi({
    artifactType: "rubric",
    validResourceTypes: VALID_RESOURCE_TYPES as string[],
  });

  const getInitialFormState = useCallback((): RubricFormState => {
    if (!s) {
      return {
        name: null,
        name_id: null,
        description: null,
        description_id: null,
        flag_ids: [],
        department_ids: [],
        pass_points_id: null,
        pass_points: null,
        total_points: null,
        standard_group_ids: [],
        standard_groups: null,
        standard_ids: [],
        standards: null,
        pending_ids: [],
      };
    }

    return {
      name: null,
      name_id: s.names?.find((item) => item.selected)?.id ?? null,
      description: null,
      description_id: s.descriptions?.find((item) => item.selected)?.id ?? null,
      flag_ids: (s.flags?.filter((item: any) => item.selected) ?? [])
        .map((item: any) => item.id)
        .filter((id: unknown): id is string => !!id),
      department_ids:
        (s.departments ?? [])
          .filter((x) => x.selected)
          ?.map((x) => x.department_id)
          .filter((x): x is string => !!x) ?? [],
      // Pass points comes from the pass-typed selected Points resource.
      pass_points_id:
        s.points?.find((item) => item.type === "pass" && item.selected)?.id ?? null,
      pass_points:
        s.points?.find((item) => item.type === "pass" && item.selected)?.value ?? null,
      // Total is computed server-side — synthetic row with type="total".
      total_points:
        s.points?.find((item) => item.type === "total")?.value ?? null,
      standard_group_ids:
        (s.standard_groups ?? [])
          .filter((x) => x.selected)
          ?.map((x) => x.standard_group_id)
          .filter((x): x is string => !!x) ?? [],
      // Inline-create list — empty on hydrate; populated only when user
      // adds new groups locally. Server echoes resolved ids back on save.
      standard_groups: null,
      standard_ids:
        (s.standards ?? [])
          .filter((x) => x.selected)
          ?.map((x) => x.standard_id)
          .filter((x): x is string => !!x) ?? [],
      // Grid seeds locally from the catalog in Standards.tsx; no need to
      // mirror it in the form state on hydrate. Keep null so the draft
      // payload omits it until the user actually edits a cell.
      standards: null,
      pending_ids: s.pending_ids ?? [],
    };
  }, [s]);

  const formStateRef = React.useRef(formState as Record<string, unknown>);
  useEffect(() => {
    formStateRef.current = formState as Record<string, unknown>;
  }, [formState]);

  // Hydrate from server `s` when it changes (SSR re-fetch after each draft
  // save returns a new draftId). Must set serverSyncPendingRef=true before
  // returning a new state — otherwise the debounce effect reads the fresh
  // formStateKey and patches again, cycling draftId forever. Mirrors
  // Scenario.tsx:787-876.
  useEffect(() => {
    const next = getInitialFormState();
    setFormState((prev) => {
      if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
      // serverSyncPendingRef is destructured from useDraftLifecycle later
      // in the body; the effect body runs post-commit so the binding is
      // already live by then. Not in deps because refs are stable.
      serverSyncPendingRef.current = true;
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getInitialFormState]);

  const formStateKey = useMemo(() => JSON.stringify(formState), [formState]);
  const patchActionRef = React.useRef<
    ((payload: Record<string, unknown>) => Promise<{ draft_id?: string | null }>) | undefined
  >(undefined);

  const lastPatchedFormStateRef = React.useRef<Record<string, unknown> | null>(
    null,
  );
  const hasResourceIds = checkHasResourceIds(
    RUBRIC_RESOURCES,
    formState as unknown as Record<string, unknown>,
  );

  const buildPatchPayload = useCallback(
    (
      inputDraftId: string | null,
      flushResults?: Record<string, unknown>,
    ): Record<string, unknown> => {
      const payload: Record<string, unknown> = {
        input_draft_id: inputDraftId || null,
        group_id: s?.group_id ?? null,
        ...buildDraftPayload(RUBRIC_RESOURCES, {
          formState: formStateRef.current,
          referenceState: lastPatchedFormStateRef.current,
          flushResults: flushResults ?? {},
        }),
      };
      const fs = formStateRef.current as unknown as RubricFormState;
      if (fs.name) {
        payload["name"] = fs.name;
        delete payload["name_id"];
      }
      if (fs.description) {
        payload["description"] = fs.description;
        delete payload["description_id"];
      }
      // Inline-created standard groups: send the value array whenever the
      // user has added any new groups. Server creates rows for id=null
      // entries and merges resolved IDs into `standard_group_ids`.
      if (fs.standard_groups && fs.standard_groups.length > 0) {
        payload["standard_groups"] = fs.standard_groups;
      }
      // Grid-editor standards: send the value array whenever the user has
      // edited any cell. Server creates rows for id=null entries and merges
      // all resolved IDs into `standard_ids` on the response.
      if (fs.standards && fs.standards.length > 0) {
        payload["standards"] = fs.standards;
      }
      payload["pending_ids"] = fs.pending_ids;
      return payload;
    },
    [s],
  );

  // Hook destructure must come BEFORE the patchActionRef effect so that
  // `serverSyncPendingRef` is lexically in scope at the references inside
  // patchActionRef.current's async body. The previous ordering (effect first,
  // destructure after) relied on closure late-binding — technically correct
  // but confusing to read.
  const {
    setUrlFormDataRef,
    onFormDataChange,
    flushAllAndSave,
    formDataRef,
    serverSyncPendingRef,
  } = useDraftLifecycle({
    formStateKey,
    patchActionRef,
    isAutosaveEnabled,
    buildPatchPayload,
    setSelectedDraftId,
    hasResourceIds,
    flushRegistryRef,
    formStateRef,
    onPatchSuccess: () => {
      lastPatchedFormStateRef.current = { ...formStateRef.current };
    },
  });

  useEffect(() => {
    if (!patchRubricDraftAction) {
      patchActionRef.current = undefined;
      return;
    }
    patchActionRef.current = async (payload: Record<string, unknown>) => {
      const res = await patchRubricDraftAction({ body: payload } as PatchRubricDraftIn);
      if (res.form_state) {
        const fs = res.form_state as RubricDraftFormStateCompat;
        setFormState((prev) => {
          const nextNameId =
            (fs.name_id as string | null | undefined) ?? prev.name_id;
          const nextDescriptionId =
            (fs.description_id as string | null | undefined) ??
            prev.description_id;
          const next: RubricFormState = {
            ...prev,
            name_id: nextNameId,
            // Clear value fields only once the server has resolved them to
            // IDs — keeping the value would cause infinite re-saves (value
            // takes precedence → new resource → new id → repeat).
            name: nextNameId ? null : prev.name,
            description_id: nextDescriptionId,
            description: nextDescriptionId ? null : prev.description,
            flag_ids:
              (fs.flag_ids as string[] | null | undefined) ?? prev.flag_ids,
            department_ids:
              (fs.department_ids as string[] | null | undefined) ??
              prev.department_ids,
            pass_points_id:
              (fs.pass_points_id as string | null | undefined) ??
              prev.pass_points_id,
            pass_points:
              (fs.pass_points as number | null | undefined) ??
              // Keep echoed value in sync with id transitions; clear when
              // the id is cleared.
              (fs.pass_points_id === null ? null : prev.pass_points),
            total_points:
              (fs.total_points as number | null | undefined) ??
              prev.total_points,
            standard_group_ids:
              (fs.standard_group_ids as string[] | null | undefined) ??
              prev.standard_group_ids,
            // Inline-created groups: server fills in ids for id=null
            // entries. Replace the whole array so subsequent saves don't
            // re-create the same group.
            standard_groups:
              (fs.standard_groups as RubricStandardGroupValue[] | null | undefined) ??
              prev.standard_groups,
            standard_ids:
              (fs.standard_ids as string[] | null | undefined) ??
              prev.standard_ids,
            // Grid standards: server fills in ids for any id=null entries
            // we just sent. Replace the whole array with the server's
            // resolved version so subsequent saves don't re-create rows.
            standards:
              (fs.standards as RubricStandardValue[] | null | undefined) ??
              prev.standards,
            pending_ids:
              (fs.pending_ids as string[] | null | undefined) ??
              prev.pending_ids,
          };
          // No-op guard: if the server's merged state is identical to what
          // we already have, return prev so formStateKey is unchanged and
          // the debounce effect doesn't re-run. Only set the server-sync
          // flag when we actually have a change to absorb — the hook's
          // own absorb branch will reset the flag after one cycle, so no
          // rAF reset is needed (rAF races with React's commit → effect
          // ordering and can drop the absorb).
          if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
          serverSyncPendingRef.current = true;
          return next;
        });
      }
      return res;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patchRubricDraftAction]);

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

  const handleGenerateResources = useCallback(
    async (resourceTypes: RubricResourceType[], userInstructions?: string) => {
      let currentDraftId =
        (formDataRef.current["draftId"] as string | undefined) ?? null;
      if (!currentDraftId) currentDraftId = await flushAllAndSave();
      if (!currentDraftId) {
        toast.error("Please save a draft before generating with AI");
        return;
      }
      generate(resourceTypes, {
        user_instructions: userInstructions ? [userInstructions] : null,
        draft_id: currentDraftId,
        artifact_id: rubricId || null,
      });
    },
    [
      rubricId,
      generate,
      formDataRef,
      flushAllAndSave,
    ],
  );

  const canRegenerate = useCallback(
    (rt: string): boolean => {
      if (!s) return false;
      switch (rt) {
        case "names":
          return s.names?.find((item) => item.selected)?.generated ?? false;
        case "descriptions":
          return s.descriptions?.find((item) => item.selected)?.generated ?? false;
        case "flags":
          return s.flags?.some((f) => f.selected && f.generated) ?? false;
        case "departments":
          return s.departments?.some((x) => x.selected && x.generated) ?? false;
        case "points":
          return s.points?.find((item) => item.selected)?.generated ?? false;
        case "standard_groups":
          return s.standard_groups?.some((x) => x.selected && x.generated) ?? false;
        case "standards":
          return s.standards?.some((x) => x.selected && x.generated) ?? false;
        default:
          return false;
      }
    },
    [s],
  );

  const stepResources: Record<string, RubricResourceType[]> = useMemo(
    () => ({
      basic: ["names", "descriptions", "flags", "departments", "points"],
      standard_groups: ["standard_groups"],
      standards: ["standards"],
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

  const disabled = useMemo(() => !s?.can_edit, [s?.can_edit]);
  const selectedNameResource = useMemo(
    () => s?.names?.find((item) => item.selected) ?? null,
    [s?.names],
  );
  const selectedDescriptionResource = useMemo(
    () => s?.descriptions?.find((item) => item.selected) ?? null,
    [s?.descriptions],
  );
  // Grid values. Once the user has edited any cell, `formState.standards` is
  // non-null and takes precedence. Until then, seed from the server catalog
  // (standards marked selected under a group that's also selected).
  const standardGridValues = useMemo<RubricStandardValue[]>(() => {
    if (formState.standards !== null) return formState.standards;
    const selectedGroupIds = new Set(formState.standard_group_ids);
    return (s?.standards ?? [])
      .filter(
        (x) =>
          x.selected &&
          x.standard_id &&
          x.name &&
          x.standard_group_id &&
          selectedGroupIds.has(x.standard_group_id),
      )
      .map((x) => ({
        id: x.standard_id as string,
        name: x.name as string,
        description: x.description ?? "",
        points: x.points ?? 0,
        standard_group_id: x.standard_group_id as string,
      }));
  }, [formState.standards, formState.standard_group_ids, s?.standards]);

  const handleSubmit = useCallback(
    async (_formData: Record<string, unknown>) => {
      const flushResults = isAutosaveEnabled
        ? {}
        : await (async () => {
            const entries = await Promise.all(
              Object.values(flushRegistryRef.current).map((fn) => fn()),
            );
            return entries.reduce<Record<string, unknown>>((acc, cur) => {
              if (cur && typeof cur === "object") Object.assign(acc, cur);
              return acc;
            }, {});
          })();

      const effectiveFormState = computeEffectiveFormState(
        RUBRIC_RESOURCES,
        formStateRef.current,
        flushResults,
      ) as unknown as RubricFormState;

      if (!effectiveFormState.name_id) {
        throw new Error("Rubric name is required");
      }
      if (effectiveFormState.department_ids.length === 0) {
        throw new Error("Department is required");
      }
      if (!profile?.id) {
        throw new Error("Profile not loaded");
      }
      if (!s?.group_id) {
        throw new Error("Missing group_id");
      }

      // Pass points: prefer id (already resolved), fall back to numeric value
      // for the server's dual-mode resolver. Total is computed server-side and
      // is never sent on write.
      const passPointsPayload = effectiveFormState.pass_points_id
        ? { pass_points_id: effectiveFormState.pass_points_id }
        : effectiveFormState.pass_points != null
          ? { pass_points: effectiveFormState.pass_points }
          : {};

      // Create/Update endpoints still accept per-type flag ids; derive each
      // slot from the canonical flag_ids list by matching the flag's type.
      const flagsById = new Map(
        (s?.flags ?? [])
          .filter((f: any) => f.id)
          .map((f: any) => [f.id as string, f]),
      );
      const pickFlagIdByType = (type: string): string | undefined => {
        for (const fid of effectiveFormState.flag_ids ?? []) {
          const row: any = flagsById.get(fid);
          if ((row?.type ?? row?.name) === type) return fid;
        }
        return undefined;
      };
      const activeFlagId = pickFlagIdByType("rubric_active");
      const simulationRubricFlagId = pickFlagIdByType("simulation_rubric");
      const videoRubricFlagId = pickFlagIdByType("video_rubric");

      if (isEditMode) {
        if (!updateRubricAction) throw new Error("Update action not available");
        await updateRubricAction({
          body: {
            rubrics: [
              {
                id: rubricId!,
                name_id: effectiveFormState.name_id ?? undefined,
                description_id: effectiveFormState.description_id ?? undefined,
                active_flag_id: activeFlagId,
                simulation_rubric_flag_id: simulationRubricFlagId,
                video_rubric_flag_id: videoRubricFlagId,
                department_ids: effectiveFormState.department_ids?.length
                  ? effectiveFormState.department_ids
                  : undefined,
                ...passPointsPayload,
                standard_group_ids: effectiveFormState.standard_group_ids?.length
                  ? effectiveFormState.standard_group_ids
                  : undefined,
                standard_ids: effectiveFormState.standard_ids?.length
                  ? effectiveFormState.standard_ids
                  : undefined,
              },
            ],
            group_id: s.group_id,
          },
        } as UpdateRubricIn);
      } else {
        if (!createRubricAction) throw new Error("Create action not available");
        await createRubricAction({
          body: {
            rubrics: [
              {
                name_id: effectiveFormState.name_id!,
                description_id: effectiveFormState.description_id ?? undefined,
                active_flag_id: activeFlagId,
                simulation_rubric_flag_id: simulationRubricFlagId,
                video_rubric_flag_id: videoRubricFlagId,
                department_ids: effectiveFormState.department_ids?.length
                  ? effectiveFormState.department_ids
                  : undefined,
                ...passPointsPayload,
                standard_group_ids: effectiveFormState.standard_group_ids?.length
                  ? effectiveFormState.standard_group_ids
                  : undefined,
                standard_ids: effectiveFormState.standard_ids?.length
                  ? effectiveFormState.standard_ids
                  : undefined,
              },
            ],
            group_id: s.group_id,
          },
        } as CreateRubricIn);
      }

      toast.success(`Rubric ${isEditMode ? "updated" : "created"} successfully!`);
      router.push("/system/rubrics");
    },
    [
      isAutosaveEnabled,
      flushRegistryRef,
      s,
      profile?.id,
      createRubricAction,
      updateRubricAction,
      isEditMode,
      rubricId,
      router,
    ],
  );

  const getStepStatus = useCallback(
    (stepId: string): StepStatus => {
      switch (stepId) {
        case "basic":
          return formState.name_id && formState.description_id
            ? "completed"
            : "active";
        case "standard_groups":
          return formState.standard_group_ids.length > 0 ? "completed" : "active";
        case "standards":
          return formState.standard_ids.length > 0 ? "completed" : "active";
        default:
          return "active";
      }
    },
    [formState],
  );

  const steps = useMemo(
    () => [
      {
        id: "basic",
        title: "Basic Information",
        description:
          "Set rubric name, description, departments, pass threshold, and active status.",
        resetFields: [
          "name_id",
          "description_id",
          "flag_ids",
          "department_ids",
          "pass_points_id",
          "pass_points",
        ],
      },
      {
        id: "standard_groups",
        title: "Standard Groups",
        description: "Choose standard groups.",
        resetFields: ["standard_group_ids"],
      },
      {
        id: "standards",
        title: "Standards",
        description: "Choose standards.",
        resetFields: ["standard_ids"],
      },
    ],
    [],
  );

  const formFieldKeys = useMemo(
    () => [
      "name_id",
      "description_id",
      "flag_ids",
      "department_ids",
      "pass_points_id",
      "pass_points",
      "standard_group_ids",
      "standard_ids",
      "pending_ids",
    ],
    [],
  );

  // --- Flag helpers (canonical flag_ids pattern) ---
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

  const renderStep = useCallback(
    ({
      stepId,
      stepStatus,
      stepTitle,
      stepDescription,
      stepNumber,
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
      onReset?: () => void;
    }) => {
      if (stepId === "basic") {
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
                name_id={formState.name_id}
                name_resource={selectedNameResource}
                show_name={true}
                names={s?.names ?? []}
                disabled={disabled}
                onNameIdChange={handleNameIdChange}
                onNameChange={handleNameChange}
                placeholder="e.g., Sales Call Rubric"
                defaultName="New Rubric"
                required={true}
                hideDescription={true}
              />
            }
            resetFields={[
              "name_id",
              "description_id",
              "flag_ids",
              "department_ids",
            ]}
            actions={
              s?.basic_show_ai_generate ? (
                <StepCardAiButton
                  stepId="basic"
                  resourceTypes={stepResources["basic"] ?? []}
                  canRegenerate={(rt) =>
                    canRegenerate(rt as RubricResourceType)
                  }
                  isGenerating={(rt) =>
                    isGenerating(rt as RubricResourceType)
                  }
                  onOpenModal={handleDirectStepGenerate}
                  disabled={disabled}
                />
              ) : undefined
            }
            {...(onReset ? { onReset } : {})}
          >
            <div className="space-y-4">
              <Descriptions
                description_id={formState.description_id}
                description_resource={selectedDescriptionResource}
                show_description={true}
                descriptions={s?.descriptions ?? []}
                disabled={disabled}
                onDescriptionIdChange={handleDescriptionIdChange}
                onDescriptionChange={handleDescriptionChange}
                required={false}
              />

              <Departments
                department_ids={formState.department_ids}
                department_resources={(s?.departments ?? []).filter((item) => item.selected)}
                show_departments={true}
                departments={s?.departments ?? []}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({ ...prev, department_ids: ids }))
                }
                required={true}
              />

              <Flags
                flags={s?.flags ?? []}
                values={flagValues}
                show_flags={Boolean((s?.flags ?? []).length)}
                columns={2}
                label="Flags"
                disabled={disabled}
                onChange={handleFlagToggle}
              />

              {/* Pass points is user-writeable; total is computed server-side
                  and rendered read-only. Pass points suggestions come from
                  the pass-typed Points resources returned by GET. */}
              <div className="flex items-end gap-6 flex-wrap">
                <Points
                  mode="picker"
                  label="Pass Points"
                  value={formState.pass_points}
                  points={s?.points ?? []}
                  filterType="pass"
                  disabled={disabled}
                  required={true}
                  onChange={(v) =>
                    setFormState((prev) => ({
                      ...prev,
                      pass_points: v,
                      // Invalidate id so the server re-resolves from the value.
                      pass_points_id: null,
                    }))
                  }
                />
                <Points
                  mode="readonly"
                  label="Total Points"
                  value={formState.total_points}
                />
              </div>
            </div>
          </StepCard>
        );
      }


      if (stepId === "standard_groups") {
        return (
          <StepCard
            stepStatus={stepStatus}
            stepNumber={stepNumber}
            stepTitle={stepTitle}
            stepDescription={stepDescription}
            isReadonly={disabled}
            isEditMode={isEditMode}
            resetFields={["standard_group_ids"]}
            actions={
              s?.content_show_ai_generate ? (
                <StepCardAiButton
                  stepId="standard_groups"
                  resourceTypes={stepResources["standard_groups"] ?? []}
                  canRegenerate={(rt) =>
                    canRegenerate(rt as RubricResourceType)
                  }
                  isGenerating={(rt) =>
                    isGenerating(rt as RubricResourceType)
                  }
                  onOpenModal={handleDirectStepGenerate}
                  disabled={disabled}
                />
              ) : undefined
            }
            {...(onReset ? { onReset } : {})}
          >
            <StandardGroups
              standard_group_ids={formState.standard_group_ids}
              standard_group_resources={(s?.standard_groups ?? []).filter((item) => item.selected)}
              show_standard_groups={true}
              standard_groups={s?.standard_groups ?? []}
              disabled={disabled}
              onChange={(ids) =>
                setFormState((prev) => ({ ...prev, standard_group_ids: ids }))
              }
              onCreate={(draft) =>
                setFormState((prev) => ({
                  ...prev,
                  standard_groups: [
                    ...(prev.standard_groups ?? []),
                    { id: null, ...draft },
                  ],
                }))
              }
              required={true}
            />
          </StepCard>
        );
      }

      return (
        <StepCard
          stepStatus={stepStatus}
          stepNumber={stepNumber}
          stepTitle={stepTitle}
          stepDescription={stepDescription}
          isReadonly={disabled}
          isEditMode={isEditMode}
          resetFields={["standard_ids"]}
          actions={
            s?.content_show_ai_generate ? (
              <StepCardAiButton
                stepId="standards"
                resourceTypes={stepResources["standards"] ?? []}
                canRegenerate={(rt) =>
                  canRegenerate(rt as RubricResourceType)
                }
                isGenerating={(rt) =>
                  isGenerating(rt as RubricResourceType)
                }
                onOpenModal={handleDirectStepGenerate}
                disabled={disabled}
              />
            ) : undefined
          }
          {...(onReset ? { onReset } : {})}
        >
          <Standards
            values={standardGridValues}
            standard_group_ids={formState.standard_group_ids}
            standard_groups={s?.standard_groups ?? []}
            show_standards={true}
            disabled={disabled}
            onValuesChange={(next) => {
              setFormState((prev) => {
                const nextIds = next
                  .map((v) => v.id)
                  .filter((x): x is string => !!x);
                const prevIdsStr = JSON.stringify(prev.standard_ids);
                const nextIdsStr = JSON.stringify(nextIds);
                const prevValsStr = JSON.stringify(prev.standards);
                const nextValsStr = JSON.stringify(next);
                if (prevIdsStr === nextIdsStr && prevValsStr === nextValsStr) {
                  return prev;
                }
                return { ...prev, standard_ids: nextIds, standards: next };
              });
            }}
            required={true}
          />
        </StepCard>
      );
    },
    [
      disabled,
      isEditMode,
      formState,
      s,
      handleGenerateResources,
      isGenerating,
      stepResources,
      canRegenerate,
      handleDirectStepGenerate,
      selectedNameResource,
      selectedDescriptionResource,
      standardGridValues,
    ],
  );

  const rubricSearchParamsClient = useMemo(
    () => ({
      draftId: parseAsString,
      descriptionSearch: parseAsString,
      standardGroupSearch: parseAsString,
      pointsSearch: parseAsString,
      pointsShowSelected: parseAsBoolean,
      standardGroupShowSelected: parseAsBoolean,
    }),
    [],
  );

  return (
    <TooltipProvider>
      <div className="w-full p-6 space-y-8" data-page={`rubric-${isEditMode ? "edit" : "new"}`}>
        <ReadOnlyBanner
          disabled={disabled}
          disabledReason={s?.disabled_reason ?? null}
          entityType="rubric"
        />
        <GenericForm
          nuqsParsers={rubricSearchParamsClient as Record<string, Parser<unknown>>}
          steps={steps}
          getStepStatus={getStepStatus}
          serverData={s}
          formFieldKeys={formFieldKeys}
          resetSuccessMessage={() => "Step reset"}
          onReset={(stepId) => {
            if (stepId === "basic") {
              setFormState((prev) => ({
                ...prev,
                name: null,
                name_id: null,
                description: null,
                description_id: null,
                flag_ids: [],
                department_ids: [],
                pass_points_id: null,
                pass_points: null,
              }));
            }
            if (stepId === "standard_groups") {
              setFormState((prev) => ({
                ...prev,
                standard_group_ids: [],
                standard_groups: null,
              }));
            }
            if (stepId === "standards") {
              setFormState((prev) => ({ ...prev, standard_ids: [] }));
            }
          }}
          onSubmit={handleSubmit}
          submitButton={{
            backUrl: "/system/rubrics",
            backLabel: "Back",
            createLabel: "Create Rubric",
            updateLabel: "Update Rubric",
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
    </TooltipProvider>
  );
}

export default React.memo(RubricComponent);
