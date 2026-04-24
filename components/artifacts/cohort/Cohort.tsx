/**
 * Cohort.tsx
 * Implementation using modular resource components
 * Used to create and manage cohorts - supports both creation and editing
 * Follows Persona.tsx pattern, adapted for cohorts
 * @AshokSaravanan222 & @siladiea
 * 01/12/2026
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
import { ProfilePersonas } from "@/components/resources/ProfilePersonas";
import { Profiles } from "@/components/resources/Profiles";
import { Flags } from "@/components/resources/Flags";
import { Names } from "@/components/resources/Names";
import {
  SimulationAvailability,
} from "@/components/resources/SimulationAvailability";
import {
  SimulationPositions,
  type SimulationPositionItem,
} from "@/components/resources/SimulationPositions";
import { Simulations } from "@/components/resources/Simulations";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useProfile } from "@/contexts/profile-context";
import { useDrafts } from "@/contexts/draft-context";
import { useCohortAi } from "@/hooks/use-cohort-ai";
import { useDraftLifecycle } from "@/hooks/use-draft-lifecycle";
import { useFlushRegistry } from "@/hooks/use-flush-registry";
import type { InputOf, OutputOf } from "@/lib/api/types";
import {
  checkHasResourceIds,
  computeEffectiveFormState,
  type ResourceConfig,
} from "@/lib/resources/action-builders";
import type { ResourceType } from "@/lib/resources/types";
import { parseAsBoolean, parseAsString, type Parser } from "nuqs";

// Types defined inline using InputOf/OutputOf
type CreateCohortIn = InputOf<"/cohort/create", "post">;
type CreateCohortOut = OutputOf<"/cohort/create", "post">;
type UpdateCohortIn = InputOf<"/cohort/update", "post">;
type UpdateCohortOut = OutputOf<"/cohort/update", "post">;
type PatchCohortDraftIn = InputOf<"/cohort/draft", "patch">;
type PatchCohortDraftOut = OutputOf<"/cohort/draft", "patch">;

type CohortData = OutputOf<"/cohort/get", "post">;

// Type for flush results - each resource returns its created ID(s)
type FlushResult = {
  name_id?: string | null;
  description_id?: string | null;
  simulation_position_ids?: string[] | null;
  simulation_availability_ids?: string[] | null;
  profile_persona_ids?: string[] | null;
};

type CohortFormState = {
  name_id: string | null;
  description_id: string | null;
  flag_ids: string[];
  department_ids: string[];
  simulation_ids: string[];
  simulation_position_ids: string[];
  simulation_availability_ids: string[];
  simulation_positions: SimulationPositionItem[];
  profile_ids: string[];
  profile_persona_ids: string[];
  // Value fields for unified draft (creatable resources)
  name: string | null;
  description: string | null;
  simulation_position_values: Array<{ simulation_id: string; value: number }> | null;
  simulation_availability_values: Array<{ simulation_id: string; time: string; type: string }> | null;
  profile_persona_values: Array<{ profile_id: string; persona_id: string }> | null;
  pending_ids: string[];
};

export interface CohortProps {
  cohortId?: string;
  // Server-provided data (for server-side rendering)
  cohortData?: CohortData;
  // Server actions (replaces useMutation)
  createCohortAction?: (input: CreateCohortIn) => Promise<CreateCohortOut>;
  updateCohortAction?: (input: UpdateCohortIn) => Promise<UpdateCohortOut>;
  patchCohortDraftAction?: (
    input: PatchCohortDraftIn,
  ) => Promise<PatchCohortDraftOut>;
}

const COHORT_RESOURCES: ResourceConfig[] = [
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
    flushKey: null,
    type: "multi",
  },
  {
    key: "simulations",
    formKey: "simulation_ids",
    flushKey: null,
    type: "multi",
  },
  {
    key: "simulation_positions",
    formKey: "simulation_position_ids",
    flushKey: "simulation_position_ids",
    type: "multi",
  },
  {
    key: "simulation_availability",
    formKey: "simulation_availability_ids",
    flushKey: "simulation_availability_ids",
    type: "multi",
  },
  {
    key: "profiles",
    formKey: "profile_ids",
    flushKey: null,
    type: "multi",
  },
  {
    key: "profile_personas",
    formKey: "profile_persona_ids",
    flushKey: "profile_persona_ids",
    type: "multi",
  },
];

function isSelected(item?: { selected?: boolean | null } | null): boolean {
  return item?.selected === true;
}

function isPending(item?: { pending?: boolean | null } | null): boolean {
  return item?.pending === true;
}

function collectPendingIds(data?: CohortData | null): string[] {
  if (!data) return [];

  const ids = new Set<string>(data.pending_ids ?? []);

  for (const item of data.names ?? []) {
    if (isPending(item) && item.id) ids.add(item.id);
  }
  for (const item of data.descriptions ?? []) {
    if (isPending(item) && item.id) ids.add(item.id);
  }
  for (const item of data.flags ?? []) {
    if (isPending(item) && item.id) ids.add(item.id);
  }
  for (const item of data.departments ?? []) {
    if (isPending(item) && item.department_id) ids.add(item.department_id);
  }
  for (const item of data.simulations ?? []) {
    if (isPending(item) && item.simulation_id) ids.add(item.simulation_id);
  }
  for (const item of data.simulation_positions ?? []) {
    if (isPending(item) && item.id) ids.add(item.id);
  }
  for (const item of data.simulation_availability ?? []) {
    if (isPending(item) && item.id) ids.add(item.id);
  }
  for (const item of data.profiles ?? []) {
    if (isPending(item) && item.profile_id) ids.add(item.profile_id);
  }
  for (const item of data.profile_personas ?? []) {
    if (isPending(item) && item.id) ids.add(item.id);
  }

  return Array.from(ids);
}

function CohortComponent({
  cohortId,
  cohortData,
  createCohortAction,
  updateCohortAction,
  patchCohortDraftAction,
}: CohortProps) {
  const router = useRouter();
  const isEditMode = !!cohortId;
  const { profile } = useProfile();
  const { setSelectedDraftId, isAutosaveEnabled } = useDrafts();

  // --- Flush Registry ---
  const { flushRegistryRef, flushAllResources } =
    useFlushRegistry<FlushResult>([]);

  // --- AI Generation ---
  const { isGenerating, generate } = useCohortAi({});

  // nuqs parsers for URL-backed state (will be passed to GenericForm)
  // Memoize to prevent new object reference on every render
  const cohortSearchParamsClient = useMemo(
    () => ({
      // Draft ID (URL-backed, updated when draft is created)
      draftId: parseAsString,
      // Search params (URL-backed, updated via debounced callback in StepCard)
      descriptionSearch: parseAsString,
      simulationSearch: parseAsString,
      profileSearch: parseAsString,
      // Filter params (URL-backed)
      simulationShowSelected: parseAsBoolean,
      profileShowSelected: parseAsBoolean,
    }),
    [],
  );

  // Local form state (not in URL) - stores only resource IDs
  // Display values are managed inside resource components
  // Use ref to store cohortData to prevent callback recreation on every render
  const cohortDataRef = React.useRef(cohortData);
  React.useEffect(() => {
    cohortDataRef.current = cohortData;
  }, [cohortData]);

  // Memoize cohortData fields used in renderStep to prevent callback recreation
  // when only object reference changes (but content is same)
  const stableCohortDataFields = React.useMemo(() => {
    if (!cohortData) return null;
    return {
      names: cohortData.names,
      descriptions: cohortData.descriptions,
      flags: cohortData.flags,
      departments: cohortData.departments,
      simulations: cohortData.simulations,
      simulation_positions: cohortData.simulation_positions,
      simulation_availability: cohortData.simulation_availability,
      profiles: cohortData.profiles,
      profile_personas: cohortData.profile_personas,
      personas: cohortData.personas,
      basic_show_ai_generate: cohortData.basic_show_ai_generate,
      simulations_step_show_ai_generate:
        cohortData.simulations_step_show_ai_generate,
      profiles_step_show_ai_generate:
        cohortData.profiles_step_show_ai_generate,
      show_ai_generate: cohortData.show_ai_generate,
      pending_ids: cohortData.pending_ids,
    };
    // Intentionally depend on individual fields, not whole cohortData object
    // to prevent recreation when only object reference changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    cohortData?.names,
    cohortData?.descriptions,
    cohortData?.departments,
    cohortData?.flags,
    cohortData?.simulations,
    cohortData?.simulation_positions,
    cohortData?.simulation_availability,
    cohortData?.profiles,
    cohortData?.profile_personas,
    cohortData?.personas,
    cohortData?.basic_show_ai_generate,
    cohortData?.simulations_step_show_ai_generate,
    cohortData?.profiles_step_show_ai_generate,
    cohortData?.show_ai_generate,
    cohortData?.pending_ids,
  ]);

  // Helper to check if a resource type can be regenerated
  // Use stableCohortDataFields to prevent callback recreation when cohortData object reference changes
  const canRegenerate = useCallback(
    (resourceType: string): boolean => {
      if (!stableCohortDataFields) return false;
      switch (resourceType) {
        case "names":
          return (
            stableCohortDataFields.names?.find((n) => n.selected)?.generated ??
            false
          );
        case "descriptions":
          return (
            stableCohortDataFields.descriptions?.find((d) => d.selected)
              ?.generated ?? false
          );
        case "flags":
          return (
            stableCohortDataFields.flags?.find((f) => f.selected)?.generated ??
            false
          );
        case "departments":
          return (
            stableCohortDataFields.departments
              ?.filter((d) => d.selected)
              .some(
              (d) => d.generated,
            ) ?? false
          );
        case "simulations":
          return (
            stableCohortDataFields.simulations
              ?.filter((s) => s.selected)
              .some(
              (s) => s.generated,
            ) ?? false
          );
        case "simulation_positions":
          return (
            stableCohortDataFields.simulation_positions
              ?.filter((p) => p.selected)
              .some(
              (p) => p.generated,
            ) ?? false
          );
        case "simulation_availability":
          return (
            stableCohortDataFields.simulation_availability
              ?.filter((a) => a.selected)
              .some(
              (a) => a.generated,
            ) ?? false
          );
        case "profiles":
          return (
            stableCohortDataFields.profiles
              ?.filter((p) => p.selected)
              .some(
              (p) => p.generated,
            ) ?? false
          );
        case "profile_personas":
          return (
            stableCohortDataFields.profile_personas
              ?.filter((pp) => pp.selected)
              .some(
              (pp) => pp.generated,
            ) ?? false
          );
        default:
          return false;
      }
    },
    [stableCohortDataFields],
  );

  const getInitialFormState = useCallback(() => {
    const data = cohortDataRef.current;
    if (!data) {
      return {
        name_id: null as string | null,
        description_id: null as string | null,
        flag_ids: [] as string[],
        department_ids: [] as string[],
        simulation_ids: [] as string[],
        simulation_position_ids: [] as string[],
        simulation_availability_ids: [] as string[],
        simulation_positions: [] as SimulationPositionItem[],
        profile_ids: [] as string[],
        profile_persona_ids: [] as string[],
        name: null as string | null,
        description: null as string | null,
        simulation_position_values: null as Array<{ simulation_id: string; value: number }> | null,
        simulation_availability_values: null as Array<{ simulation_id: string; time: string; type: string }> | null,
        profile_persona_values: null as Array<{ profile_id: string; persona_id: string }> | null,
        pending_ids: [] as string[],
      };
    }
    const selectedPositions = (data.simulation_positions ?? []).filter(
      isSelected,
    );
    return {
      name_id: data.names?.find(isSelected)?.id ?? null,
      description_id: data.descriptions?.find(isSelected)?.id ?? null,
      flag_ids: (data.flags?.filter(isSelected) ?? [])
        .map((f) => f.id)
        .filter((id): id is string => !!id),
      department_ids: (data.departments?.filter(isSelected) ?? [])
        .map((d) => d.department_id)
        .filter((id): id is string => !!id),
      simulation_ids: (data.simulations?.filter(isSelected) ?? [])
        .map((s) => s.simulation_id)
        .filter((id): id is string => !!id),
      simulation_position_ids: selectedPositions
        .map((p) => p.id)
        .filter((id): id is string => !!id),
      simulation_availability_ids: (data.simulation_availability?.filter(isSelected) ?? [])
        .map((a) => a.id)
        .filter((id): id is string => !!id),
      profile_ids: (data.profiles?.filter(isSelected) ?? [])
        .map((p) => p.profile_id)
        .filter((id): id is string => !!id),
      profile_persona_ids: (data.profile_personas?.filter(isSelected) ?? [])
        .map((pp) => pp.id)
        .filter((id): id is string => !!id),
      simulation_positions: selectedPositions.map(
        (p) => ({
          simulation_id: p.simulation_id ?? "",
          value: p.value ?? 0,
          generated: p.generated ?? false,
          mcp: p.mcp ?? false,
        }),
      ),
      name: null,
      description: null,
      simulation_position_values: null,
      simulation_availability_values: null,
      profile_persona_values: null,
      pending_ids: collectPendingIds(data),
    };
    // Remove cohortData from dependencies - use ref instead to prevent callback recreation
  }, []);

  const [formState, setFormState] =
    useState<CohortFormState>(getInitialFormState);
  // Use ref to access formState in renderStep without depending on it
  const formStateRef = React.useRef<Record<string, unknown>>(
    formState as unknown as Record<string, unknown>,
  );
  React.useEffect(() => {
    formStateRef.current = formState as unknown as Record<string, unknown>;
  }, [formState]);

  // Per-type boolean view of flag_ids, built from the catalog. Rendered by Flags.
  const flagValues = React.useMemo<Record<string, boolean | null>>(() => {
    const map: Record<string, boolean | null> = {};
    const byId = new Map(
      (cohortData?.flags ?? [])
        .filter((f) => f.id)
        .map((f) => [f.id as string, f]),
    );
    for (const id of formState.flag_ids) {
      const row = byId.get(id);
      if (!row) continue;
      const t = row.type ?? row.name;
      if (t && row.value != null) map[t] = row.value;
    }
    return map;
  }, [formState.flag_ids, cohortData?.flags]);

  // Rows grouped by flag type — used when a toggle swaps between true/false ids.
  type FlagRow = NonNullable<NonNullable<typeof cohortData>["flags"]>[number];
  const flagRowsByType = React.useMemo(() => {
    const map = new Map<string, FlagRow[]>();
    for (const f of cohortData?.flags ?? []) {
      const t = f.type ?? f.name;
      if (!t) continue;
      const list = map.get(t) ?? [];
      list.push(f);
      map.set(t, list);
    }
    return map;
  }, [cohortData?.flags]);

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
        return {
          ...prev,
          flag_ids: nextIds,
          pending_ids: prev.pending_ids.filter(
            (id) => !rowIdsForType.has(id) || nextIds.includes(id),
          ),
        };
      });
    },
    [flagRowsByType],
  );

  // Memoize stringified array dependencies to prevent effect from running when array references change but content is same
  const departmentIdsStr = React.useMemo(
    () =>
      JSON.stringify(
        (cohortData?.departments?.filter(isSelected) ?? [])
          .map((d) => d.department_id)
          .filter(Boolean),
      ),
    [cohortData?.departments],
  );
  const simulationIdsStr = React.useMemo(
    () =>
      JSON.stringify(
        (cohortData?.simulations?.filter(isSelected) ?? [])
          .map((s) => s.simulation_id)
          .filter(Boolean),
      ),
    [cohortData?.simulations],
  );
  const simulationPositionsStr = React.useMemo(
    () =>
      JSON.stringify(
        (cohortData?.simulation_positions?.filter(isSelected) ?? []).map(
          (position) => ({
            id: position.id ?? null,
            simulation_id: position.simulation_id ?? null,
            value: position.value ?? null,
          }),
        ),
      ),
    [cohortData?.simulation_positions],
  );
  const simulationAvailabilityIdsStr = React.useMemo(
    () =>
      JSON.stringify(
        (cohortData?.simulation_availability?.filter(isSelected) ?? [])
          .map((a) => a.id)
          .filter(Boolean),
      ),
    [cohortData?.simulation_availability],
  );
  const profileIdsStr = React.useMemo(
    () =>
      JSON.stringify(
        (cohortData?.profiles?.filter(isSelected) ?? [])
          .map((p) => p.profile_id)
          .filter(Boolean),
      ),
    [cohortData?.profiles],
  );
  const profilePersonaIdsStr = React.useMemo(
    () =>
      JSON.stringify(
        (cohortData?.profile_personas?.filter(isSelected) ?? [])
          .map((pp) => pp.id)
          .filter(Boolean),
      ),
    [cohortData?.profile_personas],
  );

  // --- Draft Lifecycle ---
  // Stable ref wrapper for patch action
  const patchActionRef = React.useRef<
    | ((
        payload: Record<string, unknown>,
      ) => Promise<{ draft_id?: string | null }>)
    | undefined
  >(undefined);

  // formStateKey excludes draftId -- the hook prepends it.
  // Append-only: every formState change produces a new key and triggers a save
  // that sends the full current state.
  const formStateKey = React.useMemo(
    () =>
      JSON.stringify({
        name_id: formState.name_id,
        description_id: formState.description_id,
        flag_ids: formState.flag_ids,
        department_ids: formState.department_ids,
        simulation_ids: formState.simulation_ids,
        simulation_position_ids: formState.simulation_position_ids,
        simulation_availability_ids: formState.simulation_availability_ids,
        simulation_positions: formState.simulation_positions,
        profile_ids: formState.profile_ids,
        profile_persona_ids: formState.profile_persona_ids,
        name: formState.name,
        description: formState.description,
        simulation_position_values: formState.simulation_position_values,
        simulation_availability_values: formState.simulation_availability_values,
        profile_persona_values: formState.profile_persona_values,
        pending_ids: formState.pending_ids,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      formState.name_id,
      formState.description_id,
      // eslint-disable-next-line react-hooks/exhaustive-deps
      JSON.stringify(formState.flag_ids),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      JSON.stringify(formState.department_ids),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      JSON.stringify(formState.simulation_ids),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      JSON.stringify(formState.simulation_position_ids),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      JSON.stringify(formState.simulation_availability_ids),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      JSON.stringify(formState.simulation_positions),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      JSON.stringify(formState.profile_ids),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      JSON.stringify(formState.profile_persona_ids),
      formState.name,
      formState.description,
      // eslint-disable-next-line react-hooks/exhaustive-deps
      JSON.stringify(formState.simulation_position_values),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      JSON.stringify(formState.simulation_availability_values),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      JSON.stringify(formState.profile_persona_values),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      JSON.stringify(formState.pending_ids),
    ],
  );

  // Autosave gate: IDs OR any value/pending field present. Without the value
  // check, typing a name/description before a picker resolves an ID would
  // never trigger a save.
  const hasResourceIds =
    checkHasResourceIds(
      COHORT_RESOURCES,
      formState as unknown as Record<string, unknown>,
    ) ||
    !!formState.name ||
    !!formState.description ||
    (formState.simulation_position_values?.length ?? 0) > 0 ||
    (formState.simulation_availability_values?.length ?? 0) > 0 ||
    (formState.profile_persona_values?.length ?? 0) > 0 ||
    formState.pending_ids.length > 0;

  // Append-only: always send full current state as a complete snapshot.
  // Values take precedence over IDs for creatables (server resolves value→id,
  // echoes id back, local state clears the value on next merge).
  const buildPatchPayload = useCallback((): Record<string, unknown> => {
    const current = formStateRef.current as unknown as CohortFormState;
    const payload: Record<string, unknown> = {};

    if (current.name != null) {
      payload["name"] = current.name;
    } else if (current.name_id) {
      payload["name_id"] = current.name_id;
    }

    if (current.description != null) {
      payload["description"] = current.description;
    } else if (current.description_id) {
      payload["description_id"] = current.description_id;
    }

    if (current.flag_ids.length > 0) {
      payload["flag_ids"] = current.flag_ids;
    }
    if (current.department_ids.length > 0) {
      payload["department_ids"] = current.department_ids;
    }
    if (current.simulation_ids.length > 0) {
      payload["simulation_ids"] = current.simulation_ids;
    }
    if (current.profile_ids.length > 0) {
      payload["profile_ids"] = current.profile_ids;
    }

    // Compound values: prefer the value array; fall back to IDs once the
    // server has resolved them.
    if (current.simulation_position_values?.length) {
      payload["simulation_positions"] = current.simulation_position_values;
    } else if (current.simulation_position_ids.length > 0) {
      payload["simulation_position_ids"] = current.simulation_position_ids;
    }

    if (current.simulation_availability_values?.length) {
      payload["simulation_availability"] =
        current.simulation_availability_values;
    } else if (current.simulation_availability_ids.length > 0) {
      payload["simulation_availability_ids"] =
        current.simulation_availability_ids;
    }

    if (current.profile_persona_values?.length) {
      payload["profile_personas"] = current.profile_persona_values;
    } else if (current.profile_persona_ids.length > 0) {
      payload["profile_persona_ids"] = current.profile_persona_ids;
    }

    if (current.pending_ids.length > 0) {
      payload["pending_ids"] = current.pending_ids;
    }

    return payload;
  }, []);

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
    flushRegistryRef,
    formStateRef,
  });

  // --- Stable value-change handlers (extracted from inline arrows) ---
  const handleNameIdChange = useCallback((nameId: string | null) => {
    setFormState((prev) => ({
      ...prev,
      name_id: nameId,
      name: null,
      pending_ids: prev.pending_ids.filter((id) => id !== prev.name_id),
    }));
  }, []);

  const handleNameChange = useCallback((name: string) => {
    setFormState((prev) => ({
      ...prev,
      name,
      name_id: null,
      pending_ids: prev.pending_ids.filter((id) => id !== prev.name_id),
    }));
  }, []);

  const handleDescriptionIdChange = useCallback((descriptionId: string | null) => {
    setFormState((prev) => ({
      ...prev,
      description_id: descriptionId,
      description: null,
      pending_ids: prev.pending_ids.filter((id) => id !== prev.description_id),
    }));
  }, []);

  const handleDescriptionChange = useCallback((description: string) => {
    setFormState((prev) => ({
      ...prev,
      description,
      description_id: null,
      pending_ids: prev.pending_ids.filter((id) => id !== prev.description_id),
    }));
  }, []);

  // Update form state when server data changes
  // Use cohortData directly in dependency array, not getInitialFormState
  useEffect(() => {
    const newState = getInitialFormState();
    setFormState((prev) => {
      // Only update if resource IDs actually changed
      if (
        prev.name_id !== newState.name_id ||
        prev.description_id !== newState.description_id ||
        JSON.stringify(prev.flag_ids) !== JSON.stringify(newState.flag_ids) ||
        JSON.stringify(prev.department_ids) !==
          JSON.stringify(newState.department_ids) ||
        JSON.stringify(prev.simulation_ids) !==
          JSON.stringify(newState.simulation_ids) ||
        JSON.stringify(prev.simulation_positions) !==
          JSON.stringify(newState.simulation_positions) ||
        JSON.stringify(prev.simulation_availability_ids) !==
          JSON.stringify(newState.simulation_availability_ids) ||
        JSON.stringify(prev.profile_ids) !==
          JSON.stringify(newState.profile_ids) ||
        JSON.stringify(prev.profile_persona_ids) !==
          JSON.stringify(newState.profile_persona_ids) ||
        JSON.stringify(prev.pending_ids) !==
          JSON.stringify(newState.pending_ids)
      ) {
        serverSyncPendingRef.current = true;
        return newState;
      }
      return prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    cohortData?.names,
    cohortData?.descriptions,
    cohortData?.flags,
    departmentIdsStr,
    simulationIdsStr,
    simulationPositionsStr,
    simulationAvailabilityIdsStr,
    profileIdsStr,
    profilePersonaIdsStr,
    cohortData?.pending_ids,
  ]);

  React.useEffect(() => {
    if (patchCohortDraftAction) {
      patchActionRef.current = async (payload: Record<string, unknown>) => {
        const result = await patchCohortDraftAction({
          body: payload,
        } as PatchCohortDraftIn);
        if (result.form_state) {
          const fs = result.form_state;
          setFormState((prev) => {
            const next: CohortFormState = {
              ...prev,
              name_id: fs.name_id ?? prev.name_id,
              description_id: fs.description_id ?? prev.description_id,
              flag_ids: (fs.flag_ids as string[] | null) ?? prev.flag_ids,
              department_ids: fs.department_ids ?? prev.department_ids,
              simulation_ids: fs.simulation_ids ?? prev.simulation_ids,
              simulation_position_ids:
                fs.simulation_position_ids ?? prev.simulation_position_ids,
              simulation_availability_ids:
                fs.simulation_availability_ids ?? prev.simulation_availability_ids,
              simulation_positions: fs.simulation_positions
                ? fs.simulation_positions.map((position) => ({
                    simulation_id: position.simulation_id,
                    value: position.value,
                  }))
                : prev.simulation_positions,
              profile_ids: fs.profile_ids ?? prev.profile_ids,
              profile_persona_ids:
                fs.profile_persona_ids ?? prev.profile_persona_ids,
              // Clear value fields only once the server has resolved them to
              // IDs — keeping the value would cause infinite re-saves (value
              // takes precedence → new resource → new id → repeat).
              name: fs.name_id ? null : prev.name,
              description: fs.description_id ? null : prev.description,
              simulation_position_values: fs.simulation_position_ids?.length
                ? null
                : prev.simulation_position_values,
              simulation_availability_values: fs.simulation_availability_ids?.length
                ? null
                : prev.simulation_availability_values,
              profile_persona_values: fs.profile_persona_ids?.length
                ? null
                : prev.profile_persona_values,
              pending_ids: fs.pending_ids ?? prev.pending_ids,
            };
            // Only set the server-sync absorb flag when the state actually
            // changes. Unconditionally setting it would let it stick after a
            // no-op sync and silently swallow the next user action. (Same fix
            // as Persona / Scenario / Simulation.)
            const changed =
              prev.name_id !== next.name_id ||
              prev.name !== next.name ||
              prev.description_id !== next.description_id ||
              prev.description !== next.description ||
              JSON.stringify(prev.flag_ids) !== JSON.stringify(next.flag_ids) ||
              JSON.stringify(prev.department_ids) !== JSON.stringify(next.department_ids) ||
              JSON.stringify(prev.simulation_ids) !== JSON.stringify(next.simulation_ids) ||
              JSON.stringify(prev.simulation_position_ids) !== JSON.stringify(next.simulation_position_ids) ||
              JSON.stringify(prev.simulation_availability_ids) !== JSON.stringify(next.simulation_availability_ids) ||
              JSON.stringify(prev.simulation_positions) !== JSON.stringify(next.simulation_positions) ||
              JSON.stringify(prev.profile_ids) !== JSON.stringify(next.profile_ids) ||
              JSON.stringify(prev.profile_persona_ids) !== JSON.stringify(next.profile_persona_ids) ||
              JSON.stringify(prev.simulation_position_values) !== JSON.stringify(next.simulation_position_values) ||
              JSON.stringify(prev.simulation_availability_values) !== JSON.stringify(next.simulation_availability_values) ||
              JSON.stringify(prev.profile_persona_values) !== JSON.stringify(next.profile_persona_values) ||
              JSON.stringify(prev.pending_ids) !== JSON.stringify(next.pending_ids);
            if (!changed) return prev;
            serverSyncPendingRef.current = true;
            return next;
          });
        }
        return result;
      };
    } else {
      patchActionRef.current = undefined;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patchCohortDraftAction, serverSyncPendingRef]);

  const handleGenerateResources = useCallback(
    async (resourceTypes: string[], userInstructions?: string) => {
      let draftIdToUse =
        (formDataRef.current["draftId"] as string | undefined) ?? null;
      if (!draftIdToUse) {
        draftIdToUse = await flushAllAndSave();
      }
      if (!draftIdToUse) {
        toast.error("Please save a draft before generating with AI");
        return;
      }

      generate(resourceTypes as ResourceType[], {
        draft_id: draftIdToUse,
        artifact_id: cohortId || null,
        user_instructions: userInstructions ? [userInstructions] : null,
      });
    },
    [cohortId, flushAllAndSave, formDataRef, generate],
  );

  const handleGenerateSimulations = useCallback(
    async () => handleGenerateResources(["simulations"]),
    [handleGenerateResources],
  );

  const handleGenerateSimulationPositions = useCallback(
    async () => handleGenerateResources(["simulation_positions"]),
    [handleGenerateResources],
  );

  const handleGenerateSimulationAvailability = useCallback(
    async () => handleGenerateResources(["simulation_availability"]),
    [handleGenerateResources],
  );

  const handleGenerateProfiles = useCallback(
    async () => handleGenerateResources(["profiles"]),
    [handleGenerateResources],
  );

  // --- Generation Modal ---
  // Step-to-resources mapping for multi-generation
  const stepResources: Record<string, string[]> = useMemo(
    () => ({
      basic: ["names", "descriptions", "departments", "flags"],
      simulations: ["simulations", "simulation_availability"],
      profiles: ["profiles", "profile_personas"],
      all: [
        "names",
        "descriptions",
        "flags",
        "departments",
        "simulations",
        "simulation_positions",
        "simulation_availability",
        "profiles",
        "profile_personas",
      ], // All resources for full-page generation
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

  // Disabled logic based on can_edit flag - standardized for all resource components
  // Check can_edit in both new and edit modes to show disabled_reason when agents are missing
  const disabled = useMemo(() => {
    if (!cohortData) return false;
    return !cohortData.can_edit;
  }, [cohortData]);

  // Submit handler for GenericForm (uses formState, not formData parameter)
  const handleSubmit = useCallback(
    async (_formData: Record<string, unknown>) => {
      let flushResults: FlushResult = {};
      if (!isAutosaveEnabled) {
        flushResults = await flushAllResources();
      }

      const baseFormState = formStateRef.current as unknown as CohortFormState;
      const effectiveFormState = computeEffectiveFormState(
        COHORT_RESOURCES,
        baseFormState as unknown as Record<string, unknown>,
        flushResults as Record<string, unknown>,
      ) as unknown as CohortFormState;

      if (!effectiveFormState.name_id && !effectiveFormState.name) {
        toast.error("Cohort name is required");
        throw new Error("Cohort name is required");
      }

      // Pass department_ids and simulation_ids directly - SQL handles validation

      // Ensure profileId exists - required for API calls
      if (!profile?.id) {
        toast.error("Profile not loaded. Please refresh the page.");
        throw new Error("Profile not loaded");
      }

      // Build common fields shared between create and update
      const commonFields = {
        name_id: effectiveFormState.name_id || null,
        name: (effectiveFormState as CohortFormState).name || null,
        description_id: effectiveFormState.description_id || null,
        description: (effectiveFormState as CohortFormState).description || null,
        flag_ids:
          effectiveFormState.flag_ids.length > 0
            ? effectiveFormState.flag_ids
            : null,
        department_ids: effectiveFormState.department_ids.length > 0 ? effectiveFormState.department_ids : null,
        simulation_ids: effectiveFormState.simulation_ids.length > 0 ? effectiveFormState.simulation_ids : null,
        simulation_position_ids: effectiveFormState.simulation_position_ids?.length > 0 ? effectiveFormState.simulation_position_ids : null,
        simulation_availability_ids: effectiveFormState.simulation_availability_ids?.length > 0 ? effectiveFormState.simulation_availability_ids : null,
        profile_ids: effectiveFormState.profile_ids?.length > 0 ? effectiveFormState.profile_ids : null,
        profile_persona_ids: effectiveFormState.profile_persona_ids?.length > 0 ? effectiveFormState.profile_persona_ids : null,
      };

      try {
        if (isEditMode && cohortId && updateCohortAction) {
          await updateCohortAction({
            body: {
              cohorts: [{
                id: cohortId,
                ...commonFields,
              }],
            },
          } as UpdateCohortIn);
        } else if (createCohortAction) {
          await createCohortAction({
            body: {
              cohorts: [commonFields],
            },
          } as CreateCohortIn);
        } else {
          toast.error("Save action not available");
          throw new Error("Save action not available");
        }
        toast.success(
          `Cohort ${isEditMode ? "updated" : "created"} successfully!`,
        );
        router.push("/training/cohorts");
      } catch (error) {
        toast.error(
          `Failed to ${isEditMode ? "update" : "create"} cohort: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
        throw error;
      }
    },
    [
      isAutosaveEnabled,
      flushAllResources,
      isEditMode,
      cohortId,
      cohortData,
      profile?.id,
      createCohortAction,
      updateCohortAction,
      router,
    ],
  );

  // Step status logic (for GenericForm) - check resource IDs instead of display values
  const getStepStatus = useCallback(
    (stepId: string, _formData: Record<string, unknown>): StepStatus => {
      // Check resource IDs from formState (components manage their own display state)
      const hasName = !!formState.name_id || !!formState.name;
      const hasDescription = !!formState.description_id || !!formState.description;
      const hasSimulations = formState.simulation_ids.length > 0;

      const hasProfiles = formState.profile_ids.length > 0;

      switch (stepId) {
        case "basic":
          return hasName && hasDescription ? "completed" : "active";
        case "simulations":
          if (!hasName || !hasDescription) return "pending";
          return hasSimulations ? "completed" : "active";
        case "profiles":
          if (!hasName || !hasDescription) return "pending";
          return hasProfiles ? "completed" : "active";
        default:
          return "pending";
      }
    },
    [formState],
  );

  // Steps configuration for GenericForm
  const steps = useMemo(
    () => [
      {
        id: "basic",
        title: "Basic Information",
        description:
          "Set the cohort name, description, departments, and active status.",
        resetFields: ["name", "description", "department_ids", "active"],
      },
      {
        id: "simulations",
        title: "Simulations",
        description: "Select simulations for this cohort.",
        resetFields: ["simulation_ids", "simulation_positions"],
      },
      {
        id: "profiles",
        title: "Profiles",
        description: "Select profiles for this cohort.",
        resetFields: ["profile_ids", "profile_persona_ids"],
      },
    ],
    [],
  );

  // Memoize formFieldKeys to prevent re-initialization loops
  const formFieldKeys = useMemo(
    () => [
      "name",
      "description",
      "active",
      "department_ids",
      "simulation_ids",
      "simulation_positions",
      "simulation_availability",
      "profile_ids",
      "profile_persona_ids",
    ],
    [],
  );

  // Memoize resetSuccessMessage to prevent GenericForm re-renders
  const resetSuccessMessage = useCallback((stepId: string) => {
    switch (stepId) {
      case "basic":
        return "Basic information reset";
      case "simulations":
        return "Simulations reset";
      case "profiles":
        return "Profiles reset";
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
            name_id: null,
            description_id: null,
            flag_ids: [],
            department_ids: [],
            name: null,
            description: null,
            pending_ids: prev.pending_ids.filter(
              (id) =>
                id !== prev.name_id &&
                id !== prev.description_id &&
                !prev.flag_ids.includes(id) &&
                !prev.department_ids.includes(id),
            ),
          };
        case "simulations":
          return {
            ...prev,
            simulation_ids: [],
            simulation_position_ids: [],
            simulation_availability_ids: [],
            simulation_positions: [],
            simulation_position_values: null,
            simulation_availability_values: null,
            pending_ids: prev.pending_ids.filter(
              (id) =>
                !prev.simulation_ids.includes(id) &&
                !prev.simulation_position_ids.includes(id) &&
                !prev.simulation_availability_ids.includes(id),
            ),
          };
        case "profiles":
          return {
            ...prev,
            profile_ids: [],
            profile_persona_ids: [],
            profile_persona_values: null,
            pending_ids: prev.pending_ids.filter(
              (id) =>
                !prev.profile_ids.includes(id) &&
                !prev.profile_persona_ids.includes(id),
            ),
          };
        default:
          return prev;
      }
    });
  }, []);

  // Memoize submitButton to prevent GenericForm re-renders
  const submitButton = useMemo(
    () => ({
      backUrl: "/training/cohorts",
      backLabel: "Back",
      createLabel: "Create Cohort",
      updateLabel: "Update Cohort",
    }),
    [],
  );

  // Memoize renderStep to prevent GenericForm re-renders
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
      // Use memoized fields to avoid dependency on cohortData object reference
      const s = stableCohortDataFields;
      const selectedName = s?.names?.find(isSelected) ?? null;
      const selectedDescription = s?.descriptions?.find(isSelected) ?? null;
      const selectedDepartments = s?.departments?.filter(isSelected) ?? [];
      const selectedSimulations = s?.simulations?.filter(isSelected) ?? [];
      const selectedSimulationPositions =
        s?.simulation_positions?.filter(isSelected) ?? [];
      const selectedSimulationAvailability =
        s?.simulation_availability?.filter(isSelected) ?? [];
      const selectedProfiles = s?.profiles?.filter(isSelected) ?? [];
      const selectedProfilePersonas =
        s?.profile_personas?.filter(isSelected) ?? [];
      const simulationSuggestions =
        s?.simulations
          ?.filter((simulation) => simulation.suggested && simulation.simulation_id)
          .map((simulation) => simulation.simulation_id!)
          ?? [];
      const profileSuggestions =
        s?.profiles
          ?.filter((profile) => profile.suggested && profile.profile_id)
          .map((profile) => profile.profile_id!)
          ?? [];
      const simulationsForUi = (s?.simulations ?? []).map((sim) => ({
        simulation_id: sim.simulation_id ?? null,
        name: sim.name ?? null,
        description: sim.description ?? null,
        generated: sim.generated ?? false,
      }));
      const selectedSimulationsForUi = selectedSimulations.map((sim) => ({
        simulation_id: sim.simulation_id ?? null,
        name: sim.name ?? null,
        description: sim.description ?? null,
        generated: sim.generated ?? false,
      }));
      const profilesForUi = (s?.profiles ?? []).map((profile) => ({
        profile_id: profile.profile_id ?? null,
        name: profile.name ?? null,
        description: profile.description ?? null,
        generated: profile.generated ?? false,
      }));
      const selectedProfilesForUi = selectedProfiles.map((profile) => ({
        profile_id: profile.profile_id ?? null,
        name: profile.name ?? null,
        description: profile.description ?? null,
        generated: profile.generated ?? false,
      }));
      const profilePersonasForUi = (s?.profile_personas ?? []).map((profilePersona) => ({
        id: profilePersona.id ?? null,
        profile_id: profilePersona.profile_id ?? null,
        persona_id: profilePersona.persona_id ?? null,
        generated: profilePersona.generated ?? false,
      }));
      const selectedProfilePersonasForUi = selectedProfilePersonas.map((profilePersona) => ({
        id: profilePersona.id ?? null,
        profile_id: profilePersona.profile_id ?? null,
        persona_id: profilePersona.persona_id ?? null,
        generated: profilePersona.generated ?? false,
      }));
      switch (stepId) {
        case "basic":
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
                  name_resource={selectedName}
                  show_name={true}
                  names={s?.names ?? []}
                  disabled={disabled}
                  onNameIdChange={handleNameIdChange}
                  onNameChange={handleNameChange}
                  placeholder="e.g., Spring 2024 Cohort"
                  defaultName="New Cohort"
                  required={true}
                  hideDescription={true}
                />
              }
              resetFields={["name", "description", "department_ids", "active"]}
              actions={
                stepResources["basic"] &&
                stepResources["basic"].length > 0 &&
                (s?.basic_show_ai_generate ?? false) ? (
                  <StepCardAiButton
                    stepId="basic"
                    resourceTypes={stepResources["basic"] ?? []}
                    canRegenerate={(rt) => canRegenerate(rt as ResourceType)}
                    isGenerating={(rt) => isGenerating(rt as ResourceType)}
                    disabled={disabled}
                    onOpenModal={handleDirectStepGenerate}
                  />
                ) : undefined
              }
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <div className="space-y-4">
                {/* Description field - using Descriptions resource component */}
                <Descriptions
                  description_id={formState.description_id ?? null}
                  description_resource={selectedDescription}
                  show_description={true}
                  descriptions={s?.descriptions ?? []}
                  disabled={disabled}
                  onDescriptionIdChange={handleDescriptionIdChange}
                  onDescriptionChange={handleDescriptionChange}
                  searchTerm={
                    (stepFormData["descriptionSearch"] as
                      | string
                      | null
                      | undefined) || ""
                  }
                  onSearchChange={(term: string) =>
                    setStepFormData({ descriptionSearch: term || null })
                  }
                  label="Description"
                  placeholder="Detailed description of the cohort"
                  required={false}
                  rows={4}
                  data-testid="input-cohort-description"
                />

                {/* Department Selection */}
                <Departments
                  department_ids={formState.department_ids ?? []}
                  department_resources={selectedDepartments}
                  show_departments={true}
                  departments={s?.departments ?? []}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => {
                      const removedIds = prev.department_ids.filter(
                        (id) => !ids.includes(id),
                      );
                      return {
                        ...prev,
                        department_ids: ids,
                        pending_ids: prev.pending_ids.filter(
                          (id) => !removedIds.includes(id),
                        ),
                      };
                    })
                  }
                  required={false}
                />

                {/* Active Switch - using Flags resource component */}
                <Flags
                  flags={s?.flags ?? []}
                  values={flagValues}
                  columns={1}
                  label="Flags"
                  disabled={disabled}
                  show_flags={true}
                  onChange={handleFlagToggle}
                />
              </div>
            </StepCard>
          );

        case "simulations": {
          const simulationSearchTerm =
            (stepFormData["simulationSearch"] as string | null | undefined) ||
            "";
          const simulationShowSelected =
            (stepFormData["simulationShowSelected"] as
              | boolean
              | null
              | undefined) ?? false;
          const hasSelectedSimulations =
            (formState.simulation_ids ?? []).length > 0;
          const showSimulationPositions =
            selectedSimulationPositions.length > 0 || hasSelectedSimulations;
          const showSimulationAvailability =
            selectedSimulationAvailability.length > 0 || hasSelectedSimulations;
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              searchTerm={simulationSearchTerm}
              onSearchChange={(term: string) =>
                setStepFormData({ simulationSearch: term || null })
              }
              searchPlaceholder="Search simulations..."
              debounceMs={300}
              filters={[
                {
                  key: "showSelected",
                  label: "Show selected",
                  value: simulationShowSelected,
                  onChange: (value: boolean) =>
                    setStepFormData({
                      simulationShowSelected: value || null,
                    }),
                },
              ]}
              resetFields={[
                "simulation_ids",
                "simulationSearch",
                "simulationShowSelected",
              ]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              actions={
                stepResources["simulations"] &&
                stepResources["simulations"].length > 0 &&
                (s?.simulations_step_show_ai_generate ?? false) ? (
                  <StepCardAiButton
                    stepId="simulations"
                    resourceTypes={stepResources["simulations"] ?? []}
                    canRegenerate={(rt) => canRegenerate(rt as ResourceType)}
                    isGenerating={(rt) => isGenerating(rt as ResourceType)}
                    disabled={disabled}
                    onOpenModal={handleDirectStepGenerate}
                  />
                ) : undefined
              }
            >
              <div className="space-y-6">
                <Simulations
                  simulation_ids={formState.simulation_ids ?? []}
                  simulation_resources={selectedSimulationsForUi}
                  show_simulations={true}
                  simulation_suggestions={simulationSuggestions}
                  simulations={simulationsForUi}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => {
                      const removedIds = prev.simulation_ids.filter(
                        (id) => !ids.includes(id),
                      );
                      return {
                        ...prev,
                        simulation_ids: ids,
                        pending_ids: prev.pending_ids.filter(
                          (id) => !removedIds.includes(id),
                        ),
                      };
                    })
                  }
                  onGenerate={handleGenerateSimulations}
                  label="Simulations"
                  required={false}
                  searchTerm={simulationSearchTerm}
                  showSelectedFilter={simulationShowSelected}
                />
                <SimulationPositions
                  simulation_ids={formState.simulation_ids ?? []}
                  simulation_resources={selectedSimulationsForUi.map(
                    (simulation) => ({
                      ...simulation,
                      time_limit: null,
                    }),
                  )}
                  simulations={simulationsForUi}
                  show_simulation_positions={showSimulationPositions}
                  simulation_positions={formState.simulation_positions ?? []}
                  disabled={disabled}
                  onChange={(positions) => {
                    const orderedSimulationIds = [...positions]
                      .sort((a, b) => a.value - b.value)
                      .map((position) => position.simulation_id);
                    setFormState((prev) => ({
                      ...prev,
                      simulation_positions: positions,
                      simulation_ids:
                        orderedSimulationIds.length > 0
                          ? orderedSimulationIds
                          : prev.simulation_ids,
                    }));
                  }}
                  label="Simulation Positions"
                  required={false}
                  onGenerate={
                    isEditMode ? handleGenerateSimulationPositions : undefined
                  }
                  onSimulationPositionValues={(positions) =>
                    setFormState((prev) => ({
                      ...prev,
                      simulation_position_values: positions.length > 0 ? positions : null,
                    }))
                  }
                />
                <SimulationAvailability
                  simulation_availability_ids={formState.simulation_availability_ids ?? []}
                  simulation_availability_resources={selectedSimulationAvailability}
                  show_simulation_availability={showSimulationAvailability}
                  simulation_ids={formState.simulation_ids ?? []}
                  simulations={simulationsForUi}
                  simulation_resources={selectedSimulationsForUi}
                  disabled={disabled}
                  onAvailabilityIdsChange={(ids) =>
                    setFormState((prev) => {
                      const removedIds =
                        prev.simulation_availability_ids.filter(
                          (id) => !ids.includes(id),
                        );
                      return {
                        ...prev,
                        simulation_availability_ids: ids,
                        pending_ids: prev.pending_ids.filter(
                          (id) => !removedIds.includes(id),
                        ),
                      };
                    })
                  }
                  label="Simulation Availability"
                  required={false}
                  onSimulationAvailabilityValues={(values) =>
                    setFormState((prev) => ({
                      ...prev,
                      simulation_availability_values: values.length > 0 ? values : null,
                    }))
                  }
                  {...(isEditMode
                    ? {
                        onGenerate: handleGenerateSimulationAvailability,
                      }
                    : {})}
                />
              </div>
            </StepCard>
          );
        }

        case "profiles": {
          const profileSearchTerm =
            (stepFormData["profileSearch"] as string | null | undefined) ||
            "";
          const profileShowSelected =
            (stepFormData["profileShowSelected"] as
              | boolean
              | null
              | undefined) ?? false;
          const hasSelectedProfiles =
            (formState.profile_ids ?? []).length > 0;
          const showProfilePersonas =
            selectedProfilePersonas.length > 0 || hasSelectedProfiles;
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              searchTerm={profileSearchTerm}
              onSearchChange={(term: string) =>
                setStepFormData({ profileSearch: term || null })
              }
              searchPlaceholder="Search profiles..."
              debounceMs={300}
              filters={[
                {
                  key: "showSelected",
                  label: "Show selected",
                  value: profileShowSelected,
                  onChange: (value: boolean) =>
                    setStepFormData({
                      profileShowSelected: value || null,
                    }),
                },
              ]}
              resetFields={["profile_ids", "profileSearch", "profileShowSelected"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              actions={
                stepResources["profiles"] &&
                stepResources["profiles"].length > 0 &&
                (s?.profiles_step_show_ai_generate ?? false) ? (
                  <StepCardAiButton
                    stepId="profiles"
                    resourceTypes={stepResources["profiles"] ?? []}
                    canRegenerate={(rt) => canRegenerate(rt as ResourceType)}
                    isGenerating={(rt) => isGenerating(rt as ResourceType)}
                    disabled={disabled}
                    onOpenModal={handleDirectStepGenerate}
                  />
                ) : undefined
              }
            >
              <div className="space-y-6">
              <Profiles
                profile_ids={formState.profile_ids ?? []}
                profile_resources={selectedProfilesForUi}
                profiles={profilesForUi}
                show_profiles={true}
                profile_suggestions={profileSuggestions}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => {
                    const removedIds = prev.profile_ids.filter(
                      (id) => !ids.includes(id),
                    );
                    return {
                      ...prev,
                      profile_ids: ids,
                      pending_ids: prev.pending_ids.filter(
                        (id) => !removedIds.includes(id),
                      ),
                    };
                  })
                }
                required={false}
                onGenerate={handleGenerateProfiles}
                searchTerm={profileSearchTerm}
                showSelectedFilter={profileShowSelected}

              />
              <ProfilePersonas
                profile_persona_ids={formState.profile_persona_ids ?? []}
                profile_persona_resources={selectedProfilePersonasForUi}
                profile_personas={profilePersonasForUi}
                show_profile_personas={showProfilePersonas}
                profiles={profilesForUi}
                profile_resources={selectedProfilesForUi}
                personas={(s?.personas ?? []).map((p) => ({
                  persona_id: p.id ?? null,
                  name: p.name ?? null,
                  description: p.description ?? null,
                  icon: p.icon ?? null,
                  color: p.color ?? null,
                }))}
                profile_ids={formState.profile_ids ?? []}
                disabled={disabled}
                onChange={() => undefined}
                cohort_id={cohortId ?? null}
                onProfilePersonaValues={(values) =>
                  setFormState((prev) => ({
                    ...prev,
                    profile_persona_values: values.length > 0 ? values : null,
                  }))
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
      // Use stableCohortDataFields instead of cohortData to prevent callback recreation
      // when only object reference changes (but content is same)
      stableCohortDataFields,
      disabled,
      isEditMode,
      handleGenerateSimulations,
      handleGenerateSimulationPositions,
      handleGenerateSimulationAvailability,
      handleGenerateProfiles,
      isGenerating,
      stepResources,
      // Depend on individual formState fields instead of whole object to prevent callback recreation
      // when object reference changes but values are same
      formState.name_id,
      formState.description_id,
      formState.flag_ids,
      // Include arrays - they're used in the callback, but the formState sync effect ensures
      // they only change when content actually changes (not just reference)
      formState.department_ids,
      flagValues,
      handleFlagToggle,
      formState.simulation_ids,
      formState.simulation_positions,
      formState.simulation_availability_ids,
      formState.profile_ids,
      formState.profile_persona_ids,
      cohortId,
      canRegenerate,
      handleDirectStepGenerate,
      isAutosaveEnabled,
    ],
  );

  return (
    <TooltipProvider>
      <div
        className="w-full p-6 space-y-8"
        data-page={`cohort-${isEditMode ? "edit" : "new"}`}
      >
        <ReadOnlyBanner
          disabled={disabled}
          disabledReason={cohortData?.disabled_reason ?? null}
          entityType="cohort"
        />

        <GenericForm
          nuqsParsers={
            cohortSearchParamsClient as Record<string, Parser<unknown>>
          }
          steps={steps}
          getStepStatus={getStepStatus}
          serverData={cohortData}
          formFieldKeys={formFieldKeys}
          resetSuccessMessage={resetSuccessMessage}
          onReset={(stepId) => handleReset(stepId)}
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

// Memoize component to prevent re-renders when only prop references change (content is same)
export default React.memo(CohortComponent, (prevProps, nextProps) => {
  // Compare cohortData by resource IDs, not object reference
  const prevIds = {
    name_id: prevProps.cohortData?.names?.find((item) => item.selected)?.id,
    description_id: prevProps.cohortData?.descriptions?.find(
      (item) => item.selected,
    )?.id,
    flag_ids: prevProps.cohortData?.flags
      ?.filter((item) => item.selected)
      .map((item) => item.id),
    department_ids: prevProps.cohortData?.departments
      ?.filter((item) => item.selected)
      .map((item) => item.department_id),
    simulation_ids: prevProps.cohortData?.simulations
      ?.filter((item) => item.selected)
      .map((item) => item.simulation_id),
    profile_ids: prevProps.cohortData?.profiles
      ?.filter((item) => item.selected)
      .map((item) => item.profile_id),
    pending_ids: prevProps.cohortData?.pending_ids,
  };
  const nextIds = {
    name_id: nextProps.cohortData?.names?.find((item) => item.selected)?.id,
    description_id: nextProps.cohortData?.descriptions?.find(
      (item) => item.selected,
    )?.id,
    flag_ids: nextProps.cohortData?.flags
      ?.filter((item) => item.selected)
      .map((item) => item.id),
    department_ids: nextProps.cohortData?.departments
      ?.filter((item) => item.selected)
      .map((item) => item.department_id),
    simulation_ids: nextProps.cohortData?.simulations
      ?.filter((item) => item.selected)
      .map((item) => item.simulation_id),
    profile_ids: nextProps.cohortData?.profiles
      ?.filter((item) => item.selected)
      .map((item) => item.profile_id),
    pending_ids: nextProps.cohortData?.pending_ids,
  };

  // Compare primitive props
  if (
    prevProps.cohortId !== nextProps.cohortId ||
    JSON.stringify(prevIds) !== JSON.stringify(nextIds)
  ) {
    return false; // Props changed, re-render
  }

  // Compare function props by reference (should be stable from server actions)
  if (
    prevProps.createCohortAction !== nextProps.createCohortAction ||
    prevProps.updateCohortAction !== nextProps.updateCohortAction ||
    prevProps.patchCohortDraftAction !== nextProps.patchCohortDraftAction
  ) {
    return false; // Function props changed, re-render
  }

  // All props are equivalent, skip re-render
  return true;
});
