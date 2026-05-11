/**
 * Simulation.tsx
 * Implementation using modular resource components
 * Used to create and manage simulations - supports both creation and editing
 * Follows Persona.tsx patterns for consistency
 */
"use client";

import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  GenericForm,
  type StepStatus,
} from "@/components/common/forms/GenericForm";
import { StepCard } from "@/components/common/forms/StepCard";
import { StepCardAiButton } from "@/components/common/forms/StepCardAiButton";
import { ReadOnlyBanner } from "@/components/common/forms/ReadOnlyBanner";
import { Departments } from "@/components/resources/Departments";
import { Descriptions } from "@/components/resources/Descriptions";
import { Flags } from "@/components/resources/Flags";
import { Names } from "@/components/resources/Names";
import { ScenarioFlags } from "@/components/resources/ScenarioFlags";
import { ScenarioPositions } from "@/components/resources/ScenarioPositions";
import { ScenarioRubrics } from "@/components/resources/ScenarioRubrics";
import { ScenarioTimeLimits } from "@/components/resources/ScenarioTimeLimits";
import { Scenarios } from "@/components/resources/Scenarios";
import { TooltipProvider } from "@/components/ui/tooltip";

import { useProfile } from "@/contexts/profile-context";
import { useDrafts } from "@/contexts/draft-context";
import { useSimulationAi } from "@/hooks/use-simulation-ai";
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
type CreateSimulationIn = InputOf<"/simulation/create", "post">;
type CreateSimulationOut = OutputOf<"/simulation/create", "post">;
type UpdateSimulationIn = InputOf<"/simulation/update", "post">;
type UpdateSimulationOut = OutputOf<"/simulation/update", "post">;
type PatchSimulationDraftIn = InputOf<
  "/simulation/draft",
  "post"
>;
type PatchSimulationDraftOut = OutputOf<
  "/simulation/draft",
  "post"
>;

type SimulationData = OutputOf<"/simulation/get", "post">;
type SimulationResourceType =
  | ResourceType
  | "scenario_time_limits";
type GeneratedResource = { generated?: boolean | null };

const EMPTY_FORM_STATE: SimulationFormState = {
  name_id: null,
  description_id: null,
  flag_ids: [],
  department_ids: [],
  scenario_ids: [],
  scenario_flag_ids: [],
  scenario_position_ids: [],
  scenario_rubric_ids: [],
  scenario_time_limit_ids: [],
  name: null,
  description: null,
  scenario_flags: null,
  scenario_flag_values: null,
  scenario_positions: null,
  scenario_rubrics: null,
  scenario_time_limits: null,
  pending_ids: [],
};

// Type for flush results - each resource returns its created ID(s)
type FlushResult = {
  name_id?: string | null;
  description_id?: string | null;
  scenario_flag_ids?: string[];
  scenario_position_ids?: string[];
  scenario_rubric_ids?: string[];
  scenario_time_limit_ids?: string[];
};

type SimulationFormState = {
  name_id: string | null;
  description_id: string | null;
  flag_ids: string[];
  department_ids: string[];
  scenario_ids: string[];
  scenario_flag_ids: string[];
  scenario_position_ids: string[];
  scenario_rubric_ids: string[];
  scenario_time_limit_ids: string[];
  // Value fields for single-select creatables
  name: string | null;
  description: string | null;
  // Value fields for multi-select creatables (merged with IDs by draft endpoint)
  scenario_flags: Array<{ scenario_id: string; flag_id: string }> | null;
  // Denormalized (scenario_id, type, value) — resolved server-side to a
  // scenario_flags_resource row via flags_resource (type, value) lookup.
  scenario_flag_values: Array<{ scenario_id: string; type: string; value: boolean }> | null;
  scenario_positions: Array<{ scenario_id: string; value: number }> | null;
  scenario_rubrics: Array<{ scenario_id: string; rubric_id: string }> | null;
  scenario_time_limits: Array<{ scenario_id: string; time_limit_seconds: number; negative: boolean }> | null;
  pending_ids: string[];
};

const SIMULATION_REQUIRED = {
  names: true,
  descriptions: false,
  departments: false,
  flags: false,
  scenarios: true,
  scenario_flags: false,
  scenario_positions: false,
  scenario_rubrics: true,
  scenario_time_limits: false,
} as const;

function collectPendingIds(data?: SimulationData): string[] {
  if (!data) return [];
  const ids = new Set<string>();

  data.names?.forEach((item) => {
    if (item.pending && item.id) ids.add(item.id);
  });
  data.descriptions?.forEach((item) => {
    if (item.pending && item.id) ids.add(item.id);
  });
  data.flags?.forEach((item) => {
    if (item.pending && item.id) ids.add(item.id);
  });
  data.departments?.forEach((item) => {
    if (item.pending && item.department_id) ids.add(item.department_id);
  });
  data.scenarios?.forEach((item) => {
    if (item.pending && item.scenario_id) ids.add(item.scenario_id);
  });
  data.scenario_flags?.forEach((item) => {
    if (item.pending && item.id) ids.add(item.id);
  });
  data.scenario_positions?.forEach((item) => {
    if (item.pending && item.id) ids.add(item.id);
  });
  data.scenario_rubrics?.forEach((item) => {
    if (item.pending && item.id) ids.add(item.id);
  });
  data.scenario_time_limits?.forEach((item) => {
    if (item.pending && item.id) ids.add(item.id);
  });

  return [...ids];
}

export interface SimulationProps {
  simulationId?: string;
  // Server-provided data (for server-side rendering)
  simulationData?: SimulationData;
  // Server actions
  createSimulationAction?: (input: CreateSimulationIn) => Promise<CreateSimulationOut>;
  updateSimulationAction?: (input: UpdateSimulationIn) => Promise<UpdateSimulationOut>;
  patchSimulationDraftAction?: (
    input: PatchSimulationDraftIn,
  ) => Promise<PatchSimulationDraftOut>;
}

const SIMULATION_RESOURCES: ResourceConfig[] = [
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
  { key: "scenarios", formKey: "scenario_ids", flushKey: null, type: "multi" },
  {
    key: "scenario_flags",
    formKey: "scenario_flag_ids",
    flushKey: "scenario_flag_ids",
    type: "multi",
  },
  {
    key: "scenario_positions",
    formKey: "scenario_position_ids",
    flushKey: "scenario_position_ids",
    type: "multi",
  },
  {
    key: "scenario_rubrics",
    formKey: "scenario_rubric_ids",
    flushKey: "scenario_rubric_ids",
    type: "multi",
  },
  {
    key: "scenario_time_limits",
    formKey: "scenario_time_limit_ids",
    flushKey: "scenario_time_limit_ids",
    type: "multi",
  },
];

