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
import { StepCard } from "@/components/common/forms/StepCard";
import type { GenerateRegenerateModalResource } from "@/components/common/GenerateRegenerateModal";
import { GenerateRegenerateModal } from "@/components/common/GenerateRegenerateModal";
import { ReadOnlyBanner } from "@/components/common/ReadOnlyBanner";
import { Departments } from "@/components/resources/Departments";
import { Descriptions } from "@/components/resources/Descriptions";
import { Flags } from "@/components/resources/Flags";
import { Names } from "@/components/resources/Names";
import {
  SimulationPositions,
  type SimulationPositionItem,
} from "@/components/resources/SimulationPositions";
import { Simulations } from "@/components/resources/Simulations";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useGenerationContext } from "@/contexts/generation-context";
import { useProfile } from "@/contexts/profile-context";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { ResourceType } from "@/lib/resources/types";
import { Loader2, Sparkles } from "lucide-react";
import { parseAsBoolean, parseAsString, type Parser } from "nuqs";

// Types defined inline using InputOf/OutputOf
type SaveCohortIn = InputOf<"/api/v4/cohorts/save", "post">;
type SaveCohortOut = OutputOf<"/api/v4/cohorts/save", "post">;
type CreateDraftNamesIn = InputOf<"/api/v4/resources/names", "post">;
type CreateDraftNamesOut = OutputOf<"/api/v4/resources/names", "post">;
type CreateDraftDescriptionsIn = InputOf<
  "/api/v4/resources/descriptions",
  "post"
>;
type CreateDraftDescriptionsOut = OutputOf<
  "/api/v4/resources/descriptions",
  "post"
>;
type CreateDraftFlagsIn = InputOf<"/api/v4/resources/flags", "post">;
type CreateDraftFlagsOut = OutputOf<"/api/v4/resources/flags", "post">;
type CreateDraftDepartmentsIn = InputOf<
  "/api/v4/resources/departments",
  "post"
>;
type CreateDraftDepartmentsOut = OutputOf<
  "/api/v4/resources/departments",
  "post"
>;
type CreateDraftSimulationsIn = InputOf<
  "/api/v4/resources/simulations",
  "post"
>;
type CreateDraftSimulationsOut = OutputOf<
  "/api/v4/resources/simulations",
  "post"
>;
type CreateDraftSimulationPositionsIn = InputOf<
  "/api/v4/resources/simulation_positions",
  "post"
>;
type CreateDraftSimulationPositionsOut = OutputOf<
  "/api/v4/resources/simulation_positions",
  "post"
>;
type PatchCohortDraftIn = InputOf<"/api/v4/cohorts/draft", "patch">;
type PatchCohortDraftOut = OutputOf<"/api/v4/cohorts/draft", "patch">;

type CohortData = OutputOf<"/api/v4/cohorts/get", "post">;

export interface CohortProps {
  cohortId?: string;
  // Server-provided data (for server-side rendering)
  cohortData?: CohortData;
  // Server actions (replaces useMutation)
  saveCohortAction?: (input: SaveCohortIn) => Promise<SaveCohortOut>;
  patchCohortDraftAction?: (
    input: PatchCohortDraftIn
  ) => Promise<PatchCohortDraftOut>;
  // Resource creation actions
  createNamesAction?: (
    input: CreateDraftNamesIn
  ) => Promise<CreateDraftNamesOut>;
  createDescriptionsAction?: (
    input: CreateDraftDescriptionsIn
  ) => Promise<CreateDraftDescriptionsOut>;
  createFlagsAction?: (
    input: CreateDraftFlagsIn
  ) => Promise<CreateDraftFlagsOut>;
  createDepartmentsAction?: (
    input: CreateDraftDepartmentsIn
  ) => Promise<CreateDraftDepartmentsOut>;
  createSimulationsAction?: (
    input: CreateDraftSimulationsIn
  ) => Promise<CreateDraftSimulationsOut>;
  createSimulationPositionsAction?: (
    input: CreateDraftSimulationPositionsIn
  ) => Promise<CreateDraftSimulationPositionsOut>;
}