function SimulationComponent({
  simulationId,
  simulationData,
  createSimulationAction,
  updateSimulationAction,
  patchSimulationDraftAction,
}: SimulationProps) {
  const router = useRouter();
  const isEditMode = !!simulationId;
  const { profile } = useProfile();
  const { setSelectedDraftId, isAutosaveEnabled } = useDrafts();

  // --- Flush Registry ---
  const { flushRegistryRef, flushAllResources } =
    useFlushRegistry<FlushResult>([]);

  // nuqs parsers for URL-backed state (will be passed to GenericForm)
  // Memoize to prevent new object reference on every render
  const simulationSearchParamsClient = useMemo(
    () => ({
      // Draft ID (URL-backed, updated when draft is created)
      draftId: parseAsString,
      // Search params (URL-backed, updated via debounced callback in StepCard)
      descriptionSearch: parseAsString,
      scenarioSearch: parseAsString,
      // Filter params (URL-backed)
      scenarioShowSelected: parseAsBoolean,
    }),
    [],
  );

  // Local form state (not in URL) - stores only resource IDs
  // Display values are managed inside resource components
  // Use ref to store simulationData to prevent callback recreation on every render
  const simulationDataRef = React.useRef(simulationData);
  React.useEffect(() => {
    simulationDataRef.current = simulationData;
  }, [simulationData]);

  const stableSimulationDataFields = React.useMemo(() => {
    if (!simulationData) return null;
    return {
      names: simulationData.names ?? [],
      descriptions: simulationData.descriptions ?? [],
      flags: simulationData.flags ?? [],
      departments: simulationData.departments ?? [],
      scenarios: simulationData.scenarios ?? [],
      scenario_flags: simulationData.scenario_flags ?? [],
      scenario_positions: simulationData.scenario_positions ?? [],
      scenario_rubrics: simulationData.scenario_rubrics ?? [],
      scenario_time_limits: simulationData.scenario_time_limits ?? [],
      rubrics: simulationData.rubrics ?? [],
      can_edit: simulationData.can_edit,
      disabled_reason: simulationData.disabled_reason,
      show_ai_generate: simulationData.show_ai_generate,
      basic_show_ai_generate: simulationData.basic_show_ai_generate,
    };
  }, [
    simulationData?.names,
    simulationData?.descriptions,
    simulationData?.flags,
    simulationData?.departments,
    simulationData?.scenarios,
    simulationData?.scenario_flags,
    simulationData?.scenario_positions,
    simulationData?.scenario_rubrics,
    simulationData?.scenario_time_limits,
    simulationData?.rubrics,
    simulationData?.can_edit,
    simulationData?.disabled_reason,
    simulationData?.show_ai_generate,
    simulationData?.basic_show_ai_generate,
  ]);

  const getInitialFormState = useCallback((): SimulationFormState => {
    const data = simulationDataRef.current;
    if (!data) return EMPTY_FORM_STATE;
    return {
      name_id: data.names?.find((item) => item.selected)?.id ?? null,
      description_id: data.descriptions?.find((item) => item.selected)?.id ?? null,
      flag_ids: (data.flags?.filter((item) => item.selected) ?? [])
        .map((x) => x.id)
        .filter(Boolean) as string[],
      department_ids: (data.departments?.filter((item) => item.selected) ?? [])
        .map((x) => x.department_id)
        .filter(Boolean) as string[],
      scenario_ids: (data.scenarios?.filter((item) => item.selected) ?? [])
        .map((x) => x.scenario_id)
        .filter(Boolean) as string[],
      scenario_flag_ids: (data.scenario_flags?.filter((item) => item.selected) ?? [])
        .map((x) => x.id)
        .filter(Boolean) as string[],
      scenario_position_ids: (data.scenario_positions?.filter((item) => item.selected) ?? [])
        .map((x) => x.id)
        .filter(Boolean) as string[],
      scenario_rubric_ids: (data.scenario_rubrics?.filter((item) => item.selected) ?? [])
        .map((x) => x.id)
        .filter(Boolean) as string[],
      scenario_time_limit_ids: (data.scenario_time_limits?.filter((item) => item.selected) ?? [])
        .map((x) => x.id)
        .filter(Boolean) as string[],
      name: null,
      description: null,
      scenario_flags: null,
      scenario_flag_values: null,
      scenario_positions: null,
      scenario_rubrics: null,
      scenario_time_limits: null,
      pending_ids: collectPendingIds(data),
    };
  }, []);

  const [formState, setFormState] =
    useState<SimulationFormState>(getInitialFormState);

  // Per-type boolean view of flag_ids, built from the catalog. Used by
  // the canonical <Flags> picker.
  const flagValues = React.useMemo<Record<string, boolean | null>>(() => {
    const map: Record<string, boolean | null> = {};
    const byId = new Map(
      (simulationData?.flags ?? [])
        .filter((f: any) => f.id)
        .map((f: any) => [String(f.id), f]),
    );
    for (const id of formState.flag_ids) {
      const row = byId.get(id) as any;
      if (!row) continue;
      const t = row.type ?? row.name;
      if (t && row.value != null) map[t] = row.value;
    }
    return map;
  }, [formState.flag_ids, simulationData?.flags]);

  type SimFlagRow = NonNullable<NonNullable<typeof simulationData>["flags"]>[number];
  const flagRowsByType = React.useMemo(() => {
    const map = new Map<string, SimFlagRow[]>();
    for (const f of simulationData?.flags ?? []) {
      const t = (f as any).type ?? (f as any).name;
      if (!t) continue;
      const list = map.get(t) ?? [];
      list.push(f as SimFlagRow);
      map.set(t, list);
    }
    return map;
  }, [simulationData?.flags]);

  const handleFlagToggle = useCallback(
    (type: string, next: boolean | null) => {
      setFormState((prev) => {
        const rows = (flagRowsByType.get(type) ?? []) as Array<{
          id?: string | null;
          value?: boolean | null;
        }>;
        const rowIdsForType = new Set(
          rows.map((r) => r.id).filter((id): id is string => !!id),
        );
        const retained = prev.flag_ids.filter((id) => !rowIdsForType.has(id));
        const target =
          next == null
            ? null
            : (rows.find((r) => r.value === next)?.id ?? null);
        const nextIds = target ? [...retained, target] : retained;
        return { ...prev, flag_ids: nextIds };
      });
    },
    [flagRowsByType],
  );

  // Per (scenario, type) boolean view derived from scenario_flag_ids +
  // catalog. Keys are `{scenario_id}:{type}`.
  const scenarioFlagValues = React.useMemo<Record<string, boolean | null>>(() => {
    const map: Record<string, boolean | null> = {};
    const sfById = new Map(
      (simulationData?.scenario_flags ?? [])
        .filter((sf: any) => sf.id)
        .map((sf: any) => [String(sf.id), sf]),
    );
    for (const id of formState.scenario_flag_ids ?? []) {
      const row = sfById.get(id) as any;
      if (!row) continue;
      const t = row.type ?? row.name;
      const sid = row.scenario_id;
      if (t && sid && row.value != null) {
        map[`${String(sid)}:${String(t)}`] = row.value;
      }
    }
    return map;
  }, [formState.scenario_flag_ids, simulationData?.scenario_flags]);

  // Look up the junction row that matches a (scenario, type, value) from
  // the server catalog. Tries selected rows first (those have a junction
  // ID), then option rows (suggestion cross-product; flag_id only — the
  // draft endpoint will upsert via scenario_flag_values).
  const handleScenarioFlagToggle = useCallback(
    (scenario_id: string, type: string, next: boolean | null) => {
      setFormState((prev) => {
        const existingRows = (simulationDataRef.current?.scenario_flags ?? []) as Array<any>;
        const optionRows = ((simulationDataRef.current as any)?.scenario_flag_options ?? []) as Array<any>;
        const key = `${scenario_id}:${type}`;

        // Figure out which scenario_flag_ids belong to this (scenario, type)
        // pair — those are the ones we need to drop before re-selecting.
        const pairIds = new Set<string>();
        for (const sf of existingRows) {
          if (!sf?.id) continue;
          const sfType = sf.type ?? sf.name;
          if (sf.scenario_id === scenario_id && sfType === type) {
            pairIds.add(String(sf.id));
          }
        }
        const retainedIds = (prev.scenario_flag_ids ?? []).filter(
          (id) => !pairIds.has(id),
        );

        // Strip any value-array entries for this same pair — we rebuild
        // below if the new state is non-null.
        const retainedValues = (prev.scenario_flags ?? []).filter(
          (_) => true,
        );

        // New value-array entry for denormalized create path (server
        // resolves via scenario_flag_values).
        const nextValueEntries: Array<{ scenario_id: string; type: string; value: boolean }> = [];
        for (const v of (prev as any).scenario_flag_values ?? []) {
          if (!(v.scenario_id === scenario_id && v.type === type)) {
            nextValueEntries.push(v);
          }
        }

        if (next == null) {
          return {
            ...prev,
            scenario_flag_ids: retainedIds,
            scenario_flags: retainedValues.length > 0 ? retainedValues : null,
            scenario_flag_values: nextValueEntries.length > 0 ? nextValueEntries : null,
          } as typeof prev;
        }

        // Prefer an existing junction row whose flag_id already matches
        // (type, value) — keeps ID stable when the user toggles back.
        const matchingExisting = existingRows.find(
          (sf) =>
            sf?.id
            && sf.scenario_id === scenario_id
            && (sf.type ?? sf.name) === type
            && sf.value === next,
        );
        if (matchingExisting?.id) {
          return {
            ...prev,
            scenario_flag_ids: [...retainedIds, String(matchingExisting.id)],
            scenario_flags: retainedValues.length > 0 ? retainedValues : null,
            scenario_flag_values: nextValueEntries.length > 0 ? nextValueEntries : null,
          } as typeof prev;
        }

        // No matching junction yet — ship as denormalized value. The
        // draft endpoint resolves (type, value) → flag_id and upserts
        // the scenario_flags_resource row.
        nextValueEntries.push({ scenario_id, type, value: next });

        // Opportunistically hint the flag_id via the options catalog so
        // downstream legacy code paths that read `scenario_flags` still
        // see a (scenario_id, flag_id) pair.
        const catalogMatch = optionRows.find(
          (opt) =>
            opt?.flag_id
            && opt.scenario_id === scenario_id
            && opt.type === type
            && opt.value === next,
        );
        const nextScenarioFlagHints = [...retainedValues];
        if (catalogMatch?.flag_id) {
          nextScenarioFlagHints.push({
            scenario_id,
            flag_id: String(catalogMatch.flag_id),
          });
        }
        void key;

        return {
          ...prev,
          scenario_flag_ids: retainedIds,
          scenario_flags:
            nextScenarioFlagHints.length > 0 ? nextScenarioFlagHints : null,
          scenario_flag_values:
            nextValueEntries.length > 0 ? nextValueEntries : null,
        } as typeof prev;
      });
    },
    [],
  );

  // --- AI Generation ---
  const { isGenerating, generate } = useSimulationAi({});

  // Helper to check if a resource type can be regenerated
  // Use stableSimulationDataFields to prevent callback recreation when simulationData object reference changes
  const canRegenerate: (resourceType: string) => boolean = useCallback(
    (resourceType: string): boolean => {
      if (!stableSimulationDataFields) return false;
      switch (resourceType) {
        case "names":
          return (
            stableSimulationDataFields.names?.find((item) => item.selected)
              ?.generated ?? false
          );
        case "descriptions":
          return (
            stableSimulationDataFields.descriptions?.find((item) => item.selected)
              ?.generated ?? false
          );
        case "flags":
          return (
            stableSimulationDataFields.flags?.filter((item) => item.selected).some(
              (f: GeneratedResource) => f.generated,
            ) ?? false
          );
        case "departments":
          return (
            stableSimulationDataFields.departments
              ?.filter((item) => item.selected)
              .some(
              (d: GeneratedResource) => d.generated,
            ) ?? false
          );
        case "scenarios":
          return (
            stableSimulationDataFields.scenarios?.filter((item) => item.selected).some(
              (s: GeneratedResource) => s.generated,
            ) ?? false
          );
        case "scenario_flags":
          return (
            stableSimulationDataFields.scenario_flags
              ?.filter((item) => item.selected)
              .some(
              (f: GeneratedResource) => f.generated,
            ) ?? false
          );
        case "scenario_positions":
          return (
            stableSimulationDataFields.scenario_positions
              ?.filter((item) => item.selected)
              .some(
              (p: GeneratedResource) => p.generated,
            ) ?? false
          );
        case "scenario_rubrics":
          return (
            stableSimulationDataFields.scenario_rubrics
              ?.filter((item) => item.selected)
              .some(
              (r: GeneratedResource) => r.generated,
            ) ?? false
          );
        case "scenario_time_limits":
          return (
            stableSimulationDataFields.scenario_time_limits
              ?.filter((item) => item.selected)
              .some(
              (t: GeneratedResource) => t.generated,
            ) ?? false
          );
        default:
          return false;
      }
    },
    [stableSimulationDataFields],
  );

  // Use ref to access formState in renderStep without depending on it
  const formStateRef = React.useRef<Record<string, unknown>>(
    formState as unknown as Record<string, unknown>,
  );
  React.useEffect(() => {
    formStateRef.current = formState as unknown as Record<string, unknown>;
  }, [formState]);

  // Memoize stringified formState arrays for draft listener effect dependencies
  const formStateFlagIdsStr = React.useMemo(
    () => JSON.stringify(formState.flag_ids),
    [formState.flag_ids],
  );
  const formStateDepartmentIdsStr = React.useMemo(
    () => JSON.stringify(formState.department_ids),
    [formState.department_ids],
  );
  const formStateScenarioIdsStr = React.useMemo(
    () => JSON.stringify(formState.scenario_ids),
    [formState.scenario_ids],
  );
  const formStateScenarioFlagIdsStr = React.useMemo(
    () => JSON.stringify(formState.scenario_flag_ids),
    [formState.scenario_flag_ids],
  );
  const formStateScenarioPositionIdsStr = React.useMemo(
    () => JSON.stringify(formState.scenario_position_ids),
    [formState.scenario_position_ids],
  );
  const formStateScenarioRubricIdsStr = React.useMemo(
    () => JSON.stringify(formState.scenario_rubric_ids),
    [formState.scenario_rubric_ids],
  );
  const formStateScenarioTimeLimitIdsStr = React.useMemo(
    () => JSON.stringify(formState.scenario_time_limit_ids),
    [formState.scenario_time_limit_ids],
  );
  const formStatePendingIdsStr = React.useMemo(
    () => JSON.stringify(formState.pending_ids),
    [formState.pending_ids],
  );

  // --- Draft Lifecycle ---
  const patchSimulationDraftActionRef = React.useRef(
    patchSimulationDraftAction,
  );
  React.useEffect(() => {
    patchSimulationDraftActionRef.current = patchSimulationDraftAction;
  }, [patchSimulationDraftAction]);

  // Stable ref wrapper for patch action
  const patchActionRef = React.useRef<
    | ((
        payload: Record<string, unknown>,
      ) => Promise<{ draft_id?: string | null }>)
    | undefined
  >(undefined);

  // formStateKey excludes draftId -- the hook prepends it
  const formStateKey = React.useMemo(
    () =>
      JSON.stringify({
        name_id: formState.name_id,
        description_id: formState.description_id,
        flag_ids: formState.flag_ids,
        department_ids: formState.department_ids,
        scenario_ids: formState.scenario_ids,
        scenario_flag_ids: formState.scenario_flag_ids,
        scenario_position_ids: formState.scenario_position_ids,
        scenario_rubric_ids: formState.scenario_rubric_ids,
        scenario_time_limit_ids: formState.scenario_time_limit_ids,
        pending_ids: formState.pending_ids,
        // Value fields trigger autosave too
        name: formState.name,
        description: formState.description,
        scenario_flags: formState.scenario_flags,
        scenario_positions: formState.scenario_positions,
        scenario_rubrics: formState.scenario_rubrics,
        scenario_time_limits: formState.scenario_time_limits,
      }),
    // Use stringified arrays to prevent recreation when array references change but content is same
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      formState.name_id,
      formState.description_id,
      formStateFlagIdsStr,
      formStateDepartmentIdsStr,
      formStateScenarioIdsStr,
      formStateScenarioFlagIdsStr,
      formStateScenarioPositionIdsStr,
      formStateScenarioRubricIdsStr,
      formStateScenarioTimeLimitIdsStr,
      formStatePendingIdsStr,
      formState.name,
      formState.description,
      formState.scenario_flags,
      formState.scenario_positions,
      formState.scenario_rubrics,
      formState.scenario_time_limits,
    ],
  );

  const hasResourceIds = checkHasResourceIds(
    SIMULATION_RESOURCES,
    formState as unknown as Record<string, unknown>,
  ) || !!formState.name || !!formState.description
    || (formState.scenario_flags?.length ?? 0) > 0
    || (formState.scenario_positions?.length ?? 0) > 0
    || (formState.scenario_rubrics?.length ?? 0) > 0
    || (formState.scenario_time_limits?.length ?? 0) > 0;

  const buildPatchPayload = useCallback((): Record<string, unknown> => {
    const current = formStateRef.current as unknown as SimulationFormState;
    const payload: Record<string, unknown> = {};

    if (current.name != null) payload["name"] = current.name;
    else if (current.name_id) payload["name_id"] = current.name_id;

    if (current.description != null) payload["description"] = current.description;
    else if (current.description_id) payload["description_id"] = current.description_id;

    if (current.flag_ids.length > 0) payload["flag_ids"] = current.flag_ids;
    if (current.department_ids.length > 0) payload["department_ids"] = current.department_ids;
    if (current.scenario_ids.length > 0) payload["scenario_ids"] = current.scenario_ids;

    if (current.scenario_flags && current.scenario_flags.length > 0) {
      payload["scenario_flags"] = current.scenario_flags;
    } else if (current.scenario_flag_ids.length > 0) {
      payload["scenario_flag_ids"] = current.scenario_flag_ids;
    }
    if (current.scenario_flag_values && current.scenario_flag_values.length > 0) {
      payload["scenario_flag_values"] = current.scenario_flag_values;
    }

    if (current.scenario_positions && current.scenario_positions.length > 0) {
      payload["scenario_positions"] = current.scenario_positions;
    } else if (current.scenario_position_ids.length > 0) {
      payload["scenario_position_ids"] = current.scenario_position_ids;
    }

    if (current.scenario_rubrics && current.scenario_rubrics.length > 0) {
      payload["scenario_rubrics"] = current.scenario_rubrics;
    } else if (current.scenario_rubric_ids.length > 0) {
      payload["scenario_rubric_ids"] = current.scenario_rubric_ids;
    }

    if (current.scenario_time_limits && current.scenario_time_limits.length > 0) {
      payload["scenario_time_limits"] = current.scenario_time_limits;
    } else if (current.scenario_time_limit_ids.length > 0) {
      payload["scenario_time_limit_ids"] = current.scenario_time_limit_ids;
    }

    if (current.pending_ids.length > 0) payload["pending_ids"] = current.pending_ids;
    return payload;
  }, []);

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
    flushRegistryRef,
    formStateRef,
  });

  // --- Stable value-change handlers (extracted from inline arrows) ---
  const handleNameIdChange = useCallback((id: string | null) => {
    setFormState((prev) => ({ ...prev, name_id: id, name: null }));
  }, []);

  const handleNameChange = useCallback((name: string) => {
    setFormState((prev) => ({ ...prev, name, name_id: null }));
  }, []);

  const handleDescriptionIdChange = useCallback((id: string | null) => {
    setFormState((prev) => ({ ...prev, description_id: id, description: null }));
  }, []);

  const handleDescriptionChange = useCallback((description: string) => {
    setFormState((prev) => ({ ...prev, description, description_id: null }));
  }, []);

  // ─── Per-field pending lifecycle ──────────────────────────────────
  // Mirrors persona pattern. Helpers manage pending_ids. formStateKey
  // already tracks pending_ids so accept/reject reliably triggers autosave.
  type SingleField = "name_id" | "description_id";
  type MultiField = "department_ids" | "flag_ids";

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

  React.useEffect(() => {
    if (patchSimulationDraftAction) {
      patchActionRef.current = async (payload: Record<string, unknown>) => {
        const result = await patchSimulationDraftAction({
          body: payload,
        } as PatchSimulationDraftIn);

        // Sync form_state from server response (server is source of truth)
        const fs = (result as Record<string, unknown>)?.["form_state"] as Record<string, unknown> | undefined;
        if (fs) {
          setFormState((prev) => {
            const next = {
              ...prev,
              name_id: (fs["name_id"] as string) ?? prev.name_id,
              description_id: (fs["description_id"] as string) ?? prev.description_id,
              flag_ids: (fs["flag_ids"] as string[]) ?? prev.flag_ids,
              department_ids: (fs["department_ids"] as string[]) ?? prev.department_ids,
              scenario_ids: (fs["scenario_ids"] as string[]) ?? prev.scenario_ids,
              scenario_flag_ids: (fs["scenario_flag_ids"] as string[]) ?? prev.scenario_flag_ids,
              scenario_position_ids: (fs["scenario_position_ids"] as string[]) ?? prev.scenario_position_ids,
              scenario_rubric_ids: (fs["scenario_rubric_ids"] as string[]) ?? prev.scenario_rubric_ids,
              scenario_time_limit_ids: (fs["scenario_time_limit_ids"] as string[]) ?? prev.scenario_time_limit_ids,
              pending_ids: (fs["pending_ids"] as string[]) ?? prev.pending_ids,
              // Clear value fields only once the server has resolved them to IDs.
              // Keeping the value would cause infinite re-saves (value takes
              // precedence → new resource → new id → repeat).
              name: fs["name_id"] ? null : ((fs["name"] as string | null | undefined) ?? prev.name),
              description: fs["description_id"]
                ? null
                : ((fs["description"] as string | null | undefined) ?? prev.description),
              // Only clear multi-text arrays when server returned IDs for them.
              // Previously these were cleared unconditionally, which would
              // clobber a mid-typed value on a "no-op" server sync.
              scenario_flags: (fs["scenario_flag_ids"] as string[])?.length ? null : prev.scenario_flags,
              scenario_positions: (fs["scenario_position_ids"] as string[])?.length ? null : prev.scenario_positions,
              scenario_rubrics: (fs["scenario_rubric_ids"] as string[])?.length ? null : prev.scenario_rubrics,
              scenario_time_limits: (fs["scenario_time_limit_ids"] as string[])?.length ? null : prev.scenario_time_limits,
            };
            // Only set the server-sync absorb flag when the state actually
            // changes. If the server returned identical values, setting the
            // flag unconditionally would let it stick until the next user
            // action and silently swallow that action's save. (Same fix as
            // Persona and Scenario.)
            const changed =
              prev.name_id !== next.name_id ||
              prev.name !== next.name ||
              prev.description_id !== next.description_id ||
              prev.description !== next.description ||
              JSON.stringify(prev.flag_ids) !== JSON.stringify(next.flag_ids) ||
              JSON.stringify(prev.department_ids) !== JSON.stringify(next.department_ids) ||
              JSON.stringify(prev.scenario_ids) !== JSON.stringify(next.scenario_ids) ||
              JSON.stringify(prev.scenario_flag_ids) !== JSON.stringify(next.scenario_flag_ids) ||
              JSON.stringify(prev.scenario_position_ids) !== JSON.stringify(next.scenario_position_ids) ||
              JSON.stringify(prev.scenario_rubric_ids) !== JSON.stringify(next.scenario_rubric_ids) ||
              JSON.stringify(prev.scenario_time_limit_ids) !== JSON.stringify(next.scenario_time_limit_ids) ||
              JSON.stringify(prev.pending_ids) !== JSON.stringify(next.pending_ids) ||
              JSON.stringify(prev.scenario_flags) !== JSON.stringify(next.scenario_flags) ||
              JSON.stringify(prev.scenario_positions) !== JSON.stringify(next.scenario_positions) ||
              JSON.stringify(prev.scenario_rubrics) !== JSON.stringify(next.scenario_rubrics) ||
              JSON.stringify(prev.scenario_time_limits) !== JSON.stringify(next.scenario_time_limits);
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
  }, [patchSimulationDraftAction]);

  // Update form state when server data changes.
  useEffect(() => {
    const newState = getInitialFormState();
    setFormState((prev) => {
      if (
        prev.name_id !== newState.name_id ||
        prev.description_id !== newState.description_id ||
        JSON.stringify(prev.flag_ids) !== JSON.stringify(newState.flag_ids) ||
        JSON.stringify(prev.department_ids) !== JSON.stringify(newState.department_ids) ||
        JSON.stringify(prev.scenario_ids) !== JSON.stringify(newState.scenario_ids) ||
        JSON.stringify(prev.scenario_flag_ids) !== JSON.stringify(newState.scenario_flag_ids) ||
        JSON.stringify(prev.scenario_position_ids) !== JSON.stringify(newState.scenario_position_ids) ||
        JSON.stringify(prev.scenario_rubric_ids) !== JSON.stringify(newState.scenario_rubric_ids) ||
        JSON.stringify(prev.scenario_time_limit_ids) !== JSON.stringify(newState.scenario_time_limit_ids) ||
        JSON.stringify(prev.pending_ids) !== JSON.stringify(newState.pending_ids)
      ) {
        serverSyncPendingRef.current = true;
        return newState;
      }
      return prev;
    });
  }, [stableSimulationDataFields, getInitialFormState, serverSyncPendingRef]);

  // --- Generation Handlers ---
  const handleGenerateResources = useCallback(
    async (
      resourceTypes: SimulationResourceType[],
      userInstructions?: string,
    ) => {
      const formData = formDataRef.current;
      const draftId = (formData["draftId"] as string | undefined) ?? null;

      generate(resourceTypes, {
        user_instructions: userInstructions ? [userInstructions] : null,
        draft_id: draftId || null,
      });
    },
    [generate, formDataRef],
  );

  const handleGenerateScenarios = useCallback(
    async () => handleGenerateResources(["scenarios"]),
    [handleGenerateResources],
  );

  const handleGenerateScenarioFlags = useCallback(
    async () => handleGenerateResources(["scenario_flags"]),
    [handleGenerateResources],
  );

  const handleGenerateScenarioPositions = useCallback(
    async () => handleGenerateResources(["scenario_positions"]),
    [handleGenerateResources],
  );

  const handleGenerateScenarioRubrics = useCallback(
    async () => handleGenerateResources(["scenario_rubrics"]),
    [handleGenerateResources],
  );

  const handleGenerateScenarioTimeLimits = useCallback(
    async () => handleGenerateResources(["scenario_time_limits"]),
    [handleGenerateResources],
  );

  // Disabled logic based on can_edit flag - standardized for all resource components
  // Check can_edit in both new and edit modes to show disabled_reason when agents are missing
  const disabled = useMemo(() => {
    if (!stableSimulationDataFields) return false;
    return !(stableSimulationDataFields.can_edit as boolean | undefined);
  }, [stableSimulationDataFields]);

  // Submit handler for GenericForm (uses formState, not formData parameter)
  const handleSubmit = useCallback(
    async (_formData: Record<string, unknown>) => {
      // When autosave is disabled, flush all resources first to create them
      // This gets the IDs directly without saving to draft
      let flushResults: FlushResult = {};
      if (!isAutosaveEnabled) {
        flushResults = await flushAllResources();
      }

      const baseFormState =
        formStateRef.current as unknown as SimulationFormState;
      const effectiveFormState = computeEffectiveFormState(
        SIMULATION_RESOURCES,
        baseFormState as unknown as Record<string, unknown>,
        flushResults as Record<string, unknown>,
      ) as unknown as SimulationFormState;

      // Validate required resource IDs using {resource}_required flags from simulationData
      if (SIMULATION_REQUIRED.names && !effectiveFormState.name_id && !formState.name) {
        toast.error("Simulation name is required");
        throw new Error("Simulation name is required");
      }

      if (
        SIMULATION_REQUIRED.departments &&
        (!effectiveFormState.department_ids || effectiveFormState.department_ids.length === 0)
      ) {
        toast.error("Departments are required");
        throw new Error("Departments are required");
      }

      if (SIMULATION_REQUIRED.flags && (!effectiveFormState.flag_ids || effectiveFormState.flag_ids.length === 0)) {
        toast.error("At least one flag is required");
        throw new Error("At least one flag is required");
      }

      if (SIMULATION_REQUIRED.descriptions && !effectiveFormState.description_id && !formState.description) {
        toast.error("Description is required");
        throw new Error("Description is required");
      }

      if (SIMULATION_REQUIRED.scenarios && (!effectiveFormState.scenario_ids || effectiveFormState.scenario_ids.length === 0)) {
        toast.error("Scenarios are required");
        throw new Error("Scenarios are required");
      }

      if (
        SIMULATION_REQUIRED.scenario_flags &&
        (!effectiveFormState.scenario_flag_ids || effectiveFormState.scenario_flag_ids.length === 0)
      ) {
        toast.error("Scenario flags are required");
        throw new Error("Scenario flags are required");
      }

      if (
        SIMULATION_REQUIRED.scenario_positions &&
        (!effectiveFormState.scenario_position_ids || effectiveFormState.scenario_position_ids.length === 0)
      ) {
        toast.error("Scenario positions are required");
        throw new Error("Scenario positions are required");
      }

      if (
        SIMULATION_REQUIRED.scenario_rubrics &&
        (!effectiveFormState.scenario_rubric_ids || effectiveFormState.scenario_rubric_ids.length === 0)
      ) {
        toast.error("Scenario rubrics are required");
        throw new Error("Scenario rubrics are required");
      }

      if (
        SIMULATION_REQUIRED.scenario_time_limits &&
        (!effectiveFormState.scenario_time_limit_ids || effectiveFormState.scenario_time_limit_ids.length === 0)
      ) {
        toast.error("Scenario time limits are required");
        throw new Error("Scenario time limits are required");
      }

      // Pass department_ids directly - SQL handles validation via validate_department_create_permissions/validate_department_update_permissions

      // Ensure profileId exists - required for API calls
      if (!profile?.id) {
        toast.error("Profile not loaded. Please refresh the page.");
        throw new Error("Profile not loaded");
      }

      // Check for name (either ID or value)
      const hasName = !!effectiveFormState.name_id || !!formState.name;
      if (SIMULATION_REQUIRED.names && !hasName) {
        toast.error("Simulation name is required");
        throw new Error("Simulation name is required");
      }

      if (!simulationData?.group_id) {
        toast.error("Group not found. Please try again.");
        throw new Error("Group ID is required for save");
      }

      const commonFields = {
        name_id: effectiveFormState.name_id ?? undefined,
        description_id: effectiveFormState.description_id ?? undefined,
        flag_ids: effectiveFormState.flag_ids?.length
          ? effectiveFormState.flag_ids
          : undefined,
        department_ids: effectiveFormState.department_ids?.length
          ? effectiveFormState.department_ids
          : undefined,
        scenario_ids: effectiveFormState.scenario_ids?.length
          ? effectiveFormState.scenario_ids
          : undefined,
        scenario_flag_ids: effectiveFormState.scenario_flag_ids?.length
          ? effectiveFormState.scenario_flag_ids
          : undefined,
        scenario_position_ids: effectiveFormState.scenario_position_ids?.length
          ? effectiveFormState.scenario_position_ids
          : undefined,
        scenario_rubric_ids: effectiveFormState.scenario_rubric_ids?.length
          ? effectiveFormState.scenario_rubric_ids
          : undefined,
        scenario_time_limit_ids: effectiveFormState.scenario_time_limit_ids?.length
          ? effectiveFormState.scenario_time_limit_ids
          : undefined,
      };

      try {
        if (isEditMode && simulationId && updateSimulationAction) {
          await updateSimulationAction({
            body: {
              simulations: [{ id: simulationId, ...commonFields }],
            },
          } as UpdateSimulationIn);
        } else if (createSimulationAction) {
          await createSimulationAction({
            body: {
              simulations: [commonFields],
            },
          } as CreateSimulationIn);
        } else {
          toast.error("Save action not available");
          throw new Error("Save action not available");
        }

        toast.success(
          `Simulation ${isEditMode ? "updated" : "created"} successfully!`,
        );
        router.push("/training/simulations");
      } catch (error) {
        toast.error(
          `Failed to ${isEditMode ? "update" : "create"} simulation: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
        throw error;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      isAutosaveEnabled,
      flushAllResources,
      isEditMode,
      simulationId,
      profile?.id,
      createSimulationAction,
      updateSimulationAction,
      stableSimulationDataFields,
      simulationData?.group_id,
      router,
    ],
  );

  // Step status logic (for GenericForm) - check resource IDs instead of display values
  const getStepStatus = useCallback(
    (stepId: string, _formData: Record<string, unknown>): StepStatus => {
      // Check resource IDs from formState (components manage their own display state)
      const hasName =
        !SIMULATION_REQUIRED.names ||
        !!formState.name_id || !!formState.name;
      const hasDescription =
        !SIMULATION_REQUIRED.descriptions ||
        !!formState.description_id || !!formState.description;
      const hasDepartments =
        !SIMULATION_REQUIRED.departments ||
        formState.department_ids.length > 0;
      const hasFlags =
        !SIMULATION_REQUIRED.flags ||
        formState.flag_ids.length > 0;
      const hasScenarios =
        !SIMULATION_REQUIRED.scenarios ||
        formState.scenario_ids.length > 0;
      const hasScenarioFlags =
        !SIMULATION_REQUIRED.scenario_flags ||
        formState.scenario_flag_ids.length > 0;
      const hasScenarioPositions =
        !SIMULATION_REQUIRED.scenario_positions ||
        formState.scenario_position_ids.length > 0;
      const hasScenarioRubrics =
        !SIMULATION_REQUIRED.scenario_rubrics ||
        formState.scenario_rubric_ids.length > 0;
      const hasScenarioTimeLimits =
        !SIMULATION_REQUIRED.scenario_time_limits ||
        formState.scenario_time_limit_ids.length > 0;

      switch (stepId) {
        case "basic":
          return hasName && hasDescription && hasDepartments && hasFlags
            ? "completed"
            : "active";
        case "scenarios":
          return hasScenarios &&
            hasScenarioFlags &&
            hasScenarioPositions &&
            hasScenarioRubrics &&
            hasScenarioTimeLimits
            ? "completed"
            : "active";
        default:
          return "pending";
      }
    },
    [formState, stableSimulationDataFields],
  );

  // Step-to-resources mapping for multi-generation
  const stepResources: Record<string, SimulationResourceType[]> = useMemo(
    () => ({
      basic: ["names", "descriptions", "departments", "flags"],
      scenarios: [
        "scenarios",
        "scenario_flags",
        "scenario_positions",
        "scenario_rubrics",
        "scenario_time_limits",
      ],
      all: [
        "names",
        "descriptions",
        "departments",
        "flags",
        "scenarios",
        "scenario_flags",
        "scenario_positions",
        "scenario_rubrics",
        "scenario_time_limits",
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

  // Steps configuration for GenericForm
  const steps = useMemo(
    () => [
      {
        id: "basic",
        title: "Basic Information",
        description:
          "Set the simulation name, description, departments, and active status.",
        resetFields: ["name", "description", "department_ids", "active"],
      },
      {
        id: "scenarios",
        title: "Scenarios",
        description:
          "Select scenarios and configure scenario flags, positions, rubrics, and time limits.",
        resetFields: [
          "scenario_ids",
          "scenario_flag_ids",
          "scenario_position_ids",
          "scenario_rubric_ids",
          "scenario_time_limit_ids",
          "scenarioSearch",
          "scenarioShowSelected",
        ],
      },
    ],
    [],
  );

  // Memoize formFieldKeys to prevent re-initialization loops
  const formFieldKeys = useMemo(
    () => [
      "name",
      "description",
      "departments",
      "active",
      "scenario_ids",
      "scenario_flag_ids",
      "scenario_position_ids",
      "scenario_rubric_ids",
      "scenario_time_limit_ids",
    ],
    [],
  );

  // Memoize resetSuccessMessage to prevent GenericForm re-renders
  const resetSuccessMessage = useCallback((stepId: string) => {
    switch (stepId) {
      case "basic":
        return "Basic information reset";
      case "scenarios":
        return "Scenario configuration reset";
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
            name: null,
            description_id: null,
            description: null,
            flag_ids: [],
            department_ids: [],
          };
        case "scenarios":
          return {
            ...prev,
            scenario_ids: [],
            scenario_flag_ids: [],
            scenario_flags: null,
            scenario_flag_values: null,
            scenario_position_ids: [],
            scenario_positions: null,
            scenario_rubric_ids: [],
            scenario_rubrics: null,
            scenario_time_limit_ids: [],
            scenario_time_limits: null,
          };
        default:
          return prev;
      }
    });
  }, []);

  // Memoize submitButton to prevent GenericForm re-renders
  const submitButton = useMemo(
    () => ({
      backUrl: "/training/simulations",
      backLabel: "Back",
      createLabel: "Create Simulation",
      updateLabel: "Update Simulation",
    }),
    [],
  );

  // Compute scenario_resources with show_hints flag
  // show_hints is based on practice_simulation mode - when practice mode is on, hints are hidden
  // For now, default to true (show hints) since practice_simulation isn't exposed in the form yet
  const scenarioResourcesWithShowHints = useMemo(() => {
    const resources =
      stableSimulationDataFields?.scenarios?.filter((item) => item.selected) ?? [];
    // TODO: When practice_simulation is exposed in the API response, use it here:
    // const isPractice = stableSimulationDataFields?.practice_simulation ?? false;
    // For now, always show hints (show_hints = true)
    return resources.map((sr: { [key: string]: unknown }) => ({
      ...sr,
      show_hints: true, // Will be set to !isPractice when practice mode is exposed
    }));
  }, [stableSimulationDataFields?.scenarios]);

  // Render step content - memoized to prevent unnecessary re-renders
  // Updated to match Persona.tsx signature
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
      // Use memoized fields to avoid dependency on simulationData object reference
      const s = stableSimulationDataFields;
      if (!s) {
        return <div>Loading...</div>;
      }

      const descriptionSearch =
        (stepFormData["descriptionSearch"] as string | undefined) ?? null;
      const selectedName = s.names.find((item) => item.selected) ?? null;
      const selectedDescription =
        s.descriptions.find((item) => item.selected) ?? null;
      const selectedDepartments = s.departments.filter((item) => item.selected);
      const selectedScenarios = s.scenarios.filter((item) => item.selected);
      const selectedScenarioPositions = s.scenario_positions.filter(
        (item) => item.selected,
      );
      const selectedScenarioRubrics = s.scenario_rubrics.filter(
        (item) => item.selected,
      );
      const selectedScenarioTimeLimits = s.scenario_time_limits.filter(
        (item) => item.selected,
      );
      // Unlimited time limits are a practice-only convenience: training
      // and assessment simulations must commit to a concrete time budget.
      // Gate the Unlimited switch on whether the simulation's practice
      // flag option is currently selected. The server sets
      // SimulationFlagConfig.key from the flag's `name` (not its `type`),
      // which is "Practice" in the seed — match case-insensitively so the
      // capitalization doesn't silently disable the toggle.
      // Canonical: select the practice=true flag-resource row by (type, value).
      const practiceFlagOptionId = (s.flags ?? []).find(
        (f: any) =>
          ((f.type ?? f.name ?? "") as string).toLowerCase() === "practice"
          && f.value === true,
      )?.id;
      const allowUnlimitedTimeLimits = !!(
        practiceFlagOptionId &&
        (formState.flag_ids ?? []).includes(String(practiceFlagOptionId))
      );
      const scenarioSuggestions = s.scenarios
        .filter((item) => item.suggested && item.scenario_id)
        .map((item) => item.scenario_id as string);
      const scenarioPositionSuggestions = s.scenario_positions
        .filter((item) => item.suggested && item.id)
        .map((item) => item.id as string);
      const scenarioRubricSuggestions = s.scenario_rubrics
        .filter((item) => item.suggested && item.id)
        .map((item) => item.id as string);

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
                  names={s.names ?? []}
                  disabled={disabled}
                  onNameIdChange={handleNameIdChange}
                  onNameChange={handleNameChange}
                  onAcceptPending={(pendingId) =>
                    handleAcceptPendingField("name_id", pendingId)
                  }
                  onRejectPending={(pendingId) =>
                    handleRejectPendingField("name_id", pendingId)
                  }
                  required={SIMULATION_REQUIRED.names}
                  placeholder="Simulation name"
                  defaultName="New Simulation"
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
                    canRegenerate={(rt: string) => canRegenerate(rt)}
                    isGenerating={(rt: string) =>
                      isGenerating(rt as SimulationResourceType)
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
                  description_resource={selectedDescription}
                  show_description={true}
                  descriptions={s.descriptions ?? []}
                  disabled={disabled}
                  onDescriptionIdChange={handleDescriptionIdChange}
                  onDescriptionChange={handleDescriptionChange}
                  onAcceptPending={(pendingId) =>
                    handleAcceptPendingField("description_id", pendingId)
                  }
                  onRejectPending={(pendingId) =>
                    handleRejectPendingField("description_id", pendingId)
                  }
                  searchTerm={descriptionSearch ?? ""}
                  onSearchChange={(term: string) =>
                    setStepFormData({ descriptionSearch: term || null })
                  }
                  required={SIMULATION_REQUIRED.descriptions}
                />
                <Departments
                  department_ids={formState.department_ids ?? []}
                  department_resources={selectedDepartments}
                  show_departments={(s.departments?.length ?? 0) > 0}
                  departments={s.departments ?? []}
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
                  required={SIMULATION_REQUIRED.departments}
                />
                <Flags
                  flags={s.flags ?? []}
                  values={flagValues}
                  show_flags={(s.flags?.length ?? 0) > 0}
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
              </div>
            </StepCard>
          );
        case "scenarios": {
          const scenarioSearch =
            (stepFormData["scenarioSearch"] as string | undefined) ?? null;
          const scenarioShowSelected =
            (stepFormData["scenarioShowSelected"] as boolean | undefined) ??
            false;
          const hasSelectedScenarios =
            (formState.scenario_ids ?? []).length > 0;
          const showScenarioFlags =
            (s.scenario_flags?.length ?? 0) > 0 || hasSelectedScenarios;
          const showScenarioPositions =
            (s.scenario_positions?.length ?? 0) > 0 || hasSelectedScenarios;
          const showScenarioRubrics =
            (s.scenario_rubrics?.length ?? 0) > 0 || hasSelectedScenarios;
          const showScenarioTimeLimits =
            (s.scenario_time_limits?.length ?? 0) > 0 || hasSelectedScenarios;

          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              resetFields={[
                "scenario_ids",
                "scenario_flag_ids",
                "scenario_position_ids",
                "scenario_rubric_ids",
                "scenario_time_limit_ids",
                "scenarioSearch",
                "scenarioShowSelected",
              ]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              filters={[
                {
                  key: "scenarioShowSelected",
                  label: "Show selected only",
                  value: scenarioShowSelected,
                  onChange: (value: boolean) =>
                    setStepFormData({ scenarioShowSelected: value }),
                },
              ]}
              searchTerm={scenarioSearch ?? ""}
              onSearchChange={(term: string) =>
                setStepFormData({ scenarioSearch: term || null })
              }
              searchPlaceholder="Search scenarios..."
              actions={
                stepResources["scenarios"]?.length &&
                s?.show_ai_generate ? (
                  <StepCardAiButton
                    stepId="scenarios"
                    resourceTypes={stepResources["scenarios"]}
                    canRegenerate={(rt: string) => canRegenerate(rt)}
                    isGenerating={(rt: string) =>
                      isGenerating(rt as SimulationResourceType)
                    }
                    onOpenModal={handleDirectStepGenerate}
                    disabled={disabled}
                  />
                ) : undefined
              }
            >
              <div className="space-y-6">
                <Scenarios
                  scenario_ids={formState.scenario_ids ?? []}
                  scenario_resources={selectedScenarios}
                  show_scenarios={(s.scenarios?.length ?? 0) > 0 || SIMULATION_REQUIRED.scenarios}
                  scenarios={s.scenarios ?? []}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({ ...prev, scenario_ids: ids }))
                  }
                  required={SIMULATION_REQUIRED.scenarios}
                  searchTerm={scenarioSearch ?? ""}
                  showSelectedOnly={scenarioShowSelected}
                />
                <ScenarioFlags
                  options={(s as unknown as { scenario_flag_options?: Array<{ scenario_id?: string | null; flag_id?: string | null; type?: string | null; value?: boolean | null; name?: string | null; description?: string | null; icon?: string | null }> }).scenario_flag_options ?? []}
                  existing={s.scenario_flags ?? []}
                  values={scenarioFlagValues}
                  scenarios={s.scenarios ?? []}
                  onChange={handleScenarioFlagToggle}
                  show_scenario_flags={showScenarioFlags}
                  disabled={disabled}
                />
                <ScenarioPositions
                  scenario_position_ids={formState.scenario_position_ids ?? []}
                  scenario_position_resources={selectedScenarioPositions}
                  show_scenario_positions={showScenarioPositions}
                  scenario_positions={s.scenario_positions ?? []}
                  scenarios={s.scenarios ?? []}
                  scenario_resources={selectedScenarios}
                  disabled={disabled}
                  onChange={() => {}}
                  onPositionIdsChange={(ids) =>
                    setFormState((prev) => {
                      if (JSON.stringify(prev.scenario_position_ids) === JSON.stringify(ids)) return prev;
                      return { ...prev, scenario_position_ids: ids };
                    })
                  }
                  simulation_id={simulationId || null}
                  scenario_ids={formState.scenario_ids}
                  required={SIMULATION_REQUIRED.scenario_positions}
                  onScenarioPositionValues={(positions) =>
                    setFormState((prev) => {
                      const nextVal = positions.length > 0 ? positions : null;
                      if (JSON.stringify(prev.scenario_positions) === JSON.stringify(nextVal)) return prev;
                      return { ...prev, scenario_positions: nextVal };
                    })
                  }
                />
                <ScenarioRubrics
                  scenario_rubric_resources={selectedScenarioRubrics}
                  show_scenario_rubrics={showScenarioRubrics}
                  rubrics={(s.rubrics ?? [])
                    .filter((rubric) => rubric.id && rubric.name)
                    .map((rubric) => ({
                      id: rubric.id ?? null,
                      name: rubric.name ?? null,
                      description: rubric.description ?? null,
                    }))}
                  scenario_ids={formState.scenario_ids ?? []}
                  scenarios={s.scenarios ?? []}
                  scenario_resources={selectedScenarios}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({
                      ...prev,
                      scenario_rubric_ids: ids,
                  }))
                  }
                  required={SIMULATION_REQUIRED.scenario_rubrics}
                  onScenarioRubricValues={(rubrics) =>
                    setFormState((prev) => ({
                      ...prev,
                      scenario_rubrics: rubrics.length > 0 ? rubrics : null,
                    }))
                  }
                />
                <ScenarioTimeLimits
                  scenario_time_limit_ids={
                    formState.scenario_time_limit_ids ?? []
                  }
                  scenario_time_limit_resources={selectedScenarioTimeLimits}
                  show_scenario_time_limits={showScenarioTimeLimits}
                  scenario_ids={formState.scenario_ids ?? []}
                  scenarios={s.scenarios ?? []}
                  scenario_resources={selectedScenarios}
                  disabled={disabled}
                  onTimeLimitIdsChange={(ids) =>
                    setFormState((prev) => {
                      if (JSON.stringify(prev.scenario_time_limit_ids) === JSON.stringify(ids)) return prev;
                      return { ...prev, scenario_time_limit_ids: ids };
                    })
                  }
                  required={SIMULATION_REQUIRED.scenario_time_limits}
                  onScenarioTimeLimitValues={(timeLimits) =>
                    setFormState((prev) => {
                      const nextVal = timeLimits.length > 0 ? timeLimits : null;
                      if (JSON.stringify(prev.scenario_time_limits) === JSON.stringify(nextVal)) return prev;
                      return { ...prev, scenario_time_limits: nextVal };
                    })
                  }
                  allowUnlimited={allowUnlimitedTimeLimits}
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
      stableSimulationDataFields,
      formState,
      disabled,
      isEditMode,
      simulationId,
      handleGenerateScenarios,
      handleGenerateScenarioFlags,
      handleGenerateScenarioPositions,
      handleGenerateScenarioRubrics,
      handleGenerateScenarioTimeLimits,
      isGenerating,
      stepResources,
      canRegenerate,
      handleDirectStepGenerate,
      scenarioResourcesWithShowHints,
      scenarioFlagValues,
      handleScenarioFlagToggle,
      flagValues,
      handleFlagToggle,
      isAutosaveEnabled,
    ],
  );

  if (!stableSimulationDataFields) {
    return <div>Loading simulation data...</div>;
  }

  return (
    <TooltipProvider>
      <div
        className="w-full p-6 space-y-8"
        data-page={`simulation-${isEditMode ? "edit" : "new"}`}
      >
        <ReadOnlyBanner
          disabled={disabled}
          disabledReason={stableSimulationDataFields?.disabled_reason ?? null}
          entityType="simulation"
        />

        <GenericForm
          nuqsParsers={
            simulationSearchParamsClient as Record<string, Parser<unknown>>
          }
          steps={steps}
          getStepStatus={getStepStatus}
          serverData={simulationData as SimulationData}
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

export default React.memo(SimulationComponent);