function CohortComponent({
  cohortId,
  cohortData,
  saveCohortAction,
  patchCohortDraftAction,
  createNamesAction,
  createDescriptionsAction,
  createFlagsAction,
  createDepartmentsAction,
  createSimulationsAction,
  createSimulationPositionsAction,
}: CohortProps) {
  const router = useRouter();
  const isEditMode = !!cohortId;
  const {
    effectiveProfile,
    selectedDraftId,
    setSelectedDraftId,
    socket,
    isConnected,
  } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const { setGenerationCapability, clearGenerationCapability } =
    useGenerationContext();

  // Generation state for AI workflows - simplified using ResourceType
  const [generatingResources, setGeneratingResources] = useState<
    Set<ResourceType>
  >(new Set());

  // Modal state for generate/regenerate
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [modalMode, setModalMode] = useState<"generate" | "regenerate" | null>(
    null
  );
  const [modalResources, setModalResources] = useState<
    GenerateRegenerateModalResource[]
  >([]);
  const [modalInstructions, setModalInstructions] = useState("");

  const isGenerating = useCallback(
    (resourceType: ResourceType) => generatingResources.has(resourceType),
    [generatingResources]
  );

  // nuqs parsers for URL-backed state (will be passed to GenericForm)
  // Memoize to prevent new object reference on every render
  const cohortSearchParamsClient = useMemo(
    () => ({
      // Draft ID (URL-backed, updated when draft is created)
      draftId: parseAsString,
      // Search params (URL-backed, updated via debounced callback in StepCard)
      descriptionSearch: parseAsString,
      simulationSearch: parseAsString,
      // Filter params (URL-backed)
      simulationShowSelected: parseAsBoolean,
    }),
    []
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
      group_id: cohortData.group_id,
      name_resource: cohortData.name_resource,
      show_name: cohortData.show_name,
      name_suggestions: cohortData.name_suggestions,
      names: cohortData.names,
      name_required: cohortData.name_required,
      name_agent_id: cohortData.name_agent_id,
      description_resource: cohortData.description_resource,
      show_description: cohortData.show_description,
      description_suggestions: cohortData.description_suggestions,
      description_required: cohortData.description_required,
      description_agent_id: cohortData.description_agent_id,
      descriptions: cohortData.descriptions,
      department_resources: cohortData.department_resources,
      show_departments: cohortData.show_departments,
      department_suggestions: cohortData.department_suggestions,
      departments_required: cohortData.departments_required,
      departments_agent_id: cohortData.departments_agent_id,
      departments: cohortData.departments,
      flag_resource: cohortData.flag_resource,
      show_flag: cohortData.show_flag,
      flag_required: cohortData.flag_required,
      flag_agent_id: cohortData.flag_agent_id,
      simulation_resources: cohortData.simulation_resources,
      show_simulations: cohortData.show_simulations,
      simulation_suggestions: cohortData.simulation_suggestions,
      simulations_required: cohortData.simulations_required,
      simulations_agent_id: cohortData.simulations_agent_id,
      simulations: cohortData.simulations,
      simulation_positions: cohortData.simulation_positions,
      show_simulation_positions: cohortData.show_simulation_positions,
      simulation_positions_required: cohortData.simulation_positions_required,
      simulation_positions_agent_id: cohortData.simulation_positions_agent_id,
      basic_agent_id: cohortData.basic_agent_id,
    };
    // Intentionally depend on individual fields, not whole cohortData object
    // to prevent recreation when only object reference changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    cohortData?.group_id,
    cohortData?.name_resource,
    cohortData?.show_name,
    cohortData?.name_suggestions,
    cohortData?.names,
    cohortData?.name_required,
    cohortData?.name_agent_id,
    cohortData?.description_resource,
    cohortData?.show_description,
    cohortData?.description_suggestions,
    cohortData?.description_required,
    cohortData?.description_agent_id,
    cohortData?.descriptions,
    cohortData?.department_resources,
    cohortData?.show_departments,
    cohortData?.department_suggestions,
    cohortData?.departments_required,
    cohortData?.departments_agent_id,
    cohortData?.departments,
    cohortData?.flag_resource,
    cohortData?.show_flag,
    cohortData?.flag_required,
    cohortData?.flag_agent_id,
    cohortData?.simulation_resources,
    cohortData?.show_simulations,
    cohortData?.simulation_suggestions,
    cohortData?.simulations_required,
    cohortData?.simulations_agent_id,
    cohortData?.simulations,
    cohortData?.simulation_positions,
    cohortData?.show_simulation_positions,
    cohortData?.simulation_positions_required,
    cohortData?.simulation_positions_agent_id,
    cohortData?.basic_agent_id,
  ]);

  // Helper to check if a resource type can be regenerated
  // Use stableCohortDataFields to prevent callback recreation when cohortData object reference changes
  const canRegenerate = useCallback(
    (resourceType: ResourceType): boolean => {
      if (!stableCohortDataFields) return false;
      switch (resourceType) {
        case "names":
          return stableCohortDataFields.name_resource?.generated ?? false;
        case "descriptions":
          return (
            stableCohortDataFields.description_resource?.generated ?? false
          );
        case "flags":
          return stableCohortDataFields.flag_resource?.generated ?? false;
        case "departments":
          return (
            stableCohortDataFields.department_resources?.some(
              (d) => d.generated
            ) ?? false
          );
        case "simulations":
          return (
            stableCohortDataFields.simulation_resources?.some(
              (s) => s.generated
            ) ?? false
          );
        case "simulation_positions":
          return (
            stableCohortDataFields.simulation_positions?.some(
              (p) => p.generated
            ) ?? false
          );
        default:
          return false;
      }
    },
    [stableCohortDataFields]
  );

  const getInitialFormState = useCallback(() => {
    const data = cohortDataRef.current;
    if (!data) {
      return {
        name_id: null as string | null,
        description_id: null as string | null,
        active_flag_id: null as string | null,
        department_ids: [] as string[],
        simulation_ids: [] as string[],
        simulation_positions: [] as SimulationPositionItem[],
      };
    }
    // Extract resource IDs from server data
    // Note: Server data may have display values, but we only store IDs here
    return {
      name_id: data.name_id ?? null,
      description_id: data.description_id ?? null,
      active_flag_id: data.active_flag_id ?? null,
      department_ids: data.department_ids ?? [],
      simulation_ids: data.simulation_ids ?? [],
      simulation_positions: data.simulation_positions ?? [],
    };
    // Remove cohortData from dependencies - use ref instead to prevent callback recreation
  }, []);

  const [formState, setFormState] = useState(getInitialFormState);
  // Use ref to access formState in renderStep without depending on it
  const formStateRef = React.useRef(formState);
  React.useEffect(() => {
    formStateRef.current = formState;
  }, [formState]);

  // Memoize stringified array dependencies to prevent effect from running when array references change but content is same
  const departmentIdsStr = React.useMemo(
    () => JSON.stringify(cohortData?.department_ids ?? []),
    [cohortData?.department_ids]
  );
  const simulationIdsStr = React.useMemo(
    () => JSON.stringify(cohortData?.simulation_ids ?? []),
    [cohortData?.simulation_ids]
  );
  const simulationPositionsStr = React.useMemo(
    () => JSON.stringify(cohortData?.simulation_positions ?? []),
    [cohortData?.simulation_positions]
  );

  // Memoize stringified formState arrays for draft listener effect dependencies
  const formStateDepartmentIdsStr = React.useMemo(
    () => JSON.stringify(formState.department_ids),
    [formState.department_ids]
  );
  const formStateSimulationIdsStr = React.useMemo(
    () => JSON.stringify(formState.simulation_ids),
    [formState.simulation_ids]
  );
  const formStateSimulationPositionsStr = React.useMemo(
    () => JSON.stringify(formState.simulation_positions),
    [formState.simulation_positions]
  );

  // Update form state when server data changes
  // Use cohortData directly in dependency array, not getInitialFormState
  useEffect(() => {
    const newState = getInitialFormState();
    setFormState((prev) => {
      // Only update if resource IDs actually changed
      if (
        prev.name_id !== newState.name_id ||
        prev.description_id !== newState.description_id ||
        prev.active_flag_id !== newState.active_flag_id ||
        JSON.stringify(prev.department_ids) !==
          JSON.stringify(newState.department_ids) ||
        JSON.stringify(prev.simulation_ids) !==
          JSON.stringify(newState.simulation_ids) ||
        JSON.stringify(prev.simulation_positions) !==
          JSON.stringify(newState.simulation_positions)
      ) {
        return newState;
      }
      return prev;
    });
    // Use stringified arrays in dependencies to prevent effect from running when array references change but content is same
    // Intentionally exclude formState and getInitialFormState to prevent infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    cohortData?.name_id,
    cohortData?.description_id,
    cohortData?.active_flag_id,
    departmentIdsStr,
    simulationIdsStr,
    simulationPositionsStr,
  ]);

  // Draft version tracking for optimistic concurrency control
  // Keep version in a ref so updating it doesn't retrigger the effect
  const [lastSavedVersion, setLastSavedVersion] = useState(0);
  const lastSavedVersionRef = React.useRef(0);
  React.useEffect(() => {
    lastSavedVersionRef.current = lastSavedVersion;
  }, [lastSavedVersion]);
  // Sync draft_version from server to avoid unintended draft forks.
  const draftVersion =
    cohortData && "draft_version" in cohortData
      ? (cohortData as { draft_version?: number | null }).draft_version
      : null;
  // Track if version has been synced from server to prevent patching before sync
  const versionSyncedRef = React.useRef(false);
  React.useEffect(() => {
    if (
      typeof draftVersion === "number" &&
      draftVersion !== lastSavedVersionRef.current
    ) {
      setLastSavedVersion(draftVersion);
      lastSavedVersionRef.current = draftVersion;
    }
    versionSyncedRef.current = true; // Mark as synced
  }, [draftVersion]);

  // Get draftId from GenericForm's URL state via bridge (GenericForm is single source of truth)
  const [draftId, setDraftId] = useState<string | null>(null);
  const setUrlFormDataRef = React.useRef<
    null | ((updates: Record<string, unknown>) => void)
  >(null);

  // Store formData from GenericForm to access search params
  const formDataRef = React.useRef<Record<string, unknown>>({});

  // Memoized callback to sync draftId from GenericForm - only update if value changed
  const onFormDataChange = React.useCallback((fd: Record<string, unknown>) => {
    // Store formData for access in handleGenerateResources
    formDataRef.current = fd;
    const next = (fd["draftId"] as string | undefined) ?? null;
    setDraftId((prev) => (prev === next ? prev : next));
  }, []);

  // Sync URL draftId to profile context
  useEffect(() => {
    if (draftId !== selectedDraftId) {
      setSelectedDraftId(draftId);
    }
  }, [draftId, selectedDraftId, setSelectedDraftId]);

  // Use ref to stabilize patchCohortDraftAction to prevent effect recreation when prop reference changes
  const patchCohortDraftActionRef = React.useRef(patchCohortDraftAction);
  React.useEffect(() => {
    patchCohortDraftActionRef.current = patchCohortDraftAction;
  }, [patchCohortDraftAction]);

  // Build a stable key for "what would we patch" - only changes when form data actually changes
  const draftPatchKey = React.useMemo(() => {
    return JSON.stringify({
      draftId: draftId || null,
      name_id: formState.name_id,
      description_id: formState.description_id,
      active_flag_id: formState.active_flag_id,
      department_ids: formState.department_ids,
      simulation_ids: formState.simulation_ids,
      simulation_positions: formState.simulation_positions,
    });
    // Use stringified arrays to prevent recreation when array references change but content is same
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    draftId,
    formState.name_id,
    formState.description_id,
    formState.active_flag_id,
    formStateDepartmentIdsStr,
    formStateSimulationIdsStr,
    formStateSimulationPositionsStr,
  ]);

  // Track last patched payload so we don't repatch identical state
  const lastPatchedKeyRef = React.useRef<string | null>(null);

  // Track if there are pending changes for beforeunload warning
  const hasPendingChangesRef = React.useRef(false);

  // Draft change listener - watches resource IDs and patches draft
  // Only triggers when the payload actually changes, not when version changes
  useEffect(() => {
    const hasResourceIds =
      formState.name_id ||
      formState.description_id ||
      formState.active_flag_id ||
      formState.department_ids.length > 0 ||
      formState.simulation_ids.length > 0;

    // Debug logging at effect start
    console.debug("[Cohort Draft] Effect triggered", {
      hasResourceIds,
      draftPatchKey: draftPatchKey.substring(0, 100) + "...",
      lastPatchedKey: lastPatchedKeyRef.current?.substring(0, 50),
    });

    if (!hasResourceIds || !patchCohortDraftActionRef.current) {
      return;
    }

    // Wait for version sync before patching to prevent race conditions
    // Only block if there's an actual numeric version to sync (not null for new cohorts)
    if (typeof cohortData?.draft_version === "number" && !versionSyncedRef.current) {
      console.debug("[Cohort Draft] Waiting for version sync");
      return;
    }

    // ✅ If nothing changed since the last successful patch, do nothing.
    if (lastPatchedKeyRef.current === draftPatchKey) {
      return;
    }

    // Mark that we have pending changes (for beforeunload warning)
    hasPendingChangesRef.current = true;

    const timer = setTimeout(async () => {
      try {
        if (!patchCohortDraftActionRef.current) return;

        // Debug logging before API call
        console.debug("[Cohort Draft] Calling patch API", {
          input_draft_id: draftId,
          expected_version: lastSavedVersionRef.current,
          fields: Object.keys(formState).filter(k => formState[k as keyof typeof formState]),
        });

        const result = await patchCohortDraftActionRef.current({
          body: {
            input_draft_id: draftId || null,
            name_id: formState.name_id,
            description_id: formState.description_id,
            active_flag_id: formState.active_flag_id,
            department_ids: formState.department_ids,
            simulation_ids: formState.simulation_ids,
            simulation_position_values:
              formState.simulation_positions.length > 0
                ? formState.simulation_ids.map(
                    (simulationId, index) =>
                      formState.simulation_positions.find(
                        (position) => position.simulation_id === simulationId
                      )?.value ?? index + 1
                  )
                : null,
            expected_version: lastSavedVersionRef.current, // ✅ ref, not state dep
          },
        });

        // Mark this payload as patched so we don't loop
        lastPatchedKeyRef.current = draftPatchKey;

        if (!draftId && result.draft_id) {
          // Update URL when draft is created via GenericForm bridge (GenericForm owns URL state)
          toast.success("Draft created", {
            description: "Your changes are being auto-saved",
          });
          setUrlFormDataRef.current?.({ draftId: result.draft_id });
        } else if (result.draft_id && result.draft_id !== draftId) {
          // Sync URL to server-returned draft_id to avoid stale draft mismatch
          setUrlFormDataRef.current?.({ draftId: result.draft_id });
        }

        // Debug logging after success
        console.debug("[Cohort Draft] Patch succeeded", {
          draft_id: result.draft_id,
          new_version: result.new_version,
        });

        // This can stay as state (for UI), but it won't re-trigger patching
        // because the effect is gated by payload changes.
        if ((result.new_version ?? 0) !== lastSavedVersionRef.current) {
          setLastSavedVersion(result.new_version ?? 0);
          lastSavedVersionRef.current = result.new_version ?? 0;
        }

        // Clear pending changes flag after successful save
        hasPendingChangesRef.current = false;
      } catch (error) {
        // Log error for debugging
        console.error("[Cohort Draft] Patch failed:", error);
        // Show user feedback
        toast.error("Failed to save draft", {
          description: "Your changes may not have been saved. Please try again.",
        });
        // Don't update lastPatchedKeyRef on failure so we retry on next change
      }
    }, 1000);

    return () => clearTimeout(timer);
    // ✅ Trigger only when payload changes, not when version changes
    // patchCohortDraftAction and setDraftId are accessed via refs to prevent effect recreation
    // when prop/function references change but functionality is the same
    // We access formState fields and draftId inside the effect, but depend on draftPatchKey
    // to prevent unnecessary effect recreation when individual fields change but payload is same
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    draftPatchKey, // ✅ trigger only when payload changes
    // patchCohortDraftAction and setDraftId are accessed via refs
  ]);

  // Warn users about unsaved changes when navigating away
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasPendingChangesRef.current) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes.";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // WebSocket handlers for AI generation - unified handler for all resource types
  // Note: Cohort generation events may not exist yet, but structure is ready
  useEffect(() => {
    if (!socket || !isConnected) return;

    // Use single group_id from cohortData (no need to track multiple)
    const currentGroupId = cohortData?.group_id;

    const handleGenerationComplete = (data: {
      artifact_type?: string;
      group_id?: string;
      resource_type?: string;
      name_id?: string | null;
      description_id?: string | null;
      active_flag_id?: string | null;
      department_ids?: string[];
      simulation_ids?: string[];
      simulation_positions?: Array<{
        simulation_id?: string | null;
        value?: number | null;
        generated?: boolean | null;
        mcp?: boolean | null;
      }>;
      message?: string;
      success?: boolean;
      [key: string]: unknown;
    }) => {
      // Filter by artifact_type and group_id
      if (
        data.artifact_type !== "cohort" ||
        !data.group_id ||
        data.group_id !== currentGroupId
      ) {
        return; // Not for this cohort or wrong group_id
      }

      const validResourceTypes: ResourceType[] = [
        "names",
        "descriptions",
        "flags",
        "departments",
        "simulations",
        "simulation_positions",
      ];
      if (
        data.resource_type &&
        validResourceTypes.includes(data.resource_type as ResourceType)
      ) {
        if (data.resource_type === "simulation_positions") {
          if (
            data.simulation_positions &&
            data.simulation_positions.length > 0
          ) {
            setFormState((prev) => {
              const nextPositions = new Map<string, SimulationPositionItem>();
              prev.simulation_positions.forEach((pos) => {
                if (pos.simulation_id) {
                  nextPositions.set(pos.simulation_id, pos);
                }
              });
              data.simulation_positions?.forEach((pos) => {
                if (
                  pos.simulation_id &&
                  pos.value !== null &&
                  pos.value !== undefined
                ) {
                  nextPositions.set(pos.simulation_id, {
                    simulation_id: pos.simulation_id,
                    value: pos.value,
                    generated: pos.generated ?? false,
                  });
                }
              });
              const merged = Array.from(nextPositions.values()).sort((a, b) => {
                if (a.value !== b.value) return a.value - b.value;
                return a.simulation_id.localeCompare(b.simulation_id);
              });
              return { ...prev, simulation_positions: merged };
            });
          }
          setGeneratingResources((prev) => {
            const next = new Set(prev);
            next.delete("simulation_positions");
            return next;
          });
          if (data.success) {
            toast.success(
              data.message || "Simulation positions generated successfully"
            );
          } else {
            toast.error(
              data.message || "Failed to generate simulation positions"
            );
          }
          return;
        }

        // Update formState with the resource ID that was generated
        // Only update the field that matches resource_type (others will be null)
        setFormState((prev) => {
          const updates: Partial<typeof prev> = {};

          if (data.name_id) updates.name_id = data.name_id;
          if (data.description_id) updates.description_id = data.description_id;
          if (data.active_flag_id) updates.active_flag_id = data.active_flag_id;
          if (data.department_ids && data.department_ids.length > 0) {
            // For arrays, append new IDs (avoid duplicates)
            const newDeptIds = data.department_ids.filter(
              (id) => !prev.department_ids.includes(id)
            );
            updates.department_ids = [...prev.department_ids, ...newDeptIds];
          }
          if (data.simulation_ids && data.simulation_ids.length > 0) {
            // For arrays, append new IDs (avoid duplicates)
            const newSimIds = data.simulation_ids.filter(
              (id) => !prev.simulation_ids.includes(id)
            );
            updates.simulation_ids = [...prev.simulation_ids, ...newSimIds];
          }

          return { ...prev, ...updates };
        });

        setGeneratingResources((prev) => {
          const next = new Set(prev);
          next.delete(data.resource_type as ResourceType);
          return next;
        });
        if (data.success) {
          toast.success(
            data.message || `${data.resource_type} generated successfully`
          );
        } else {
          toast.error(
            data.message || `Failed to generate ${data.resource_type}`
          );
        }
      }
    };

    const handleGenerationProgress = (data: {
      artifact_type?: string;
      group_id?: string;
      resource_type?: string;
      [key: string]: unknown;
    }) => {
      // Filter by artifact_type and group_id
      if (
        data.artifact_type !== "cohort" ||
        !data.group_id ||
        data.group_id !== currentGroupId
      ) {
        return; // Not for this cohort or wrong group_id
      }
      // Handle progress updates if needed
    };

    const handleGenerationError = (data: {
      artifact_type?: string;
      group_id?: string;
      message?: string;
      resource_type?: string;
      resource_types?: string[];
    }) => {
      // Filter by artifact_type and group_id
      if (
        data.artifact_type !== "cohort" ||
        !data.group_id ||
        data.group_id !== currentGroupId
      ) {
        return; // Not for this cohort or wrong group_id
      }

      const validResourceTypes: ResourceType[] = [
        "names",
        "descriptions",
        "flags",
        "departments",
        "simulations",
        "simulation_positions",
      ];
      const resourceTypes =
        data.resource_types || (data.resource_type ? [data.resource_type] : []);
      setGeneratingResources((prev) => {
        const next = new Set(prev);
        resourceTypes.forEach((rt) => {
          if (validResourceTypes.includes(rt as ResourceType)) {
            next.delete(rt as ResourceType);
          }
        });
        return next;
      });
      toast.error(data.message || "Generation failed");
    };

    // Listen to cohort-specific events filtered by artifact_type and group_id
    // Note: These events may not exist yet, but structure is ready
    socket.on("cohort_generation_progress", handleGenerationProgress);
    socket.on("cohort_generation_complete", handleGenerationComplete);
    socket.on("cohort_generation_error", handleGenerationError);

    return () => {
      socket.off("cohort_generation_progress", handleGenerationProgress);
      socket.off("cohort_generation_complete", handleGenerationComplete);
      socket.off("cohort_generation_error", handleGenerationError);
    };
  }, [socket, isConnected, cohortData?.group_id, router]);

  // Multi-generation handler - accepts list of resource types and optional user instructions
  // Helper function to determine agent_type from resource types
  const determineAgentType = useCallback(
    (resourceTypes: ResourceType[]): string | null => {
      const basicResources: ResourceType[] = [
        "names",
        "descriptions",
        "flags",
        "departments",
      ];
      const allResourceTypes: ResourceType[] = [
        "names",
        "descriptions",
        "flags",
        "departments",
        "simulations",
        "simulation_positions",
      ];

      const isBasicCombo =
        resourceTypes.length === basicResources.length &&
        resourceTypes.every((rt) => basicResources.includes(rt));
      const isAllResources =
        resourceTypes.length === allResourceTypes.length &&
        resourceTypes.every((rt) => allResourceTypes.includes(rt));

      if (isAllResources) {
        return "general";
      } else if (isBasicCombo) {
        return "basic";
      } else if (resourceTypes.length === 1) {
        // Single resource type - map to agent_type
        const agentTypeMap: Record<ResourceType, string> = {
          names: "name",
          descriptions: "description",
          flags: "flags",
          departments: "departments",
          simulations: "simulations",
          simulation_positions: "simulation_positions",
        };
        const firstType = resourceTypes[0];
        if (firstType && firstType in agentTypeMap) {
          return agentTypeMap[firstType];
        }
      }
      return null;
    },
    []
  );

  const handleGenerateResources = useCallback(
    async (
      resourceTypes: ResourceType[],
      agentType: string | null,
      userInstructions?: string
    ) => {
      if (!socket || !isConnected) {
        toast.error("WebSocket not connected");
        return;
      }

      // Set all resources as generating
      setGeneratingResources((prev) => {
        const next = new Set(prev);
        resourceTypes.forEach((rt) => next.add(rt));
        return next;
      });

      // Read search params from formData
      const formData = formDataRef.current;
      const draftId = (formData["draftId"] as string | undefined) ?? null;
      const descriptionSearch =
        (formData["descriptionSearch"] as string | undefined) ?? null;
      const simulationSearch =
        (formData["simulationSearch"] as string | undefined) ?? null;
      const simulationShowSelected =
        (formData["simulationShowSelected"] as boolean | undefined) ?? false;

      // Emit cohort_generate event with GetCohortApiRequest fields
      // Note: This event may not exist yet, but structure is ready
      socket.emit("cohort_generate", {
        resource_types: resourceTypes, // Simple array of strings
        agent_type: agentType,
        user_instructions: userInstructions ? [userInstructions] : null,
        // GetCohortApiRequest fields from formData
        draft_id: draftId || null,
        descriptions_search: descriptionSearch || null,
        simulation_search: simulationSearch || null,
        simulation_show_selected: simulationShowSelected || false,
        mcp: false,
        cohort_id: cohortId || null,
      });
    },
    [socket, isConnected, cohortId]
  );

  // Individual generation handlers - generate directly without modals
  const handleGenerateName = useCallback(
    async () =>
      handleGenerateResources(["names"], determineAgentType(["names"])),
    [handleGenerateResources, determineAgentType]
  );

  const handleGenerateDescription = useCallback(
    async () =>
      handleGenerateResources(
        ["descriptions"],
        determineAgentType(["descriptions"])
      ),
    [handleGenerateResources, determineAgentType]
  );

  const handleGenerateDepartments = useCallback(
    async () =>
      handleGenerateResources(
        ["departments"],
        determineAgentType(["departments"])
      ),
    [handleGenerateResources, determineAgentType]
  );

  const handleGenerateFlags = useCallback(
    async () =>
      handleGenerateResources(["flags"], determineAgentType(["flags"])),
    [handleGenerateResources, determineAgentType]
  );

  const handleGenerateSimulations = useCallback(
    async () =>
      handleGenerateResources(
        ["simulations"],
        determineAgentType(["simulations"])
      ),
    [handleGenerateResources, determineAgentType]
  );

  const handleGenerateSimulationPositions = useCallback(
    async () =>
      handleGenerateResources(
        ["simulation_positions"],
        determineAgentType(["simulation_positions"])
      ),
    [handleGenerateResources, determineAgentType]
  );

  // Disabled logic based on can_edit flag - standardized for all resource components
  // Check can_edit in both new and edit modes to show disabled_reason when agents are missing
  const disabled = useMemo(() => {
    if (!cohortData) return false;
    return !cohortData.can_edit;
  }, [cohortData]);

  // Set breadcrumb context when cohort data is loaded
  useEffect(() => {
    const cohortName = cohortData?.name_resource?.name;
    if (cohortName && cohortId && isEditMode) {
      setEntityMetadata({
        entityId: cohortId,
        entityName: cohortName,
        entityType: "cohort",
      });
    }
    return () => clearEntityMetadata();
  }, [
    cohortData,
    cohortId,
    isEditMode,
    setEntityMetadata,
    clearEntityMetadata,
  ]);

  // Set generation capability when cohort data is loaded
  useEffect(() => {
    if (cohortData?.general_agent_id) {
      setGenerationCapability({
        artifactType: "cohort",
        canGenerate: true,
        agentId: cohortData.general_agent_id,
      });
    } else {
      setGenerationCapability({
        artifactType: "cohort",
        canGenerate: false,
        agentId: null,
      });
    }
    return () => clearGenerationCapability();
  }, [
    cohortData?.general_agent_id,
    setGenerationCapability,
    clearGenerationCapability,
  ]);

  // Submit handler for GenericForm (uses formState, not formData parameter)
  const handleSubmit = useCallback(
    async (_formData: Record<string, unknown>) => {
      // Validate required resource IDs using {resource}_required flags from cohortData
      if (cohortData?.name_required && !formState.name_id) {
        toast.error("Cohort name is required");
        throw new Error("Cohort name is required");
      }

      if (
        cohortData?.departments_required &&
        (!formState.department_ids || formState.department_ids.length === 0)
      ) {
        toast.error("Departments are required");
        throw new Error("Departments are required");
      }

      // Pass department_ids and simulation_ids directly - SQL handles validation

      // Ensure profileId exists - required for API calls
      if (!effectiveProfile?.id) {
        toast.error("Profile not loaded. Please refresh the page.");
        throw new Error("Profile not loaded");
      }

      if (!saveCohortAction) {
        toast.error("Save action not available");
        throw new Error("Save action not available");
      }

      if (!draftId) {
        toast.error("Draft not ready. Please wait a moment and try again.");
        throw new Error("Draft ID is required");
      }

      // Ensure required fields are present (TypeScript guard)
      if (!formState.name_id) {
        toast.error("Required fields are missing");
        throw new Error("Required fields are missing");
      }

      try {
        await saveCohortAction({
          body: {
            input_cohort_id: isEditMode && cohortId ? cohortId : null,
            draft_id: draftId,
          },
        });
        toast.success(
          `Cohort ${isEditMode ? "updated" : "created"} successfully!`
        );
        router.push("/create/cohorts");
      } catch (error) {
        toast.error(
          `Failed to ${isEditMode ? "update" : "create"} cohort: ${error instanceof Error ? error.message : "Unknown error"}`
        );
        throw error;
      }
    },
    [
      formState,
      isEditMode,
      cohortId,
      effectiveProfile?.id,
      saveCohortAction,
      router,
      cohortData?.name_required,
      cohortData?.departments_required,
    ]
  );

  // Step status logic (for GenericForm) - check resource IDs instead of display values
  const getStepStatus = useCallback(
    (stepId: string, _formData: Record<string, unknown>): StepStatus => {
      // Check resource IDs from formState (components manage their own display state)
      const hasName = !!formState.name_id;
      const hasDescription = !!formState.description_id;
      const hasSimulations = formState.simulation_ids.length > 0;

      switch (stepId) {
        case "basic":
          return hasName && hasDescription ? "completed" : "active";
        case "simulations":
          if (!hasName || !hasDescription) return "pending";
          return hasSimulations ? "completed" : "active";
        default:
          return "pending";
      }
    },
    [formState]
  );

  // Step-to-resources mapping for multi-generation
  const stepResources: Record<string, ResourceType[]> = useMemo(
    () => ({
      basic: ["names", "descriptions", "departments", "flags"],
      simulations: ["simulations"],
      all: [
        "names",
        "descriptions",
        "flags",
        "departments",
        "simulations",
        "simulation_positions",
      ], // All resources for full-page generation
    }),
    []
  );

  // Resource labels for display
  const resourceLabels: Record<ResourceType, string> = useMemo(
    () => ({
      names: "Names",
      descriptions: "Descriptions",
      flags: "Flags",
      departments: "Departments",
      simulations: "Simulations",
      simulation_positions: "Simulation Positions",
      colors: "Colors", // Not used but required by type
      icons: "Icons", // Not used but required by type
      instructions: "Instructions", // Not used but required by type
      examples: "Examples", // Not used but required by type
      fields: "Fields", // Not used but required by type
    }),
    []
  );

  // Handler to open modal for step card generation
  const handleOpenStepCardModal = useCallback(
    (stepId: string, mode: "generate" | "regenerate") => {
      const resourceTypes = stepResources[stepId] || [];
      const resources: GenerateRegenerateModalResource[] = resourceTypes.map(
        (rt) => ({
          id: rt,
          label: resourceLabels[rt],
          active: mode === "regenerate" ? canRegenerate(rt) : true,
        })
      );

      setModalResources(resources);
      setModalMode(mode);
      setModalInstructions("");
      setShowGenerateModal(true);
    },
    [stepResources, resourceLabels, canRegenerate]
  );

  // Handler for modal generate/regenerate action
  const handleModalGenerate = useCallback(
    async (selectedResources: string[], instructions: string) => {
      const resourceTypes = selectedResources as ResourceType[];
      const agentType = determineAgentType(resourceTypes);
      await handleGenerateResources(
        resourceTypes,
        agentType,
        instructions.trim() || undefined
      );
      setShowGenerateModal(false);
      setModalInstructions("");
    },
    [handleGenerateResources, determineAgentType]
  );

  // Listen for full-page-generate event from layout
  useEffect(() => {
    const handleFullPageGenerate = () => {
      if (cohortData?.general_agent_id) {
        // Open modal instead of directly generating
        handleOpenStepCardModal("all", "generate");
      }
    };
    window.addEventListener("full-page-generate", handleFullPageGenerate);
    return () =>
      window.removeEventListener("full-page-generate", handleFullPageGenerate);
  }, [cohortData?.general_agent_id, handleOpenStepCardModal]);

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
    ],
    []
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
    ],
    []
  );

  // Memoize resetSuccessMessage to prevent GenericForm re-renders
  const resetSuccessMessage = useCallback((stepId: string) => {
    switch (stepId) {
      case "basic":
        return "Basic information reset";
      case "simulations":
        return "Simulations reset";
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
            active_flag_id: null,
            department_ids: [],
          };
        case "simulations":
          return {
            ...prev,
            simulation_ids: [],
            simulation_positions: [],
          };
        default:
          return prev;
      }
    });
  }, []);

  // Memoize submitButton to prevent GenericForm re-renders
  const submitButton = useMemo(
    () => ({
      backUrl: "/create/cohorts",
      backLabel: "Back",
      createLabel: "Create Cohort",
      updateLabel: "Update Cohort",
    }),
    []
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
      const currentCohortData = stableCohortDataFields;
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
                  name_resource={currentCohortData?.name_resource ?? null}
                  show_name={currentCohortData?.show_name ?? true}
                  name_suggestions={currentCohortData?.name_suggestions ?? []}
                  names={currentCohortData?.names ?? []}
                  disabled={disabled}
                  onNameIdChange={(nameId) =>
                    setFormState((prev) => ({ ...prev, name_id: nameId }))
                  }
                  onGenerate={handleGenerateName}
                  isGenerating={isGenerating("names")}
                  placeholder="e.g., Spring 2024 Cohort"
                  defaultName="New Cohort"
                  required={currentCohortData?.name_required ?? false}
                  hideDescription={true}
                  group_id={currentCohortData?.group_id ?? null}
                  agent_id={currentCohortData?.name_agent_id ?? null}
                  createNamesAction={
                    createNamesAction as
                      | ((
                          input: CreateDraftNamesIn
                        ) => Promise<CreateDraftNamesOut>)
                      | undefined
                  }
                />
              }
              resetFields={["name", "description", "department_ids", "active"]}
              actions={
                stepResources["basic"] &&
                stepResources["basic"].length > 0 &&
                currentCohortData?.basic_agent_id ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const hasRegeneratable = stepResources[
                              "basic"
                            ]!.some((rt) => canRegenerate(rt));
                            handleOpenStepCardModal(
                              "basic",
                              hasRegeneratable ? "regenerate" : "generate"
                            );
                          }}
                          disabled={
                            disabled ||
                            stepResources["basic"]!.some((rt) =>
                              isGenerating(rt)
                            )
                          }
                        >
                          {stepResources["basic"]!.some((rt) =>
                            isGenerating(rt)
                          ) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {stepResources["basic"]!.some((rt) => canRegenerate(rt))
                          ? "Regenerate"
                          : "Generate"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : undefined
              }
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <div className="space-y-4">
                {/* Description field - using Descriptions resource component */}
                <Descriptions
                  description_id={formState.description_id ?? null}
                  description_resource={
                    currentCohortData?.description_resource ?? null
                  }
                  show_description={currentCohortData?.show_description ?? true}
                  description_suggestions={
                    currentCohortData?.description_suggestions ?? []
                  }
                  descriptions={currentCohortData?.descriptions ?? []}
                  disabled={disabled}
                  onDescriptionIdChange={(descriptionId) =>
                    setFormState((prev) => ({
                      ...prev,
                      description_id: descriptionId,
                    }))
                  }
                  searchTerm={
                    (stepFormData["descriptionSearch"] as
                      | string
                      | null
                      | undefined) || ""
                  }
                  onSearchChange={(term: string) =>
                    setStepFormData({ descriptionSearch: term || null })
                  }
                  onGenerate={handleGenerateDescription}
                  isGenerating={isGenerating("descriptions")}
                  label="Description"
                  placeholder="Detailed description of the cohort"
                  required={currentCohortData?.description_required ?? false}
                  rows={4}
                  data-testid="input-cohort-description"
                  group_id={currentCohortData?.group_id ?? null}
                  agent_id={currentCohortData?.description_agent_id ?? null}
                  createDescriptionsAction={createDescriptionsAction}
                />

                {/* Department Selection */}
                <Departments
                  department_ids={formState.department_ids ?? []}
                  department_resources={
                    currentCohortData?.department_resources ?? []
                  }
                  show_departments={
                    currentCohortData?.show_departments ?? false
                  }
                  department_suggestions={
                    currentCohortData?.department_suggestions ?? []
                  }
                  departments={currentCohortData?.departments ?? []}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({ ...prev, department_ids: ids }))
                  }
                  onGenerate={handleGenerateDepartments}
                  isGenerating={isGenerating("departments")}
                  required={currentCohortData?.departments_required ?? false}
                  group_id={currentCohortData?.group_id ?? null}
                  agent_id={currentCohortData?.departments_agent_id ?? null}
                  createDepartmentsAction={createDepartmentsAction}
                />

                {/* Active Switch - using Flags resource component */}
                <Flags
                  flag_id={formState.active_flag_id ?? null}
                  flag_resource={currentCohortData?.flag_resource ?? null}
                  show_flag={currentCohortData?.show_flag ?? false}
                  disabled={disabled}
                  onFlagIdChange={(flagId) =>
                    setFormState((prev) => ({
                      ...prev,
                      active_flag_id: flagId,
                    }))
                  }
                  onGenerate={handleGenerateFlags}
                  isGenerating={isGenerating("flags")}
                  label="Active"
                  helpText="Inactive cohorts will not be available for selection"
                  required={currentCohortData?.flag_required ?? false}
                  group_id={currentCohortData?.group_id ?? null}
                  agent_id={currentCohortData?.flag_agent_id ?? null}
                  createFlagsAction={createFlagsAction}
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
                currentCohortData?.simulations_agent_id ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const hasRegeneratable = stepResources[
                              "simulations"
                            ]!.some((rt) => canRegenerate(rt));
                            handleOpenStepCardModal(
                              "simulations",
                              hasRegeneratable ? "regenerate" : "generate"
                            );
                          }}
                          disabled={
                            disabled ||
                            stepResources["simulations"]!.some((rt) =>
                              isGenerating(rt)
                            )
                          }
                        >
                          {stepResources["simulations"]!.some((rt) =>
                            isGenerating(rt)
                          ) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {stepResources["simulations"]!.some((rt) =>
                          canRegenerate(rt)
                        )
                          ? "Regenerate"
                          : "Generate"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : undefined
              }
            >
              <Simulations
                simulation_ids={formState.simulation_ids ?? []}
                simulation_resources={
                  currentCohortData?.simulation_resources ?? []
                }
                show_simulations={currentCohortData?.show_simulations ?? false}
                simulation_suggestions={
                  currentCohortData?.simulation_suggestions ?? []
                }
                simulations={currentCohortData?.simulations ?? []}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({
                    ...prev,
                    simulation_ids: ids,
                  }))
                }
                onGenerate={handleGenerateSimulations}
                isGenerating={isGenerating("simulations")}
                label="Simulations"
                required={currentCohortData?.simulations_required ?? false}
                group_id={currentCohortData?.group_id ?? null}
                agent_id={currentCohortData?.simulations_agent_id ?? null}
                searchTerm={simulationSearchTerm}
                showSelectedFilter={simulationShowSelected}
                createSimulationsAction={createSimulationsAction}
              />
              <SimulationPositions
                simulation_ids={formState.simulation_ids ?? []}
                simulation_resources={
                  currentCohortData?.simulation_resources ?? []
                }
                show_simulation_positions={
                  currentCohortData?.show_simulation_positions ?? false
                }
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
                required={
                  currentCohortData?.simulation_positions_required ?? false
                }
                group_id={currentCohortData?.group_id ?? null}
                agent_id={
                  currentCohortData?.simulation_positions_agent_id ?? null
                }
                onGenerate={
                  isEditMode ? handleGenerateSimulationPositions : undefined
                }
                isGenerating={isGenerating("simulation_positions")}
                createSimulationPositionsAction={createSimulationPositionsAction}
              />
            </StepCard>
          );
        }

        default:
          return null;
      }
    },
    [
      // Use stableCohortDataFields instead of cohortData to prevent callback recreation
      // when only object reference changes (but content is same)
      stableCohortDataFields,
      disabled,
      isEditMode,
      handleGenerateName,
      handleGenerateDescription,
      handleGenerateDepartments,
      handleGenerateFlags,
      handleGenerateSimulations,
      handleGenerateSimulationPositions,
      isGenerating,
      stepResources,
      // Depend on individual formState fields instead of whole object to prevent callback recreation
      // when object reference changes but values are same
      formState.name_id,
      formState.description_id,
      formState.active_flag_id,
      // Include arrays - they're used in the callback, but the formState sync effect ensures
      // they only change when content actually changes (not just reference)
      formState.department_ids,
      formState.simulation_ids,
      createNamesAction,
      createDescriptionsAction,
      createFlagsAction,
      createDepartmentsAction,
      createSimulationsAction,
      createSimulationPositionsAction,
      canRegenerate,
      handleOpenStepCardModal,
    ]
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

        {/* Generate/Regenerate Modal */}
        {modalMode && (
          <GenerateRegenerateModal
            open={showGenerateModal}
            onOpenChange={setShowGenerateModal}
            resources={modalResources}
            onResourcesChange={setModalResources}
            instructions={modalInstructions}
            onInstructionsChange={setModalInstructions}
            onGenerate={handleModalGenerate}
            isGenerating={modalResources.some((r) =>
              isGenerating(r.id as ResourceType)
            )}
            mode={modalMode}
          />
        )}
      </div>
    </TooltipProvider>
  );
}

// Memoize component to prevent re-renders when only prop references change (content is same)
export default React.memo(CohortComponent, (prevProps, nextProps) => {
  // Compare cohortData by resource IDs, not object reference
  const prevIds = {
    name_id: prevProps.cohortData?.name_id,
    description_id: prevProps.cohortData?.description_id,
    active_flag_id: prevProps.cohortData?.active_flag_id,
    department_ids: prevProps.cohortData?.department_ids,
    simulation_ids: prevProps.cohortData?.simulation_ids,
  };
  const nextIds = {
    name_id: nextProps.cohortData?.name_id,
    description_id: nextProps.cohortData?.description_id,
    active_flag_id: nextProps.cohortData?.active_flag_id,
    department_ids: nextProps.cohortData?.department_ids,
    simulation_ids: nextProps.cohortData?.simulation_ids,
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
    prevProps.saveCohortAction !== nextProps.saveCohortAction ||
    prevProps.patchCohortDraftAction !== nextProps.patchCohortDraftAction ||
    prevProps.createNamesAction !== nextProps.createNamesAction ||
    prevProps.createDescriptionsAction !== nextProps.createDescriptionsAction ||
    prevProps.createFlagsAction !== nextProps.createFlagsAction ||
    prevProps.createDepartmentsAction !== nextProps.createDepartmentsAction ||
    prevProps.createSimulationsAction !== nextProps.createSimulationsAction ||
    prevProps.createSimulationPositionsAction !== nextProps.createSimulationPositionsAction
  ) {
    return false; // Function props changed, re-render
  }

  // All props are equivalent, skip re-render
  return true;
});
